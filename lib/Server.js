'use strict';

const path = require('path');
const debug = require('debug')('Server');
const express = require('express');
const subdomain = require('express-subdomain');
const cors = require('cors');

const { PORT } = require('../config');
const { Device } = require('../lib/Database');

module.exports = class Server {

  constructor() {
    this.app = express();

    // Middleware
    this.app.set('trust proxy', true);
    this.app.set('x-powered-by', 'Luxio');
    this.app.use(cors({
      origin: '*', // Allow all origins
      exposedHeaders: '*', // Expose all headers
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({
      extended: true,
    }));
    this.app.use((req, res, next) => {
      res.header('Cache-Control', 'no-cache');
      next();
    });

    // Serve nupnp.luxio.lighting
    this.app.use(subdomain('nupnp', require('../routes/nupnp')));
    this.app.use('/nupnp', require('../routes/nupnp'));

    // Serve ota.luxio.lighting
    this.app.use(subdomain('ota', require('../routes/ota')));
    this.app.use('/ota', require('../routes/ota'));

    // Serve factory.luxio.lighting
    this.app.use(subdomain('factory', require('../routes/factory')));
    this.app.use('/factory', require('../routes/factory'));

    // Serve flash.luxio.lighting
    this.app.use(subdomain('flash', express.static(path.join(__dirname, '..', 'routes', 'flash'))));
    this.app.use('/flash', express.static(path.join(__dirname, '..', 'routes', 'flash')));

    // Serve studio.luxio.lighting
    this.app.use(subdomain('studio', express.static(path.join(__dirname, '..', 'routes', 'studio'))));
    this.app.use('/studio', express.static(path.join(__dirname, '..', 'routes', 'studio')));

    // Serve luxio.lighting
    this.app.use('/', express.static(path.join(__dirname, '..', 'routes', 'www')));

    // Start the server
    this.app.listen(PORT, () => {
      debug(`Listening on port ${PORT}`);
    });
  }

  static promisify(fn) {
    return (req, res, next) => {
      Promise.resolve().then(async () => {
        const result = await fn(req, res, next);

        if (res.headersSent) return;

        if (typeof result === 'undefined')
          return res.status(204).end();

        res.json(result);
      }).catch(err => {
        debug(err)
        if (res.headersSent) return;
        res.status(err.statusCode || 500).json({
          error: err.message || err.toString(),
        });
      })
    }
  }

}