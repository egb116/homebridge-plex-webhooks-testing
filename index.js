'use strict';

const PlexWebhooksPlatform = require('./lib/platform');

module.exports = (api) => {
    if (!api?.registerPlatform) {
    throw new Error('Homebridge API not available — cannot register platform.');
  }

  api.registerPlatform('PlexWebhooksHB2', PlexWebhooksPlatform);
};
