'use strict';

const PlexWebhooksPlatform = require('./src/platform');
const { PLATFORM_NAME } = require('./src/settings');

/**
 * This method registers the platform with Homebridge
 */
module.exports = (api) => {
  api.registerPlatform(PLATFORM_NAME, PlexWebhooksPlatform);
};
