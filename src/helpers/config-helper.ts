import { API } from 'homebridge';

interface SensorConfig {
  name: string | undefined;
  uuid?: string;
  sn?: string;
  [key: string]: any; // Allows other properties to be part of the sensor config
}

interface PlatformConfig {
  sensors?: SensorConfig[];
  [key: string]: any; // Allows other properties to be part of the platform config
}

const expandConfig = (api: API, config: PlatformConfig): PlatformConfig => {
  const { hap } = api;
  const { sensors = [] } = config;

  const sensorsWithUuid = sensors.map((sensor) => {
    const name = typeof sensor.name === 'string'
      ? sensor.name
      : String(sensor.name ?? 'Unnamed Sensor');

    // UUID must be stable -> only name determines identity
    const sensorUuid = hap.uuid.generate(`plex-webhook-sensor:${name}`);
    const shortSensorUuid = hap.uuid.toShortForm(sensorUuid);

    return {
      ...sensor,
      name,
      uuid: sensorUuid,
      sn: shortSensorUuid
    };
  });

  return {
    ...config,
    sensors: sensorsWithUuid
  };
};

export = expandConfig;
