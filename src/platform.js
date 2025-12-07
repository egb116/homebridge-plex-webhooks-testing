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

    // Cache for restored accessories (keyed by UUID)
    this.accessories = new Map();

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

    // Homebridge hook after all cached accessories loaded
    this.api.on('didFinishLaunching', () => {
      try {
        this._logAccessoriesFoundInConfig();
        this._discoverAccessories();

        // Start webhook server
        const server = new WebhooksServer(
          this.log,
          this.config,
          (payload) => this._processPayload(payload)
        );
        server.launch();
      } catch (err) {
        this.log.error('Error during platform launch:', err);
      }
    });
  }

  /**
   * Called by Homebridge when cached accessories are restored.
   */
  configureAccessory(accessory) {
    this.log.debug(
      'Loading accessory from cache:',
      accessory.displayName,
      accessory.UUID
    );

    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * Remove invalid filters
   */
  _cleanFilters() {
    const cleanFilters = (filters) => {
      if (!filters || filters.length === 0) return [];
      return filters.map((group) =>
        group.every((rule) => !rule.operator || rule.operator === '===')
          ? []
          : group
      );
    };

    this.config.sensors = this.config.sensors.map((sensor) => {
      sensor.filters = cleanFilters(sensor.filters);
      return sensor;
    });
  }

  /**
   * Log accessories from config
   */
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

  /**
   * Main discovery logic (runs after didFinishLaunching)
   */
  _discoverAccessories() {
    const sensors = Array.isArray(this.config.sensors) ? this.config.sensors : [];
    const discoveredUUIDs = [];

    for (const sensor of sensors) {
      // Generate canonical UUID
      const uuid = this.api.hap.uuid.generate(`plex-webhook-sensor:${sensor.id}`);
      this.log.info(`Sensor: ${JSON.stringify(sensor)}`);
      this.log.info(`UUID: ${uuid}`);

      let accessory = this.accessories.get(uuid);

      // If accessory exists in our cache, update it
      if (accessory) {
        this.log.info(`Updating existing accessory [${sensor.name}] (${uuid})`);
        accessory.context.sensor = sensor;
        new PlexWebhooksPlatformAccessory(this, accessory, sensor);
      } else {
        // Accessory may exist internally in Homebridge even if not in our cache
        // Attempt to unregister any leftover accessory with the same UUID
        try {
          const dummyAccessory = new this.api.platformAccessory(sensor.name, uuid);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [dummyAccessory]);
          this.log.info(`Cleaned leftover bridged accessory with UUID ${uuid}`);
        } catch (err) {
          // Ignore errors; no leftover accessory exists
        }

        // Register the new accessory
        this.log.info(`Registering NEW accessory [${sensor.name}] (${uuid})`);
        accessory = new this.api.platformAccessory(sensor.name, uuid);
        accessory.context.sensor = sensor;

        this.api.registerPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          [accessory]
        );

        new PlexWebhooksPlatformAccessory(this, accessory, sensor);

        this.accessories.set(uuid, accessory);
      }

      discoveredUUIDs.push(uuid);
    }

    // Remove cached accessories no longer in config
    for (const [uuid, accessory] of this.accessories.entries()) {
      if (!discoveredUUIDs.includes(uuid)) {
        this.log.info(`Removing obsolete accessory: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          [accessory]
        );
        this.accessories.delete(uuid);
      }
    }
  }

  /**
   * Webhook payload processor
   */
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
