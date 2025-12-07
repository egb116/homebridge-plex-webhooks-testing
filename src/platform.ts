// src/platform.ts
import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import { EventEmitter } from 'events';

import { PlexWebhooksPlatformAccessory } from './accessory.ts';
import { expandConfig } from './helpers/config-helper.ts';
import { FilterHelper } from './helpers/filter-helper.ts';
import { WebhooksServer } from './server.ts';

import { PLUGIN_NAME, PLATFORM_NAME } from './settings.ts';

export interface SensorConfig {
  name: string;
  uuid: string;
  filters: any[][];
}

export class PlexWebhooksPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  /** Restored accessory cache */
  public readonly accessories: Map<string, PlatformAccessory> = new Map();

  /** Track which UUIDs were discovered after launch */
  private readonly discoveredCacheUUIDs: string[] = [];

  /** Expanded config (after config-helper) */
  private readonly expandedConfig: { sensors: SensorConfig[]; verbose?: boolean };

  /** Event emitter for sensors */
  public readonly emitter = new EventEmitter();

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.expandedConfig = expandConfig(api, config || {}) as any;

    // Verbose logger as in JS version
    this.log.verbose = (msg: string) => {
      if (this.expandedConfig?.verbose) {
        this.log.info(msg);
      } else {
        this.log.debug(msg);
      }
    };

    this._cleanFilters();

    this.log.debug('Finished initializing PlexWebhooksPlatform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('didFinishLaunching: Starting accessory discovery...');
      this._logAccessoriesFoundInConfig();
      this._discoverAccessories();

      const server = new WebhooksServer(
        this.log,
        this.expandedConfig,
        this._processPayload.bind(this),
      );
      server.launch();
    });
  }

  /* ---------------------------------------------------------
   * Homebridge restores cached accessories here
   * -------------------------------------------------------- */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);
  }

  /* ---------------------------------------------------------
   * Cleaning invalid filter definitions
   * -------------------------------------------------------- */
  private _cleanFilters(): void {
    const cleanFilters = (filters?: any[][]): any[][] => {
      if (!filters || filters.length === 0) {
        return [];
      }

      return filters.map(group =>
        group.every(rule => !rule.operator || rule.operator === '===')
          ? []
          : group,
      );
    };

    this.expandedConfig.sensors =
      (this.expandedConfig.sensors || []).map(sensor => ({
        ...sensor,
        filters: cleanFilters(sensor.filters),
      }));
  }

  /* ---------------------------------------------------------
   * Logging sensors from config
   * -------------------------------------------------------- */
  private _logAccessoriesFoundInConfig(): void {
    const sensors = this.expandedConfig.sensors || [];

    if (sensors.length === 0) {
      this.log.info('No accessories found in config.');
    } else if (sensors.length === 1) {
      this.log.info(`Found 1 accessory: ${sensors[0].name}`);
    } else {
      this.log.info(`Found ${sensors.length} accessories:`);
      sensors.forEach(s => this.log.info(`• ${s.name}`));
    }
  }

  /* ---------------------------------------------------------
   * Discover / register / update / unregister
   * -------------------------------------------------------- */
  private _discoverAccessories(): void {
    const sensors = this.expandedConfig.sensors || [];

    for (const sensor of sensors) {
      const uuid = sensor.uuid;
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        // Already exists — update it
        this.log.info(`Restoring existing accessory from cache: ${sensor.name}`);

        new PlexWebhooksPlatformAccessory(this, existingAccessory, sensor);

        this.api.updatePlatformAccessories([existingAccessory]);
      } else {
        // New accessory
        this.log.info('Adding new accessory:', sensor.name);

        const accessory = new this.api.platformAccessory(sensor.name, uuid);
        accessory.context.sensor = sensor;

        new PlexWebhooksPlatformAccessory(this, accessory, sensor);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.set(accessory.UUID, accessory);
      }

      this.discoveredCacheUUIDs.push(uuid);
    }

    // Remove cached accessories that no longer exist in config
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing stale accessory:', accessory.displayName);

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
      }
    }
  }

  /* ---------------------------------------------------------
   * Webhook payload processing
   * -------------------------------------------------------- */
  private _processPayload(payload: any): void {
    const sensors = this.expandedConfig.sensors || [];

    sensors
      .filter(sensor => {
        const helper = new FilterHelper(this.log, payload, sensor.filters);
        this.log.verbose(`Checking rules for [${sensor.name}]`);
        return helper.match();
      })
      .forEach(sensor => {
        this.emitter.emit('stateChange', payload.event, sensor.uuid);
      });
  }
}
