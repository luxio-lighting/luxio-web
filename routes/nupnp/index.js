'use strict';

const debug = require('debug')('LuxioNUPNP');
const express = require('express');
const { promisify } = require('../../lib/Server');
const { Device } = require('../../lib/Database');

module.exports = express()

  // getDevices()
  .get('/', promisify(async (req, res) => {
    const ip = req.query.ip ?? req.headers['fly-client-ip'] ?? req.ip;
    debug('getDevices()', ip);

    const devices = await Device.find({
      ip,
      lastseen: {
        $gte: new Date(new Date().getTime() - 30 * 60000), // 30 minutes ago
      },
    });

    res.header('X-Luxio-IP', ip);

    return devices.reduce((obj, device) => ({
      ...obj,
      [device.id]: device,
    }), {});
  }))

  // syncDevice()
  .post('/', promisify(async req => {
    const ip = req.query.ip ?? req.headers['fly-client-ip'] ?? req.ip;

    debug('syncDevice()', ip);

    const {
      id,
      type, // legacy
      platform,
      address,
      name,
      version,
      pixels,
      wifi_ssid,
    } = req.body;

    await Device.findOneAndUpdate({
      id,
    }, {
      id,
      address,
      name,
      version,
      pixels,
      wifi_ssid,
      ip,
      lastseen: new Date(),
      platform: String(platform || type).toLowerCase(),
    }, {
      upsert: true,
      setDefaultsOnInsert: true,
    });

  }))