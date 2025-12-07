'use strict';

const EventEmitter = require('events');
const PlexWebhooksPlatformAccessory = require('./accessory');
const expandConfig = require('./helpers/config-helper');
const FilterHelper = require('./helpers/filter-helper');
const WebhooksServer = require('./server');
const { PLUGIN_NAME, PLATFORM_NAME } = require('./settings');

class PlexWebhooksPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.api = api;

    this.log.warn(
      "ORIGINAL CONFIG RECEIVED FROM HOMEBRIDGE:",
      JSON.stringify(config, null, 2)
    );

    this.config = expandConfig(api, config || {});

    this.log.warn(
      "EXPANDED CONFIG:",
      JSON.stringify(this.config, null, 2)
    );

    // Map of cached/restored accessories keyed by sensor.id
    this.platformAccessories = new Map();

    this.emitter = new EventEmitter();

    // Verbose logging helper
    this.log.verbose = (msg) => {
      if (this.config.verbose) {
        this.log.info(msg);
      } else {
        this.log.debug(msg);
      }
    };

    this._cleanFilters();

    // Ensure nothing else runs until Homebridge finishes launching
    this.api.on('didFinishLaunching', async () => {
      try {
        await this._setupAccessories();
        this._startWebhookServer();
      } catch (err) {
        this.log.error('Error during platform launch:', err);
      }
    });
  }

  /**
   * Called when Homebridge restores cached accessories
   */
  configureAccessory(accessory) {
    this.log.debug(
      'Loading accessory from cache:',
      accessory.displayName,
      accessory.UUID
    );

    const sensorId = accessory.context.sensor?.id || accessory.displayName;
    if (sensorId) {
      this.platformAccessories.set(sensorId, accessory);
    }
  }

  /**
   * Clean up filter definitions in config
   */
  _cleanFilters() {
    const cleanFilters = (filters) => {
      if (!filters || filters.length === 0) return [];
      return filters.map((group) =>
        group.every((rule) => !rule.operator || rule.operator === '===') ? [] : group
      );
    };

    this.config.sensors = this.config.sensors.map((sensor) => {
      sensor.filters = cleanFilters(sensor.filters);
      return sensor;
    });
  }

  /**
   * Setup all accessories after Homebridge finishes launching
   */
  async _setupAccessories() {
    const sensors = Array.isArray(this.config.sensors) ? this.config.sensors : [];
    const keepIds = new Set();

    this._logAccessoriesFoundInConfig();

    for (const [index, sensor] of sensors.entries()) {
      const sensorId = sensor.id || sensor.name || `Sensor-${index + 1}`;
      keepIds.add(sensorId);

      let accessory = this.platformAccessories.get(sensorId);

      if (!accessory) {
        const uuid = this.api.hap.uuid.generate(`plex-webhook-sensor:${sensorId}`);
        this.log.info(`Queued registration for new accessory [${sensor.name}] (${uuid})`);

        accessory = new this.api.platformAccessory(sensor.name, uuid);
        accessory.context.sensor = sensor;

        try {
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (err) {
          this.log.error(
            `Failed to register accessory [${sensor.name}] (${uuid}):`,
            err.message
          );
          continue; // skip this sensor
        }

        this.platformAccessories.set(sensorId, accessory);
      } else {
        this.log.info(`Reusing existing accessory [${sensor.name}] (${accessory.UUID})`);
        accessory.context.sensor = sensor;
      }

      // Initialize accessory wrapper
      new PlexWebhooksPlatformAccessory(this, accessory, sensor);
    }

    // Remove stale cached accessories
    for (const [id, accessory] of this.platformAccessories.entries()) {
      if (!keepIds.has(id)) {
        this.log.info(`Removing obsolete accessory: ${accessory.displayName}`);
        try {
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (err) {
          this.log.warn(
            `Failed to unregister obsolete accessory [${accessory.displayName}]:`,
            err.message
          );
        }
        this.platformAccessories.delete(id);
      }
    }
  }

  _logAccessoriesFoundInConfig() {
    const sensors = Array.isArray(this.config.sensors) ? this.config.sensors : [];

    if (sensors.length === 0) {
      this.log.info('No accessories found in config.');
    } else if (sensors.length === 1) {
      this.log.info(`Found 1 accessory: ${sensors[0].name}`);
    } else {
      this.log.info(`Found ${sensors.length} accessories:`);
      for (const s of sensors) this.log.info(`• ${s.name}`);
    }
  }

  _startWebhookServer() {
    const server = new WebhooksServer(this.log, this.config, (payload) => this._processPayload(payload));
    server.launch();
  }

  _processPayload(payload) {
    const sensors = Array.isArray(this.config.sensors) ? this.config.sensors : [];

    sensors
      .filter((sensor) => {
        const filterHelper = new FilterHelper(this.log, payload, sensor.filters);
        this.log.verbose(`Checking rules for [${sensor.name}]`);
        return filterHelper.match();
      })
      .forEach((sensor) => {
        const uuid = this.api.hap.uuid.generate(`plex-webhook-sensor:${sensor.id}`);
        this.emitter.emit('stateChange', payload.event, uuid);
      });
  }
}

module.exports = PlexWebhooksPlatform;
