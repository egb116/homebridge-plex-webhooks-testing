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
    this.emitter = new EventEmitter();

    this.config = expandConfig(api, config || {});

    this.platformAccessories = new Map();

    this.log.verbose = (msg) => {
      if (this.config.verbose) this.log.info(msg);
      else this.log.debug(msg);
    };

    this._cleanFilters();

    this.api.on('didFinishLaunching', async () => {
      try {
        await this._setupAccessories();
        this._startWebhookServer();
      } catch (err) {
        this.log.error('Error during platform launch:', err);
      }
    });
  }

  configureAccessory(accessory) {
    const sensorId = accessory.context.sensor?.id || accessory.displayName;
    if (sensorId) {
      this.platformAccessories.set(sensorId, accessory);
      this.log.debug('Restored cached accessory:', accessory.displayName);
    }
  }

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

  async _setupAccessories() {
      const sensors = Array.isArray(this.config.sensors) ? this.config.sensors : [];
      const keepIds = new Set();

      this._logAccessoriesFoundInConfig();

      for (const [index, sensor] of sensors.entries()) {
          const sensorId = sensor.id || sensor.name || `Sensor-${index + 1}`;
          keepIds.add(sensorId);

          const uuidFromConfig = sensor.uuid; 

          let accessory = this.platformAccessories.get(sensorId); 

          if (!accessory) {
              this.log.info(`Queued registration for new accessory [${sensor.name}] (${uuidFromConfig})`);

              accessory = new this.api.platformAccessory(sensor.name, uuidFromConfig);
              accessory.context.sensor = sensor;

              try {
                  this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                  this.platformAccessories.set(sensorId, accessory);

              } catch (err) {
                  if (err.message.includes('already bridged')) {
                      this.log.info(
                          `Initial registration failed for [${sensor.name}] (${uuidFromConfig}). Accessory appears to be bridged but was not in cache. Attempting automated recovery.`
                      );
                    
                      const recoveredAccessory = Array.from(this.platformAccessories.values())
                      .find(acc => acc.UUID === uuidFromConfig || acc.displayName === sensor.name);

                      if (recoveredAccessory) {
                          this.log.info(`Recovery successful (found in map). Reusing accessory.`);
                          accessory = recoveredAccessory;
                      } else if (accessory) { 
                          this.log.info(`Recovery successful (using in-memory object). Reusing accessory.`);
                      } else {
                          this.log.error(
                              `Failed to register and recover accessory [${sensor.name}] (${uuidFromConfig}):`,
                              err.message
                          );
                          continue;
                      }
                    
                      accessory.context.sensor = sensor; 
                      this.platformAccessories.set(sensorId, accessory); 

                  } else {
                      this.log.error(
                          `Failed to register accessory [${sensor.name}] (${uuidFromConfig}):`,
                          err.message
                      );
                      continue;
                  }
              } 
          } else {
              this.log.info(`Reusing existing accessory [${sensor.name}] (${accessory.UUID})`);
              accessory.context.sensor = sensor;
          }

          new PlexWebhooksPlatformAccessory(this, accessory, sensor);
      }

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
    this.server = new WebhooksServer(this.log, this.config, (payload) => this._processPayload(payload));
    this.server.launch();
    this.log.info(`Plex Webhooks server listening on http://0.0.0.0:${this.config.server.port}`);
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
            const uuid = sensor.uuid; 
          this.emitter.emit('stateChange', payload.event, uuid);
        });
    }
}

module.exports = PlexWebhooksPlatform;
