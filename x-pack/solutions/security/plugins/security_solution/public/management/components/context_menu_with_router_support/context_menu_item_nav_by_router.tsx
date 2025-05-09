/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo, useMemo } from 'react';
import type { EuiContextMenuItemProps } from '@elastic/eui';
import { EuiContextMenuItem, EuiFlexGroup, EuiFlexItem, EuiText } from '@elastic/eui';
import styled from 'styled-components';
import type { NavigateToAppOptions } from '@kbn/core/public';
import { useNavigateToAppEventHandler } from '../../../common/hooks/endpoint/use_navigate_to_app_event_handler';
import { useTestIdGenerator } from '../../hooks/use_test_id_generator';

export interface ContextMenuItemNavByRouterProps extends EuiContextMenuItemProps {
  /** The Kibana (plugin) app id */
  navigateAppId?: string;
  /** Additional options for the navigation action via react-router */
  navigateOptions?: NavigateToAppOptions;
  /**
   * if `true`, the `children` will be wrapped in a `div` that contains CSS Classname `eui-textTruncate`.
   * **NOTE**: When this component is used in combination with `ContextMenuWithRouterSupport` and `maxWidth`
   * is set on the menu component, this prop will be overridden
   */
  textTruncate?: boolean;
  /** Displays an additional info when hover an item */
  hoverInfo?: React.ReactNode;
  /** Disables navigation */
  isNavigationDisabled?: boolean;
  children: React.ReactNode;
}

const StyledEuiContextMenuItem = styled(EuiContextMenuItem)`
  .additional-info {
    display: none;
    max-width: 50%;
  }
  &:hover {
    .additional-info {
      display: block !important;
    }
  }
`;

const StyledEuiFlexItem = styled('div')`
  max-width: 50%;
  padding-right: ${(props) => props.theme.eui.euiSizeS};
`;

const StyledEuiText = styled(EuiText)`
  padding: ${(props) => props.theme.eui.euiSizeM};
  line-height: ${(props) => props.theme.eui.euiFontSizeM};
`;

/**
 * Just like `EuiContextMenuItem`, but allows for additional props to be defined which will
 * allow navigation to a URL path via React Router
 */
export const ContextMenuItemNavByRouter = memo<ContextMenuItemNavByRouterProps>(
  ({
    navigateAppId,
    navigateOptions,
    onClick,
    textTruncate,
    hoverInfo,
    children,
    isNavigationDisabled = false,
    ...otherMenuItemProps
  }) => {
    const handleOnClickViaNavigateToApp = useNavigateToAppEventHandler(navigateAppId ?? '', {
      ...navigateOptions,
      onClick,
    });
    const getTestId = useTestIdGenerator(otherMenuItemProps['data-test-subj']);

    const hoverComponentInstance = useMemo(() => {
      // If the `hoverInfo` is not an object (ex. text, number), then auto-add the text truncation className.
      // Adding this when the `hoverInfo` is a react component could cause issue, thus in those cases, we
      // assume the component will handle how the data is truncated (if applicable)
      const cssClassNames = `additional-info ${
        'object' !== typeof hoverInfo ? 'eui-textTruncate' : ''
      }`;

      return hoverInfo ? (
        <StyledEuiFlexItem className={cssClassNames}>{hoverInfo}</StyledEuiFlexItem>
      ) : null;
    }, [hoverInfo]);

    const content = textTruncate ? (
      <>
        <div
          className="eui-textTruncate"
          data-test-subj={getTestId('truncateWrapper')}
          {
            /* Add the html `title` prop if children is a string */
            ...('string' === typeof children ? { title: children } : {})
          }
        >
          {children}
        </div>
        {hoverComponentInstance}
      </>
    ) : (
      <>
        <EuiFlexItem>{children}</EuiFlexItem>
        {hoverComponentInstance}
      </>
    );

    return isNavigationDisabled ? (
      <StyledEuiText
        size="s"
        className="eui-textTruncate"
        data-test-subj={otherMenuItemProps['data-test-subj']}
      >
        {content}
      </StyledEuiText>
    ) : (
      <StyledEuiContextMenuItem
        {...otherMenuItemProps}
        onClick={navigateAppId ? handleOnClickViaNavigateToApp : onClick}
      >
        <EuiFlexGroup alignItems="center" gutterSize="none">
          {content}
        </EuiFlexGroup>
      </StyledEuiContextMenuItem>
    );
  }
);

ContextMenuItemNavByRouter.displayName = 'EuiContextMenuItemNavByRouter';
