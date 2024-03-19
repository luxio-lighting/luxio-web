'use strict';

module.exports.PORT = process.env.PORT || 4000;
module.exports.MONGO_URI = process.env.MONGO_URI;
module.exports.OTA_SECRET = process.env.OTA_SECRET;
module.exports.FACTORY_SECRET = process.env.FACTORY_SECRET;
module.exports.CHANNELS = {
  'STABLE': 0,
  'BETA': 1,
  'ALPHA': 2,
};
module.exports.PLATFORMS = ['WEMOS', 'LUXIO', 'ESP8266', 'ESP32'];
module.exports.ORIGINS = ['nupnp', 'factory'];