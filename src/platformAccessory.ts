// src/platformAccessory.ts
import { PlatformAccessory, Service, Characteristic, Logging } from 'homebridge';
import { PlexWebhooksPlatform } from './platform.ts';
import { PKG_AUTHOR, PKG_NAME, PKG_VERSION, PLAY_EVENTS, PAUSE_EVENTS } from './constants.ts';

interface SensorConfig {
  uuid: string;
  name: string;
  sn: string;
}

export class PlexWebhooksPlatformAccessory {
  private service: Service;
  private state: string;
  private log: Logging;
  private device: SensorConfig;

  constructor(
    private platform: PlexWebhooksPlatform, // Platform instance
    private accessory: PlatformAccessory,   // Accessory instance
    private sensor: SensorConfig           // Sensor configuration (uuid, name, sn)
  ) {
    const { hap: { Service, Characteristic }, log } = platform;
    this.log = log;
    this.device = sensor;
    this.state = 'media.stop';  // Initial state
    this.service = this.accessory.getService(Service.OccupancySensor) ||
      this.accessory.addService(Service.OccupancySensor); // Add Occupancy Sensor service

    // Set accessory information (manufacturer, model, serial, firmware version)
    this.accessory.getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.FirmwareRevision, PKG_VERSION)
      .setCharacteristic(Characteristic.Manufacturer, PKG_AUTHOR)
      .setCharacteristic(Characteristic.Model, PKG_NAME)
      .setCharacteristic(Characteristic.SerialNumber, this.device.sn);

    // Set the name for the Occupancy Sensor service
    this.service.setCharacteristic(Characteristic.Name, this.device.name);

    // Register the handler for the "OccupancyDetected" characteristic
    this.service.getCharacteristic(Characteristic.OccupancyDetected)
      .onGet(() => this.getState());

    // Add Identify functionality to AccessoryInformation service
    const identifyCharacteristic = this.accessory.getService(Service.AccessoryInformation)
      ?.getCharacteristic(Characteristic.Identify);

    if (identifyCharacteristic) {
      identifyCharacteristic.onGet(() => {
        this.log.info(`${this.accessory.displayName} occupancy sensor identified!`);
      });
    }

    // Listen for state change events
    this.platform.emitter.on('stateChange', this.setState.bind(this));
  }

  private _isValidEvent(state: string): boolean {
    const playing = PLAY_EVENTS.includes(state);
    const paused = PAUSE_EVENTS.includes(state);

    return playing || paused;
  }

  private _log(): void {
    const active = PLAY_EVENTS.includes(this.state);
    if (active) {
      this.log.info(`[${this.device.name}] is active`);
    } else {
      this.log.info(`[${this.device.name}] is inactive`);
    }
  }

  private getState(): boolean {
    // Return whether the device is active (playing)
    return PLAY_EVENTS.includes(this.state);
  }

  private setState(state: string, uuid: string): void {
    if (uuid !== this.device.uuid || !this._isValidEvent(state)) {
      return;
    }

    const { hap: { Characteristic } } = this.platform;
    this.state = state;
    const isActive = PLAY_EVENTS.includes(this.state);

    // Update the characteristic
    this.service.updateCharacteristic(Characteristic.OccupancyDetected, isActive);
    this._log();
  }
}
