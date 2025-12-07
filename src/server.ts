// src/WebhooksServer.ts

import express, { Request, Response, NextFunction } from 'express';
import ip from 'ip';
import { get } from 'lodash';
import multer, { Multer } from 'multer';
import { LISTENING_PORT } from './constants';
import landingPage from './landingPage.ts';

// Typing for the callback function parameter
type Callback = (payload: any) => void;

interface WebhooksServerConfig {
  server: {
    port?: number;
    address?: string;
  };
}

class WebhooksServer {
  private log: any;
  private callback: Callback;
  private port: number;
  private address: string;
  private upload: Multer;

  constructor(log: any, config: WebhooksServerConfig, callback: Callback) {
    this.log = log;
    this.callback = callback;

    // Assign port and address from config with fallback to defaults
    this.port = get(config, 'server.port', LISTENING_PORT);
    this.address = get(config, 'server.address', ip.address());

    this.upload = multer({ dest: '/tmp/' });
    // this.upload = multer({ storage: multer.memoryStorage() });
  }

  // Error handler with specific error codes
  private errorHandler(error: any): void {
    const { code, address, port } = error;

    switch (code) {
      case 'EADDRNOTAVAIL':
        this.log.error(`Address not available: ${address}:${port}`);
        break;
      default:
        this.log.error(error.message || error);
    }
  }

  // Launch the server
  public launch(): void {
    const { log, callback, port, address, upload } = this;
    const app = express();

    // Post endpoint for Plex webhooks
    app.post(
      '/',
      upload.single('thumb'),
      express.urlencoded({ extended: true }),
      (req: Request, res: Response) => {
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
    app.get('/', (_req: Request, res: Response) => {
      res.type('html').status(200).send(landingPage(`http://${address}:${port}`));
    });

    // Launch server
    app
      .listen(port, address, () => {
        log.info(`Plex Webhooks server listening at http://${address}:${port}`);
      })
      .on('error', this.errorHandler.bind(this));
  }
}

export = WebhooksServer;
