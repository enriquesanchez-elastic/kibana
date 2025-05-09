/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TopNFunctions } from '@kbn/profiling-utils';
import { TopNFunctionSortField } from '@kbn/profiling-utils';
import React, { useState } from 'react';
import type { EuiDataGridSorting } from '@elastic/eui';
import { TopNFunctionsGrid } from '../../components/topn_functions';

interface Props {
  data?: TopNFunctions;
  totalSeconds: number;
  showFullScreenSelector?: boolean;
}

export function EmbeddableFunctionsGrid({ data, totalSeconds, showFullScreenSelector }: Props) {
  const [sortField, setSortField] = useState(TopNFunctionSortField.Rank);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageIndex, setPageIndex] = useState(0);
  const [searchFunctionName, setSearchFunctionName] = useState('');

  return (
    <TopNFunctionsGrid
      topNFunctions={data}
      totalSeconds={totalSeconds}
      isDifferentialView={false}
      pageIndex={pageIndex}
      onChangePage={setPageIndex}
      sortField={sortField}
      sortDirection={sortDirection}
      onChangeSort={(sorting: EuiDataGridSorting['columns'][0]) => {
        setSortField(sorting.id as TopNFunctionSortField);
        setSortDirection(sorting.direction);
      }}
      isEmbedded
      showFullScreenSelector={showFullScreenSelector}
      onSearchFunctionNameChange={setSearchFunctionName}
      searchFunctionName={searchFunctionName}
    />
  );
}
