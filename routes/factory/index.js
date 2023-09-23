'use strict';

const express = require('express');

const { FACTORY_SECRET } = require('../../config');
const ServerError = require('../../lib/ServerError');
const { promisify } = require('../../lib/Server');
const { Device } = require('../../lib/Database');

module.exports = express()

  // createDevice()
  .post('/', promisify(async req => {
    if (req.query.secret !== FACTORY_SECRET)
      throw new ServerError('Invalid factory secret', 403);

    const {
      id,
      type,
    } = req.body;

    const device = new Device({
      id,
      type,
      origin: 'factory',
    });
    await device.save();
  }))