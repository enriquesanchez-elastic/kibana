/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { uiSettingsServiceMock } from '@kbn/core/server/mocks';
import { BannersConfigType } from './config';
import { registerSettings } from './ui_settings';

const createConfig = (parts: Partial<BannersConfigType> = {}): BannersConfigType => ({
  placement: 'disabled',
  backgroundColor: '#0000',
  textColor: '#FFFFFF',
  linkColor: '#0B64DD',
  textContent: 'some global banner text',
  disableSpaceBanners: false,
  ...parts,
});

describe('registerSettings', () => {
  let uiSettings: ReturnType<typeof uiSettingsServiceMock.createSetupContract>;

  beforeEach(() => {
    uiSettings = uiSettingsServiceMock.createSetupContract();
  });

  it('registers the settings', () => {
    registerSettings(uiSettings, createConfig());

    expect(uiSettings.register).toHaveBeenCalledTimes(1);
    expect(uiSettings.register).toHaveBeenCalledWith({
      'banners:placement': expect.any(Object),
      'banners:textContent': expect.objectContaining({
        value: 'some global banner text',
      }),
      'banners:textColor': expect.any(Object),
      'banners:linkColor': expect.any(Object),
      'banners:backgroundColor': expect.any(Object),
    });
  });

  it('does not register the settings if `config.disableSpaceBanners` is `true`', () => {
    registerSettings(uiSettings, createConfig({ disableSpaceBanners: true }));

    expect(uiSettings.register).not.toHaveBeenCalled();
  });

  it('uses the configuration values as defaults', () => {
    const config = createConfig({
      placement: 'top',
      backgroundColor: '#FF00CC',
      textColor: '#AAFFEE',
      linkColor: '#0B64DD',
      textContent: 'Some text',
    });

    registerSettings(uiSettings, config);

    expect(uiSettings.register).toHaveBeenCalledTimes(1);
    expect(uiSettings.register).toHaveBeenCalledWith({
      'banners:placement': expect.objectContaining({
        value: config.placement,
      }),
      'banners:textContent': expect.objectContaining({
        value: config.textContent,
      }),
      'banners:textColor': expect.objectContaining({
        value: config.textColor,
      }),
      'banners:linkColor': expect.objectContaining({
        value: config.linkColor,
      }),
      'banners:backgroundColor': expect.objectContaining({
        value: config.backgroundColor,
      }),
    });
  });
});
