'use strict';

const { PlexWebhooksPlatform } = require('./platform');
const { PLATFORM_NAME } = require('./settings');

/**
 * This method registers the platform with Homebridge
 */
module.exports = (api) => {
  api.registerPlatform(PLATFORM_NAME, PlexWebhooksPlatform);
};
