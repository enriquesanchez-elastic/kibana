/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { keyBy } from 'lodash';
import { rangeQuery, kqlQuery, termQuery, termsQuery } from '@kbn/observability-plugin/server';
import { ProcessorEvent } from '@kbn/observability-plugin/common';
import { offsetPreviousPeriodCoordinates } from '../../../../common/utils/offset_previous_period_coordinate';
import type { Coordinate } from '../../../../typings/timeseries';
import { ERROR_GROUP_ID, SERVICE_NAME } from '../../../../common/es_fields/apm';
import { environmentQuery } from '../../../../common/utils/environment_query';
import { getBucketSize } from '../../../../common/utils/get_bucket_size';
import { getOffsetInMs } from '../../../../common/utils/get_offset_in_ms';
import type { APMEventClient } from '../../../lib/helpers/create_es_client/create_apm_event_client';

interface ErrorGroupDetailedStat {
  groupId: string;
  timeseries: Coordinate[];
}

export async function getMobileErrorGroupDetailedStatistics({
  kuery,
  serviceName,
  apmEventClient,
  numBuckets,
  groupIds,
  environment,
  start,
  end,
  offset,
}: {
  kuery: string;
  serviceName: string;
  apmEventClient: APMEventClient;
  numBuckets: number;
  groupIds: string[];
  environment: string;
  start: number;
  end: number;
  offset?: string;
}): Promise<ErrorGroupDetailedStat[]> {
  const { startWithOffset, endWithOffset } = getOffsetInMs({
    start,
    end,
    offset,
  });

  const { intervalString } = getBucketSize({
    start: startWithOffset,
    end: endWithOffset,
    numBuckets,
  });

  const timeseriesResponse = await apmEventClient.search(
    'get_service_error_group_detailed_statistics',
    {
      apm: {
        events: [ProcessorEvent.error],
      },
      track_total_hits: false,
      size: 0,
      query: {
        bool: {
          filter: [
            ...termsQuery(ERROR_GROUP_ID, ...groupIds),
            ...termQuery(SERVICE_NAME, serviceName),
            ...rangeQuery(startWithOffset, endWithOffset),
            ...environmentQuery(environment),
            ...kqlQuery(kuery),
          ],
          must_not: {
            term: { 'error.type': 'crash' },
          },
        },
      },
      aggs: {
        error_groups: {
          terms: {
            field: ERROR_GROUP_ID,
            size: 500,
          },
          aggs: {
            timeseries: {
              date_histogram: {
                field: '@timestamp',
                fixed_interval: intervalString,
                min_doc_count: 0,
                extended_bounds: {
                  min: startWithOffset,
                  max: endWithOffset,
                },
              },
            },
          },
        },
      },
    }
  );

  if (!timeseriesResponse.aggregations) {
    return [];
  }

  return timeseriesResponse.aggregations.error_groups.buckets.map((bucket) => {
    const groupId = bucket.key as string;
    return {
      groupId,
      timeseries: bucket.timeseries.buckets.map((timeseriesBucket) => {
        return {
          x: timeseriesBucket.key,
          y: timeseriesBucket.doc_count,
        };
      }),
    };
  });
}

export interface MobileErrorGroupPeriodsResponse {
  currentPeriod: Record<string, ErrorGroupDetailedStat>;
  previousPeriod: Record<string, ErrorGroupDetailedStat>;
}

export async function getMobileErrorGroupPeriods({
  kuery,
  serviceName,
  apmEventClient,
  numBuckets,
  groupIds,
  environment,
  start,
  end,
  offset,
}: {
  kuery: string;
  serviceName: string;
  apmEventClient: APMEventClient;
  numBuckets: number;
  groupIds: string[];
  environment: string;
  start: number;
  end: number;
  offset?: string;
}): Promise<MobileErrorGroupPeriodsResponse> {
  const commonProps = {
    environment,
    kuery,
    serviceName,
    apmEventClient,
    numBuckets,
    groupIds,
  };

  const currentPeriodPromise = getMobileErrorGroupDetailedStatistics({
    ...commonProps,
    start,
    end,
  });

  const previousPeriodPromise = offset
    ? getMobileErrorGroupDetailedStatistics({
        ...commonProps,
        start,
        end,
        offset,
      })
    : [];

  const [currentPeriod, previousPeriod] = await Promise.all([
    currentPeriodPromise,
    previousPeriodPromise,
  ]);

  const firstCurrentPeriod = currentPeriod?.[0];

  return {
    currentPeriod: keyBy(currentPeriod, 'groupId'),
    previousPeriod: keyBy(
      previousPeriod.map((errorRateGroup) => ({
        ...errorRateGroup,
        timeseries: offsetPreviousPeriodCoordinates({
          currentPeriodTimeseries: firstCurrentPeriod?.timeseries,
          previousPeriodTimeseries: errorRateGroup.timeseries,
        }),
      })),
      'groupId'
    ),
  };
}
