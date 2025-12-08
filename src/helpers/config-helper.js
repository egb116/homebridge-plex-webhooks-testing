'use strict';

const expandConfig = (api, config) => {
  const { hap } = api;
  const sensors = Array.isArray(config?.sensors) ? config.sensors : [];

  const sensorsWithUuid = sensors.map((sensor, index) => {
    const name = typeof sensor.name === 'string' ? sensor.name : `Sensor ${index + 1}`;

    const idSeed = sensor.id || sensor.name || index;

    const uuid = hap.uuid.generate(`plex-webhook-sensor:${idSeed}`);

    const serial = hap.uuid.toShortForm(uuid);

    return {
      ...sensor,
      name,
      id: idSeed,
      uuid,
      serial
    };
  });

  return {
    ...config,
    sensors: sensorsWithUuid
  };
};

module.exports = expandConfig;