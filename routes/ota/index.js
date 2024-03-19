'use strict';

const debug = require('debug')('LuxioOTA');
const express = require('express');
const multer = require('multer');
const createMD5 = require('md5');

const { OTA_SECRET, PLATFORMS } = require('../../config');
const ServerError = require('../../lib/ServerError');
const { promisify } = require('../../lib/Server');
const { Device, Update } = require('../../lib/Database');

const upload = multer();

module.exports = express()

  // getUpdates()
  .get('/', promisify(async (req, res) => {
    const version = parseInt(req.query.version ?? req.header('x-esp8266-version'));
    const id = req.query.id;

    debug('getUpdates()', id, version, req.query);

    if (isNaN(version))
      throw new ServerError('invalid_version', 400);

    if (!id)
      throw new ServerError('invalid_id', 400);;

    let channel = 0;
    const device = await Device.findOne({ id });
    if (device) {
      channel = device.channel;
    }

    const platform = String(req.query.platform).toUpperCase();
    if (!PLATFORMS.includes(platform))
      throw new ServerError('invalid_platform', 400);

    const update = await Update.findOne({
      platform,
      version: {
        $gt: version,
      },
      channel: {
        $lte: channel,
      },
    }, null, {
      sort: {
        version: -1,
      },
    });

    if (!update)
      return res.status(304).end();

    debug(`Serving Update ${update.platform}${update.version}[${update.channel}] to ${id}@${platform}${version}[${channel}]`);
    res.header('Content-Transfer-Encoding', 'binary');
    res.header('Content-Disposition', `attachment; filename=${update.platform}${update.version}`);
    res.header('X-Powered-By', 'Luxio');
    res.header('X-Luxio-Version', update.version);
    res.header('x-MD5', update.md5);
    res.send(update.data);
  }))

  // createUpdate()
  .post('/', upload.single('data'), promisify(async req => {
    if (req.query.secret !== OTA_SECRET)
      throw new Error('Invalid ota secret');

    const {
      platform,
      version,
      md5,
    } = req.body;

    const {
      buffer: data,
    } = req.file;

    const hash = createMD5(data);
    if (hash !== md5)
      throw new ServerError('Invalid MD5', 400);

    const update = new Update({
      platform,
      version,
      data,
      md5,
    });

    await update.save();
  }));