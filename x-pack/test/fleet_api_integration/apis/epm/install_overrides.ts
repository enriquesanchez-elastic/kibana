/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../api_integration/ftr_provider_context';
import { skipIfNoDockerRegistry, isDockerRegistryEnabledOrSkipped } from '../../helpers';

export default function (providerContext: FtrProviderContext) {
  const { getService } = providerContext;
  const supertest = getService('supertest');
  const es = getService('es');
  const fleetAndAgents = getService('fleetAndAgents');

  const mappingsPackage = 'overrides';
  const mappingsPackageVersion = '0.1.0';

  const deletePackage = async (pkg: string, version: string) =>
    supertest.delete(`/api/fleet/epm/packages/${pkg}/${version}`).set('kbn-xsrf', 'xxxx');

  describe('installs packages that include settings and mappings overrides', () => {
    skipIfNoDockerRegistry(providerContext);

    before(async () => {
      await fleetAndAgents.setup();
    });

    after(async () => {
      if (isDockerRegistryEnabledOrSkipped(providerContext)) {
        // remove the package just in case it being installed will affect other tests
        await deletePackage(mappingsPackage, mappingsPackageVersion);
      }
    });

    it('should install the overrides package correctly', async function () {
      let { body } = await supertest
        .post(`/api/fleet/epm/packages/${mappingsPackage}/${mappingsPackageVersion}`)
        .set('kbn-xsrf', 'xxxx')
        .expect(200);

      const templateName = body.items.filter((item: any) => item.type === 'index_template')?.[0].id;

      if (!templateName) {
        throw new Error('index template not found in package assets');
      }

      const { body: indexTemplateResponse } = await es.transport.request<any>(
        {
          method: 'GET',
          path: `/_index_template/${templateName}`,
        },
        { meta: true }
      );

      // the index template composed_of has the correct component templates in the correct order
      const indexTemplate = indexTemplateResponse.index_templates[0].index_template;
      expect(indexTemplate.composed_of).to.eql([
        `logs@mappings`,
        `logs@settings`,
        `${templateName}@package`,
        'logs@custom',
        `overrides@custom`,
        `${templateName}@custom`,
        `ecs@mappings`,
        '.fleet_globals-1',
        '.fleet_agent_id_verification-1',
      ]);

      ({ body } = await es.transport.request(
        {
          method: 'GET',
          path: `/_component_template/${templateName}@package`,
        },
        {
          meta: true,
        }
      ));

      // The mappings override provided in the package is set in the package component template
      expect(body.component_templates[0].component_template.template.mappings.dynamic).to.be(false);

      // The settings override provided in the package is set in the package component template
      expect(
        body.component_templates[0].component_template.template.settings.index.lifecycle.name
      ).to.be('reference');

      // Update the user_settings component template
      ({ body } = await es.transport.request({
        method: 'PUT',
        path: `/_component_template/${templateName}@custom`,
        body: {
          template: {
            settings: {
              number_of_shards: 3,
              index: {
                lifecycle: { name: 'overridden by user' },
                number_of_shards: 123,
              },
            },
          },
        },
      }));

      // simulate the result
      ({ body } = await es.transport.request(
        {
          method: 'POST',
          path: `/_index_template/_simulate/${templateName}`,
          // body: indexTemplate, // I *think* this should work, but it doesn't
          body: {
            index_patterns: [`${templateName}-*`],
            composed_of: [`${templateName}@package`, `${templateName}@custom`],
          },
        },
        { meta: true }
      ));

      // omit routings
      delete body.template.settings.index.routing;

      expect(Object.keys(body)).to.eql(['template', 'overlapping']);
      expect(body.template).to.eql({
        settings: {
          index: {
            default_pipeline: 'logs-overrides.test-0.1.0',
            lifecycle: {
              name: 'overridden by user',
            },
            mapping: {
              total_fields: {
                limit: '1000',
              },
            },
            number_of_shards: '3',
          },
        },
        mappings: {
          dynamic: 'false',
          properties: {
            '@timestamp': {
              type: 'date',
            },
            data_stream: {
              properties: {
                dataset: {
                  type: 'constant_keyword',
                },
                namespace: {
                  type: 'constant_keyword',
                },
                type: {
                  type: 'constant_keyword',
                },
              },
            },
          },
        },
        aliases: {},
      });

      // otel logs templates were added in 8.16 but these tests also run against
      // previous versions, so we conditionally test based on the ES version
      const esVersion = getService('esVersion');
      expect(body.overlapping).to.eql([
        {
          name: 'logs',
          index_patterns: ['logs-*-*'],
        },
        ...(esVersion.matchRange('>=8.16.0')
          ? [
              {
                index_patterns: ['logs-*.otel-*'],
                name: 'logs-otel@template',
              },
            ]
          : []),
      ]);
    });
  });
}
