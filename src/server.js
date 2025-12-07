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

    // SAFER DEFAULTS for Homebridge, Docker, and multi-NIC systems
    this.port = get(config, 'server.port', LISTENING_PORT);
    this.address = get(config, 'server.address', '0.0.0.0');

    // Multer for multipart/form-data (Plex sends the 'thumb' file this way)
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

    // === GLOBAL MIDDLEWARE ===============================================

    // Ensure we can read urlencoded bodies if Plex ever sends them this way
    app.use(express.urlencoded({ extended: true }));

    // Also accept JSON (not used by Plex, but improves dev/test)
    app.use(express.json());

    // === ROUTES ===========================================================

    // 1) Main webhook endpoint – Plex sends multipart/form-data
    app.post(
      '/',
      upload.single('thumb'),
      (req, res) => {
        const rawPayload = get(req.body, 'payload', '');

        // Debug logging for troubleshooting
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

    // 2) Optional endpoint: used by Plex testers or manual GET requests
    app.post('/test', (req, res) => {
      log.debug('Received /test POST from Plex or tester.');
      res.sendStatus(200);
    });

    // 3) Landing page
    app.get('/', (_req, res) => {
      res
        .type('html')
        .status(200)
        .send(landingPage(`http://${address}:${port}`));
    });

    // === START SERVER =====================================================

    this.httpServer = app
      .listen(port, address, () => {
        log.info(`Plex Webhooks server listening on http://${address}:${port}`);
      })
      .on('error', this.errorHandler.bind(this));
  }

  /**
   * Called by the Homebridge platform when Homebridge shuts down.
   * Prevents orphaned listeners and "port in use" errors.
   */
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
