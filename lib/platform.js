'use strict';

const EventEmitter = require('events');
const PlexWebhooksPlatformAccessory = require('./accessory');
const expandConfig = require('./helpers/config-helper');
const FilterHelper = require('./helpers/filter-helper');
const WebhooksServer = require('./server');

class PlexWebhooksPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.api = api;
    this.config = expandConfig(api, config || {});
    this.accessories = [];
    this.emitter = new EventEmitter();

    // Verbose logger
    this.log.verbose = (msg) => {
      if (config?.verbose) {
        log.info(msg);
      } else {
        log.debug(msg);
      }
    };

    this._cleanFilters();

    api.on('didFinishLaunching', () => {
      try {
        this._logAccessoriesFoundInConfig();
        this._discoverAccessories();

        const server = new WebhooksServer(
          this.log,
          this.config,
          this._processPayload.bind(this)
        );

        server.launch();
      } catch (err) {
        this.log.error('Error during platform launch:', err);
      }
    });
  }

  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }

  // Clean up the filters in config to prevent invalid ones
  _cleanFilters() {
    const cleanFilters = (filters) => {
      if (!filters || filters.length === 0) {
        return []; // If no filters or empty, treat it as no filtering (match all)
      }

      return filters.map((group) =>
        group.every((rule) => !rule.operator || rule.operator === '===') ? [] : group
      );
    };

    // Apply the clean filter logic to each sensor
    this.config.sensors = this.config.sensors.map((sensor) => {
      sensor.filters = cleanFilters(sensor.filters);
      return sensor;
    });
  }

  _discoverAccessories() {
    const sensors = Array.isArray(this.config.sensors)
      ? this.config.sensors
      : [];

    const uuidsInConfig = sensors.map((s) => s.uuid);
    const uuidsInCache = this.accessories.map((a) => a.UUID);

    const obsoleteAccessories = this.accessories.filter(
      (a) => !uuidsInConfig.includes(a.UUID)
    );

    const newAccessories = sensors.filter(
      (s) => !uuidsInCache.includes(s.uuid)
    );

    const existingAccessories = this.accessories.filter((a) =>
      uuidsInConfig.includes(a.UUID)
    );

    this._unregisterAccessories(obsoleteAccessories);
    //this._registerAccessories(newAccessories);
    this._updateAccessories(existingAccessories);
  }

  _logAccessoriesFoundInConfig() {
    const sensors = Array.isArray(this.config.sensors)
      ? this.config.sensors
      : [];

    if (sensors.length === 0) {
      this.log.info('No accessories found in config.');
    } else if (sensors.length === 1) {
      this.log.info(`Found 1 accessory: ${sensors[0].name}`);
    } else {
      this.log.info(`Found ${sensors.length} accessories:`);
      sensors.forEach(({ name }) => this.log.info(`• ${name}`));
    }
  }

  _unregisterAccessories(obsoleteAccessories) {
    if (obsoleteAccessories.length === 0) return;

    obsoleteAccessories.forEach((accessory) => {
      this.log.info(
        `Removing accessory [${accessory.displayName}] (${accessory.UUID})`
      );
    });

    this.api.unregisterPlatformAccessories(
      'homebridge-plex-webhooks-testing',
      'PlexWebhooksHB2',
      obsoleteAccessories
    );
  }

  //_registerAccessories(sensors) {
  //    if (!sensors.length) return;
  //
  //    const { platformAccessory: PlatformAccessory } = this.api;
  //
  //    const newAccessories = sensors.map((sensor) => {
  //        const existingAccessory = this.accessories.find(
  //            (accessory) => accessory.UUID === sensor.uuid
  //        );
  //
  //        if (existingAccessory) {
  //            this.log.info(`Found existing accessory with UUID: ${sensor.uuid}`);
  //
  //            if (existingAccessory.plugin !== 'homebridge-plex-webhooks-testing') {
  //                // Conflict detected
  //                this.log.warn(
  //                    `Accessory with UUID ${sensor.uuid} is already bridged by another platform. Unregistering the old accessory.`
  //                );
  //
  //                // Try unregistering the old accessory and log success/failure
  //                try {
  //                    this.api.unregisterPlatformAccessories(
  //                        'homebridge-plex-webhooks-testing',
  //                        'PlexWebhooksHB2',
  //                        [existingAccessory]
  //                    );
  //                    this.log.info(`Successfully unregistered old accessory with UUID ${sensor.uuid}`);
  //                } catch (err) {
  //                    this.log.error(`Failed to unregister old accessory with UUID ${sensor.uuid}:`, err);
  //                }
  //            } else {
  //                this.log.info(`Accessory [${sensor.name}] is already registered with the correct plugin.`);
  //                return existingAccessory;
  //            }
  //        }
  //
  //        // Proceed with registering the new accessory
  //        const accessory = new PlatformAccessory(sensor.name, sensor.uuid);
  //        this.log.info(`Registering accessory [${sensor.name}] (${sensor.uuid})`);
  //
  //        new PlexWebhooksPlatformAccessory(this, accessory, sensor);
  //        return accessory;
  //    });
  //
  //    this.api.registerPlatformAccessories(
  //        'homebridge-plex-webhooks-testing',
  //        'PlexWebhooksHB2',
  //        newAccessories
  //    );
  //}

  _updateAccessories(existing) {
    if (!existing.length) return;

    const sensors = this.config.sensors;

    const updatedAccessories = existing.map((accessory) => {
      const sensor = sensors.find((s) => s.uuid === accessory.UUID);

      this.log.info(
        `Updating accessory [${sensor.name}] (${sensor.uuid})`
      );

      new PlexWebhooksPlatformAccessory(this, accessory, sensor);

      return accessory;
    });

    this.api.updatePlatformAccessories(
      'homebridge-plex-webhooks-testing',
      'PlexWebhooksHB2',
      updatedAccessories
    );
  }

  _processPayload(payload) {
    const sensors = Array.isArray(this.config.sensors)
      ? this.config.sensors
      : [];

    sensors
      .filter((sensor) => {
        const filterHelper = new FilterHelper(
          this.log,
          payload,
          sensor.filters
        );

        this.log.verbose(`Checking rules for [${sensor.name}]`);
        return filterHelper.match();
      })
      .forEach((sensor) => {
        this.emitter.emit('stateChange', payload.event, sensor.uuid);
      });
  }
}

module.exports = PlexWebhooksPlatform;
