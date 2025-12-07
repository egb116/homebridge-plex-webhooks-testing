'use strict';

const expandConfig = (api, config) => {
  const sensors = Array.isArray(config?.sensors) ? config.sensors : [];

  const sensorsWithId = sensors.map((sensor, index) => {
    const name = typeof sensor.name === 'string'
      ? sensor.name
      : `Sensor ${index + 1}`;

    // stable ID seed — but DO NOT generate uuid here
    const idSeed = sensor.id || sensor.name;

    return {
      ...sensor,
      name,
      id: idSeed,
    };
  });

  return {
    ...config,
    sensors: sensorsWithId,
  };
};

module.exports = expandConfig;
