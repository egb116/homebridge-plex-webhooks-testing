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

    // Hold accessories we need to register after the initial loop
    const accessoriesToRegister = [];

    for (const [index, sensor] of sensors.entries()) {
      const seed = sensor.id || sensor.name || `Sensor-${index + 1}`;
      const uuid = this.api.hap.uuid.generate(`plex-webhook-sensor:${seed}`);

      this.log.info(`Sensor: ${JSON.stringify(sensor)}`);
      this.log.info(`UUID: ${uuid}`);

      let accessory = this.accessories.get(uuid);

      if (!accessory) {
        // Check if accessory exists by displayName (legacy name match)
        accessory = Array.from(this.accessories.values()).find(
          (a) => a.displayName === sensor.name
        );

        if (accessory) {
          this.log.info(
            `Accessory [${sensor.name}] found by displayName, mapping to new UUID (${uuid})`
          );
          this.accessories.set(uuid, accessory);
        }
      }

      if (accessory) {
        // Existing accessory: update context and wrap
        this.log.info(`Reusing existing accessory [${sensor.name}] (${uuid})`);
        accessory.context.sensor = sensor;
        new PlexWebhooksPlatformAccessory(this, accessory, sensor);
      } else {
        // New accessory: queue for registration
        this.log.info(`Queued registration for new accessory [${sensor.name}] (${uuid})`);
        const newAccessory = new this.api.platformAccessory(sensor.name, uuid);
        newAccessory.context.sensor = sensor;
        accessoriesToRegister.push(newAccessory);
        this.accessories.set(uuid, newAccessory);
      }

      discoveredUUIDs.push(uuid);
    }

    // Register all new accessories in one batch, deferred to next tick
    if (accessoriesToRegister.length > 0) {
      process.nextTick(() => {
        try {
          this.api.registerPlatformAccessories(
            PLUGIN_NAME,
            PLATFORM_NAME,
            accessoriesToRegister
          );
          this.log.info(`Registered ${accessoriesToRegister.length} new accessory(ies)`);
          // Initialize wrappers
          for (const acc of accessoriesToRegister) {
            new PlexWebhooksPlatformAccessory(this, acc, acc.context.sensor);
          }
        } catch (err) {
          this.log.error('Error registering new accessories:', err.message);
        }
      });
    }

    // Remove stale accessories
    for (const [uuid, accessory] of this.accessories.entries()) {
      if (!discoveredUUIDs.includes(uuid)) {
        this.log.info(`Removing obsolete accessory: ${accessory.displayName}`);
        try {
          this.api.unregisterPlatformAccessories(
            PLUGIN_NAME,
            PLATFORM_NAME,
            [accessory]
          );
        } catch (err) {
          this.log.warn(
            `Failed to unregister obsolete accessory [${accessory.displayName}]:`,
            err.message
          );
        }
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
