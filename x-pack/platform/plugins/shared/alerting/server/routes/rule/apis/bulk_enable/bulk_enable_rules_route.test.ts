/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { httpServiceMock } from '@kbn/core/server/mocks';
import { actionsClientMock } from '@kbn/actions-plugin/server/mocks';
import { bulkEnableRulesRoute } from './bulk_enable_rules_route';
import type { BulkEnableRulesResult } from '../../../../application/rule/methods/bulk_enable';
import { licenseStateMock } from '../../../../lib/license_state.mock';
import { mockHandlerArguments } from '../../../_mock_handler_arguments';
import { rulesClientMock } from '../../../../rules_client.mock';
import { RuleTypeDisabledError } from '../../../../lib/errors/rule_type_disabled';
import { verifyApiAccess } from '../../../../lib/license_api_access';
import type { RuleAction, RuleSystemAction } from '../../../../types';
import type { Rule, RuleParams } from '../../../../application/rule/types';

const rulesClient = rulesClientMock.create();

jest.mock('../../../../lib/license_api_access', () => ({
  verifyApiAccess: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
});

describe('bulkEnableRulesRoute', () => {
  const bulkEnableRequest = { filter: '' };
  const bulkEnableResult = { errors: [], rules: [], total: 1, taskIdsFailedToBeEnabled: [] };
  const bulkEnableResponse = { errors: [], rules: [], total: 1, task_ids_failed_to_be_enabled: [] };

  it('should enable rules with proper parameters', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    bulkEnableRulesRoute({ router, licenseState });

    const [config, handler] = router.patch.mock.calls[0];

    expect(config.path).toBe('/internal/alerting/rules/_bulk_enable');

    rulesClient.bulkEnableRules.mockResolvedValueOnce(bulkEnableResult);

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        body: bulkEnableRequest,
      },
      ['ok']
    );

    expect(await handler(context, req, res)).toEqual({
      body: bulkEnableResponse,
    });

    expect(rulesClient.bulkEnableRules).toHaveBeenCalledTimes(1);
    expect(rulesClient.bulkEnableRules.mock.calls[0]).toEqual([bulkEnableRequest]);

    expect(res.ok).toHaveBeenCalled();
  });

  it('ensures the license allows bulk enabling rules', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    rulesClient.bulkEnableRules.mockResolvedValueOnce(bulkEnableResult);

    bulkEnableRulesRoute({ router, licenseState });

    const [, handler] = router.patch.mock.calls[0];

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        body: bulkEnableRequest,
      }
    );

    await handler(context, req, res);

    expect(verifyApiAccess).toHaveBeenCalledWith(licenseState);
  });

  it('ensures the license check prevents bulk enabling rules', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    (verifyApiAccess as jest.Mock).mockImplementation(() => {
      throw new Error('Failure');
    });

    bulkEnableRulesRoute({ router, licenseState });

    const [, handler] = router.patch.mock.calls[0];

    const [context, req, res] = mockHandlerArguments(
      { rulesClient },
      {
        body: bulkEnableRequest,
      }
    );

    await expect(handler(context, req, res)).rejects.toMatchInlineSnapshot(`[Error: Failure]`);
  });

  it('ensures the rule type gets validated for the license', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    bulkEnableRulesRoute({ router, licenseState });

    const [, handler] = router.patch.mock.calls[0];

    rulesClient.bulkEnableRules.mockRejectedValue(
      new RuleTypeDisabledError('Fail', 'license_invalid')
    );

    const [context, req, res] = mockHandlerArguments({ rulesClient }, { params: {}, body: {} }, [
      'ok',
      'forbidden',
    ]);

    await handler(context, req, res);

    expect(res.forbidden).toHaveBeenCalledWith({ body: { message: 'Fail' } });
  });

  describe('actions', () => {
    const mockedRule: Rule<RuleParams> = {
      id: '1',
      alertTypeId: '1',
      schedule: { interval: '10s' },
      params: {
        bar: true,
      },
      createdAt: new Date('2020-08-20T19:23:38Z'),
      updatedAt: new Date('2020-08-20T19:23:38Z'),
      actions: [
        {
          group: 'default',
          id: '2',
          actionTypeId: 'test',
          params: {
            foo: true,
          },
          uuid: '123-456',
        },
      ],
      consumer: 'bar',
      name: 'abc',
      tags: ['foo'],
      enabled: true,
      muteAll: false,
      notifyWhen: 'onActionGroupChange',
      createdBy: '',
      updatedBy: '',
      apiKeyOwner: '',
      throttle: '30s',
      mutedInstanceIds: [],
      executionStatus: {
        status: 'unknown',
        lastExecutionDate: new Date('2020-08-20T19:23:38Z'),
      },
      revision: 0,
    };

    const action: RuleAction = {
      actionTypeId: 'test',
      group: 'default',
      id: '2',
      params: {
        foo: true,
      },
      uuid: '123-456',
    };

    const systemAction: RuleSystemAction = {
      actionTypeId: 'test-2',
      id: 'system_action-id',
      params: {
        foo: true,
      },
      uuid: '123-456',
    };

    const mockedRules: Array<Rule<RuleParams>> = [
      {
        ...mockedRule,
        actions: [action],
        systemActions: [systemAction],
      },
    ];

    const bulkEnableActionsResult = {
      rules: mockedRules,
      errors: [],
      total: 1,
      taskIdsFailedToBeEnabled: [],
    };

    it('should merge actions and systemActions correctly before sending the response', async () => {
      const licenseState = licenseStateMock.create();
      const router = httpServiceMock.createRouter();
      const actionsClient = actionsClientMock.create();
      actionsClient.isSystemAction.mockImplementation((id: string) => id === 'system_action-id');

      bulkEnableRulesRoute({ router, licenseState });
      const [_, handler] = router.patch.mock.calls[0];

      rulesClient.bulkEnableRules.mockResolvedValueOnce(
        bulkEnableActionsResult as BulkEnableRulesResult<RuleParams>
      );

      const [context, req, res] = mockHandlerArguments(
        { rulesClient, actionsClient },
        {
          body: bulkEnableRequest,
        },
        ['ok']
      );

      const routeRes = await handler(context, req, res);

      // @ts-expect-error: body exists
      expect(routeRes.body).toEqual({
        rules: [
          {
            id: '1',
            enabled: true,
            name: 'abc',
            tags: ['foo'],
            rule_type_id: '1',
            consumer: 'bar',
            schedule: {
              interval: '10s',
            },
            actions: [
              {
                group: 'default',
                id: '2',
                params: {
                  foo: true,
                },
                connector_type_id: 'test',
                uuid: '123-456',
              },
              {
                id: 'system_action-id',
                params: {
                  foo: true,
                },
                uuid: '123-456',
                connector_type_id: 'test-2',
              },
            ],
            params: {
              bar: true,
            },
            created_by: '',
            updated_by: '',
            created_at: '2020-08-20T19:23:38.000Z',
            updated_at: '2020-08-20T19:23:38.000Z',
            api_key_owner: '',
            throttle: '30s',
            mute_all: false,
            notify_when: 'onActionGroupChange',
            muted_alert_ids: [],
            execution_status: {
              status: 'unknown',
              last_execution_date: '2020-08-20T19:23:38.000Z',
            },
            revision: 0,
          },
        ],
        errors: [],
        total: 1,
        task_ids_failed_to_be_enabled: [],
      });
    });
  });
});
