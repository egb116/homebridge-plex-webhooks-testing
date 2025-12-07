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
    this.config = expandConfig(api, config || {});

    // Cache for restored accessories
    this.accessories = new Map();

    this.emitter = new EventEmitter();

    this.log.verbose = (msg) => {
      if (config?.verbose) {
        log.info(msg);
      } else {
        log.debug(msg);
      }
    };

    this._cleanFilters();

    this.api.on('didFinishLaunching', () => {
      try {
        this._logAccessoriesFoundInConfig();
        this._discoverAccessories();

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
   * Called by Homebridge when cached accessories are being restored.
   */
  configureAccessory(accessory) {
    this.log.debug('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * Cleanup invalid filters
   */
  _cleanFilters() {
    const cleanFilters = (filters) => {
      if (!filters || filters.length === 0) {
        return [];
      }

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
   * Main discovery logic (runs after didFinishLaunching)
   */
  _discoverAccessories() {
    const sensors = Array.isArray(this.config.sensors) ? this.config.sensors : [];
    const discoveredUUIDs = [];

    for (const sensor of sensors) {
      const uuid = sensor.uuid || this.api.hap.uuid.generate(sensor.name);

      // Check if we already restored this accessory from cache
      let accessory = this.accessories.get(uuid);

      if (accessory) {
        // Existing accessory: update context and wrap it
        this.log.info(`Updating accessory [${sensor.name}] (${uuid})`);
        accessory.context.sensor = sensor;
        new PlexWebhooksPlatformAccessory(this, accessory, sensor);
      } else {
        // Check if Homebridge already knows about this UUID
        const existingBridged = this.api.platformAccessory?.UUID === uuid; // single accessory check
        // In case of multiple, you could iterate over this.api.platformAccessories if available

        if (!existingBridged) {
          // New accessory: create and register it
          this.log.info(`Registering new accessory [${sensor.name}] (${uuid})`);
          accessory = new this.api.platformAccessory(sensor.name, uuid);
          accessory.context.sensor = sensor;

          new PlexWebhooksPlatformAccessory(this, accessory, sensor);

          // Register only if Homebridge does not already know about it
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else {
          // Already bridged by Homebridge: just create wrapper without registering
          this.log.info(`Accessory [${sensor.name}] (${uuid}) already bridged by Homebridge, skipping registration`);
          accessory = new this.api.platformAccessory(sensor.name, uuid);
          accessory.context.sensor = sensor;
          new PlexWebhooksPlatformAccessory(this, accessory, sensor);
        }

        this.accessories.set(uuid, accessory);
      }

      discoveredUUIDs.push(uuid);
    }

    // Remove any cached accessories no longer in config
    for (const [uuid, accessory] of this.accessories) {
      if (!discoveredUUIDs.includes(uuid)) {
        this.log.info(`Removing obsolete accessory: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
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
        this.emitter.emit('stateChange', payload.event, sensor.uuid);
      });
  }
}

module.exports = PlexWebhooksPlatform;
