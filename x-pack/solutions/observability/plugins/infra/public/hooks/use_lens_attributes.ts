/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback } from 'react';
import type { AggregateQuery, Filter, Query, TimeRange } from '@kbn/es-query';
import type { Action, ActionExecutionContext } from '@kbn/ui-actions-plugin/public';
import { i18n } from '@kbn/i18n';
import useAsync from 'react-use/lib/useAsync';
import {
  type LensAttributes,
  type LensConfig,
  LensConfigBuilder,
} from '@kbn/lens-embeddable-utils/config_builder';

import { useKibanaContextForPlugin } from './use_kibana';

const isAppleDevice =
  typeof window !== 'undefined' && /Mac|iPhone|iPad/.test(window.navigator.userAgent);
const isMetaKey = ({ metaKey, ctrlKey }: { metaKey: boolean; ctrlKey: boolean }) =>
  isAppleDevice ? metaKey : ctrlKey;

export type UseLensAttributesParams = LensConfig;

export const useLensAttributes = (params: UseLensAttributesParams) => {
  const {
    services: { lens, dataViews },
  } = useKibanaContextForPlugin();
  const { navigateToPrefilledEditor } = lens;

  const { value: attributes, error } = useAsync(async () => {
    const { formula: formulaAPI } = await lens.stateHelperApi();
    if (!dataViews || !formulaAPI || !params.dataset) {
      return undefined;
    }

    const builder = new LensConfigBuilder(dataViews, formulaAPI);

    return builder.build(params) as Promise<LensAttributes>;
  }, [params, dataViews, lens]);

  const injectFilters = useCallback(
    ({
      filters,
      query,
    }: {
      filters: Filter[];
      query: Query | AggregateQuery;
    }): LensAttributes | null => {
      if (!attributes) {
        return null;
      }

      return {
        ...attributes,
        state: {
          ...attributes.state,
          query,
          filters: [...attributes.state.filters, ...filters],
        },
      };
    },
    [attributes]
  );

  const openInLensAction = useCallback(
    ({
        timeRange,
        query,
        filters,
        lastReloadRequestTime,
      }: {
        timeRange: TimeRange;
        filters: Filter[];
        query: Query | AggregateQuery;
        lastReloadRequestTime?: number;
      }) =>
      (openInNewTab: boolean) => {
        const injectedAttributes = injectFilters({ filters, query });
        if (injectedAttributes) {
          navigateToPrefilledEditor(
            {
              id: '',
              timeRange,
              attributes: injectedAttributes,
              lastReloadRequestTime,
            },
            {
              openInNewTab,
            }
          );
        }
      },
    [injectFilters, navigateToPrefilledEditor]
  );

  const getExtraActions = useCallback(
    ({
      timeRange,
      filters = [],
      query = { language: 'kuery', query: '' },
      lastReloadRequestTime,
    }: {
      timeRange: TimeRange;
      filters?: Filter[];
      query?: Query | AggregateQuery;
      lastReloadRequestTime?: number;
    }) => {
      const openInLens = getOpenInLensAction(
        openInLensAction({ timeRange, filters, query, lastReloadRequestTime })
      );
      return [openInLens];
    },
    [openInLensAction]
  );

  const getFormula = () => {
    if (params.chartType === 'xy') {
      return params.layers[0].yAxis[0].value;
    }

    return params.value;
  };

  return {
    formula: getFormula(),
    attributes: attributes as LensAttributes | null,
    getExtraActions,
    error,
  };
};

const getOpenInLensAction = (onExecute: (openInNewTab: boolean) => void): Action => {
  return {
    id: 'openInLens',
    getDisplayName(_context: ActionExecutionContext): string {
      return i18n.translate('xpack.infra.hostsViewPage.tabs.metricsCharts.actions.openInLines', {
        defaultMessage: 'Open in Lens',
      });
    },
    getIconType(_context: ActionExecutionContext): string | undefined {
      return 'visArea';
    },
    type: 'actionButton',
    async isCompatible(_context: ActionExecutionContext): Promise<boolean> {
      return true;
    },
    async execute({ event }: ActionExecutionContext): Promise<void> {
      const openInNewTab = event
        ? isMetaKey({ metaKey: event.metaKey, ctrlKey: event.ctrlKey })
        : false;
      onExecute(openInNewTab);
    },
    order: 100,
  };
};
