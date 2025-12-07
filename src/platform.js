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
      // Wrap in nextTick to ensure bridge is published
      process.nextTick(() => {
        this._discoverAccessories();
    
        const server = new WebhooksServer(this.log, this.config, (payload) =>
          this._processPayload(payload)
        );
        server.launch();
      });
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

    for (const [index, sensor] of sensors.entries()) {
      // 1️⃣ Generate UUID from stable seed
      const seed = sensor.id || sensor.name || `Sensor-${index + 1}`;
      const uuid = this.api.hap.uuid.generate(`plex-webhook-sensor:${seed}`);

      this.log.info(`Sensor: ${JSON.stringify(sensor)}`);
      this.log.info(`UUID: ${uuid}`);

      // 2️⃣ Attempt to find accessory from restored cache
      let accessory = this.accessories.get(uuid);
      this.log.info(`Accessory: ${accessory}`); // shows undefined if not found

      // 3️⃣ If not found by UUID, try to find by displayName (legacy)
      if (!accessory) {
        accessory = Array.from(this.accessories.values()).find(
          (a) => a.displayName === sensor.name
        );
        if (accessory) {
          this.log.info(
            `Accessory [${sensor.name}] found by displayName, reusing with new UUID (${uuid})`
          );
          // Map it under the new UUID
          this.accessories.set(uuid, accessory);
        }
      }

      // 4️⃣ If still undefined, queue registration for later
      if (!accessory) {
        this.log.info(`Queued registration for new accessory [${sensor.name}] (${uuid})`);

        process.nextTick(() => {
          const newAccessory = new this.api.platformAccessory(sensor.name, uuid);
          newAccessory.context.sensor = sensor;

          try {
            this.api.registerPlatformAccessories(
              PLUGIN_NAME,
              PLATFORM_NAME,
              [newAccessory]
            );
            this.log.info(`Registered new accessory [${sensor.name}] (${uuid})`);
          } catch (err) {
            this.log.error(
              `Failed to register accessory [${sensor.name}] (${uuid}):`,
              err.message
            );
            return;
          }

          this.accessories.set(uuid, newAccessory);
          new PlexWebhooksPlatformAccessory(this, newAccessory, sensor);
        });
      } else {
        // 5️⃣ Existing accessory: update context and initialize
        this.log.info(`Reusing existing accessory [${sensor.name}] (${uuid})`);
        accessory.context.sensor = sensor;
        new PlexWebhooksPlatformAccessory(this, accessory, sensor);
      }

      discoveredUUIDs.push(uuid);
    }

    // 6️⃣ Remove stale cached accessories not in config
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
