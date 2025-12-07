'use strict';

const express = require('express');
const multer = require('multer');
const { get } = require('lodash');
const landingPage = require('./landingPage');
const { LISTENING_PORT } = require('./constants');

class WebhooksServer {
  constructor(log, config, callback) {
    this.log = log;
    this.callback = callback;

    this.port = get(config, 'server.port', LISTENING_PORT);
    this.address = get(config, 'server.address', '0.0.0.0');

    this.upload = multer({ dest: '/tmp/' });

    this.httpServer = null;
  }

  errorHandler(error) {
    const { code, address, port } = error;

    switch (code) {
      case 'EADDRINUSE':
        this.log.error(`Port already in use: ${port}`);
        break;

      case 'EADDRNOTAVAIL':
        this.log.error(`Address not available: ${address}`);
        break;

      case 'EACCES':
        this.log.error(`No permission to bind to ${address}:${port}`);
        break;

      default:
        this.log.error(error.stack || error.message || error);
    }
  }

  launch() {
    const { log, callback, port, address, upload } = this;
    const app = express();

    app.use(express.urlencoded({ extended: true }));

    app.use(express.json());

    app.post(
      '/',
      upload.single('thumb'),
      (req, res) => {
        const rawPayload = get(req.body, 'payload', '');

        log.debug?.(`Raw Plex Payload: ${rawPayload}`);

        if (!rawPayload) {
          log.warn('POST received but no "payload" field present.');
          return res.sendStatus(400);
        }

        let parsed;
        try {
          parsed = JSON.parse(rawPayload);
        } catch (err) {
          log.error(`Failed to parse Plex payload JSON: ${err.message}`);
          return res.sendStatus(400);
        }

        try {
          callback(parsed);
        } catch (err) {
          log.error('Callback (webhook handler) threw an error:', err);
        }

        res.sendStatus(200);
      }
    );

    app.post('/test', (req, res) => {
      log.debug('Received /test POST from Plex or tester.');
      res.sendStatus(200);
    });

    app.get('/', (_req, res) => {
      res
        .type('html')
        .status(200)
        .send(landingPage(`http://${address}:${port}`));
    });

    this.httpServer = app
      .listen(port, address, () => {
        log.info(`Plex Webhooks server listening on http://${address}:${port}`);
      })
      .on('error', this.errorHandler.bind(this));
  }

  close() {
    if (this.httpServer) {
      this.log.info('Shutting down Plex Webhooks server...');
      try {
        this.httpServer.close();
      } catch (err) {
        this.log.error('Error shutting down server:', err);
      }
    }
  }
}

module.exports = WebhooksServer;
