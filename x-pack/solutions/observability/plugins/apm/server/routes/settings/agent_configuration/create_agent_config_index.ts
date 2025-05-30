/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import type { Mappings } from '@kbn/observability-plugin/server';
import { createOrUpdateIndex } from '@kbn/observability-plugin/server';
import { APM_AGENT_CONFIGURATION_INDEX } from '@kbn/apm-sources-access-plugin/server';

export async function createApmAgentConfigurationIndex({
  client,
  logger,
}: {
  client: ElasticsearchClient;
  logger: Logger;
}) {
  return createOrUpdateIndex({
    index: APM_AGENT_CONFIGURATION_INDEX,
    client,
    logger,
    mappings,
  });
}

const mappings: Mappings = {
  dynamic: 'strict',
  dynamic_templates: [
    {
      // force string to keyword (instead of default of text + keyword)
      strings: {
        match_mapping_type: 'string',
        mapping: {
          type: 'keyword' as const,
          ignore_above: 1024,
        },
      },
    },
  ],
  properties: {
    '@timestamp': {
      type: 'date',
    },
    service: {
      properties: {
        name: {
          type: 'keyword',
          ignore_above: 1024,
        },
        environment: {
          type: 'keyword',
          ignore_above: 1024,
        },
      },
    },
    settings: {
      // allowing dynamic fields without specifying anything specific
      dynamic: true,
      properties: {},
    },
    applied_by_agent: {
      type: 'boolean',
    },
    agent_name: {
      type: 'keyword',
      ignore_above: 1024,
    },
    etag: {
      type: 'keyword',
      ignore_above: 1024,
    },
  },
};
