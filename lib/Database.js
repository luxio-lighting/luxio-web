'use strict';

const debug = require('debug')('Database');
const mongoose = require('mongoose');
const { MONGO_URI, CHANNELS, PLATFORMS, ORIGINS } = require('../config');

module.exports = class Database {

  constructor() {
    debug(`Connecting...`);
    mongoose.connect(MONGO_URI)
      .then(() => debug(`Connected to ${MONGO_URI}`))
      .catch(err => {
        debug(`Error connecting: ${err.message}`);
        process.exit(1);
      });
  }

}

const DeviceSchema = mongoose.Schema({
  id: {
    type: String,
    index: true,
    required: true,
  },
  origin: {
    type: String,
    default: 'nupnp',
    enum: ORIGINS,
    required: true,
  },
  ip: {
    type: String,
  },
  lastseen: {
    type: Date,
    default: Date.now,
    required: true,
  },
  platform: {
    type: String,
    enum: PLATFORMS,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  version: {
    type: Number,
    required: true,
  },
  pixels: {
    type: Number,
    required: true,
  },
  wifi_ssid: {
    type: String,
  },
  channel: {
    type: Number,
    enum: [
      CHANNELS.STABLE,
      CHANNELS.BETA,
      CHANNELS.ALPHA,
    ],
    default: CHANNELS.STABLE,
  },
  notes: {
    type: String,
  },
}, {
  toJSON: {
    transform: doc => {
      return {
        id: doc.id,
        ip: doc.ip,
        lastseen: doc.lastseen,
        channel: Object.keys(CHANNELS)[Object.values(CHANNELS).findIndex(i => i === doc.channel)].toLowerCase(),
        type: doc.type,
        address: doc.address,
        name: doc.name,
        version: doc.version,
        pixels: doc.pixels,
        wifi_ssid: doc.wifi_ssid,
      };
    },
  },
});

const UpdateSchema = mongoose.Schema({
  version: {
    type: Number,
    required: true,
  },
  platform: {
    type: String,
    default: 'wemos',
    enum: PLATFORMS,
    required: true,
  },
  channel: {
    type: Number,
    enum: [
      CHANNELS.STABLE,
      CHANNELS.BETA,
      CHANNELS.ALPHA,
    ],
    default: CHANNELS.ALPHA,
    required: true,
  },
  md5: {
    type: String,
    required: true,
  },
  data: {
    type: Buffer,
    required: true,
  },
});

module.exports.Device = mongoose.model('Device', DeviceSchema, 'Device');
module.exports.Update = mongoose.model('Update', UpdateSchema, 'Update');
