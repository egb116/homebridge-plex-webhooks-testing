const {
  PKG_AUTHOR,
  PKG_NAME,
  PKG_VERSION,
  PLAY_EVENTS,
  PAUSE_EVENTS
} = require('./constants');

class PlexWebhooksPlatformAccessory {
  constructor(platform, accessory, sensor) {
    const { Service, Characteristic } = platform.api.hap;

    this.platform = platform;
    this.accessory = accessory;
    this.sensor = sensor;
    this.log = platform.log;

    // Ensure context is up-to-date
    this.accessory.context.sensor = sensor;

    // Set default internal state
    this.state = 'media.stop';

    /**
     * ----- ACCESSORY INFORMATION -----
     */
    const info = this.accessory.getService(Service.AccessoryInformation);

    info
      .setCharacteristic(Characteristic.Manufacturer, PKG_AUTHOR)
      .setCharacteristic(Characteristic.Model, PKG_NAME)
      .setCharacteristic(Characteristic.FirmwareRevision, PKG_VERSION)
      .setCharacteristic(Characteristic.SerialNumber, sensor.serial);

    /**
     * ----- OCCUPANCY SENSOR SERVICE -----
     */
    this.service =
      this.accessory.getService(Service.OccupancySensor) ||
      this.accessory.addService(Service.OccupancySensor);

    this.service.setCharacteristic(Characteristic.Name, sensor.name);

    this.service
      .getCharacteristic(Characteristic.OccupancyDetected)
      .onGet(() => this.getState());

    /**
     * ----- IDENTIFY HANDLER (correct way) -----
     */
    this.accessory.on('identify', () => {
      this.log.info(`${this.accessory.displayName} identified`);
    });

    /**
     * ----- STATE CHANGE EVENT LISTENER -----
     */
    platform.emitter.on('stateChange', this.setState.bind(this));
  }

  _isValidEvent(eventName) {
    return PLAY_EVENTS.includes(eventName) || PAUSE_EVENTS.includes(eventName);
  }

  _logState() {
    const active = PLAY_EVENTS.includes(this.state);
    this.log.info(`[${this.sensor.name}] is ${active ? 'active' : 'inactive'}`);
  }

  getState() {
    return PLAY_EVENTS.includes(this.state);
  }

  setState(eventName, targetUuid) {
    if (targetUuid !== this.sensor.uuid) {
      return;
    }

    if (!this._isValidEvent(eventName)) {
      return;
    }

    const { Characteristic } = this.platform.api.hap;

    this.state = eventName;

    this.service.updateCharacteristic(
      Characteristic.OccupancyDetected,
      this.getState()
    );

    this._logState();
  }
}

module.exports = PlexWebhooksPlatformAccessory;
