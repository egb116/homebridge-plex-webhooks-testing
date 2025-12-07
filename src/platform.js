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

        // Verbose logging helper
        this.log.verbose = (msg) => {
            if (config?.verbose) {
                log.info(msg);
            } else {
                log.debug(msg);
            }
        };

        // Cleanup filters
        this._cleanFilters();

        // Homebridge didFinishLaunching hook
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
        this.log.debug('Loading accessory from cache:', accessory.displayName);
        this.accessories.set(accessory.UUID, accessory);
    }

    /**
     * Cleanup invalid filters
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
     * Log accessories found in config
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
            const uuid = sensor.uuid; // Already generated in config-helper
            let accessory = this.accessories.get(uuid);

            if (accessory) {
                // Case 1: Accessory Restored (Run 2+)
                this.log.info(`Updating accessory [${sensor.name}] (${uuid})`);
                accessory.context.sensor = sensor;
                new PlexWebhooksPlatformAccessory(this, accessory, sensor);
            } else {
                // Case 2: New Accessory (Run 1) or Accessory Cache Corrupted
                this.log.info(`Registering new accessory [${sensor.name}] (${uuid})`);
                accessory = new this.api.platformAccessory(sensor.name, uuid);
                accessory.context.sensor = sensor;

                // FIX 3 (Final attempt): Unregister before register to clear stale memory reference.
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                this.log.info(`Cleared potential stale registration for [${sensor.name}]`);

                // FIX 1: Register with Homebridge FIRST (Bridging Fix)
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

                // Now initialize the wrapper, which will safely call addService
                new PlexWebhooksPlatformAccessory(this, accessory, sensor);

                // Cache for future restarts
                this.accessories.set(uuid, accessory);
            }

            discoveredUUIDs.push(uuid);
        }

        // FIX 2: Rewrite loop to fix SyntaxError on startup (Syntax Fix)
        // Remove cached accessories no longer in config
        for (const entry of this.accessories.entries()) {
            const uuid = entry[0];
            const accessory = entry[1];

            if (!discoveredUUIDs.includes(uuid)) {
                this.log.info(`Removing obsolete accessory: ${accessory.displayName}`);
                this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
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
                this.emitter.emit('stateChange', payload.event, sensor.uuid);
            });
    }
}

module.exports = PlexWebhooksPlatform;