'use strict';

const PlexWebhooksPlatform = require('./src/platform');
const { PLATFORM_NAME, PLUGIN_NAME } = require('./src/settings');

/**
 * This method registers the platform with Homebridge
 */
module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, PlexWebhooksPlatform);
};
