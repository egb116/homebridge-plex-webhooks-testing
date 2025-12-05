'use strict';

const expandConfig = (api, config) => {
  const { hap } = api;
  const { sensors = [] } = config || {};

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

module.exports = expandConfig;
