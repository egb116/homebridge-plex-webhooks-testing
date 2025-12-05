'use strict';

const express = require('express');
const ip = require('ip');
const { get } = require('lodash');
const multer = require('multer');
const landingPage = require('./landingPage');
const { LISTENING_PORT } = require('./constants');

class WebhooksServer {
  constructor(log, config, callback) {
    this.log = log;
    this.callback = callback;

    this.port = get(config, 'server.port', LISTENING_PORT);
    this.address = get(config, 'server.address', ip.address());

    this.upload = multer({ dest: '/tmp/' });
    // this.upload = multer({ storage: multer.memoryStorage() });
  }

  errorHandler(error) {
    const { code, address, port } = error;

    switch (code) {
      case 'EADDRNOTAVAIL':
        this.log.error(`Address not available: ${address}:${port}`);
        break;
      default:
        this.log.error(error.message || error);
    }
  }

  launch() {
    const { log, callback, port, address, upload } = this;
    const app = express();
    
    // Post endpoint for Plex webhooks
    app.post(
      '/',
      upload.single('thumb'),
      express.urlencoded({ extended: true }),
      (req, res) => {
        const rawPayload = get(req.body, 'payload', '');

        log.debug?.(`Raw Plex Payload: ${rawPayload}`);

        if (!rawPayload) {
          log.warn('Received POST without payload field.');
          return res.sendStatus(400);
        }

        let parsed;
        try {
          parsed = JSON.parse(rawPayload);
        } catch (err) {
          log.error('Failed to parse Plex payload JSON:', err.message);
          return res.sendStatus(400);
        }

        try {
          callback(parsed);
        } catch (err) {
          log.error('Webhook handler threw error:', err);
        }

        res.sendStatus(200);
      }
    );

    // Landing page
    app.get('/', (_req, res) => {
      res.type('html').status(200).send(
        landingPage(`http://${address}:${port}`)
      );
    });

    // Launch server
    app
      .listen(port, address, () => {
        log.info(`Plex Webhooks server listening at http://${address}:${port}`);
      })
      .on('error', this.errorHandler.bind(this));
  }
}

module.exports = WebhooksServer;
