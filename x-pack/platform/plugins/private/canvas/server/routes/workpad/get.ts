/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { RouteInitializerDeps } from '..';
import { API_ROUTE_WORKPAD } from '../../../common/lib/constants';
import { catchErrorHandler } from '../catch_error_handler';
import { shimWorkpad } from './shim_workpad';

export function initializeGetWorkpadRoute(deps: RouteInitializerDeps) {
  const { router } = deps;
  router.versioned
    .get({
      path: `${API_ROUTE_WORKPAD}/{id}`,
      access: 'internal',
      security: {
        authz: {
          enabled: false,
          reason:
            'This route is opted out from authorization because authorization is provided by saved objects client.',
        },
      },
    })
    .addVersion(
      {
        version: '1',
        validate: {
          request: {
            params: schema.object({
              id: schema.string(),
            }),
          },
        },
      },
      catchErrorHandler(async (context, request, response) => {
        const canvasContext = await context.canvas;
        const workpad = await canvasContext.workpad.get(request.params.id);

        shimWorkpad(workpad);

        return response.ok({
          body: {
            id: workpad.id,
            ...workpad.attributes,
          },
        });
      })
    );
}
