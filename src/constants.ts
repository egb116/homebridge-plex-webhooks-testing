// src/constants.ts

import { author, name, version } from '../package.json';

export const PKG_AUTHOR: string = author;
export const PKG_NAME: string = name;
export const PKG_VERSION: string = version;

export const LISTENING_PORT: number = 32401;

export const PLAY_EVENTS: ReadonlyArray<string> = Object.freeze([
  'media.play',
  'media.resume',
]);

export const PAUSE_EVENTS: ReadonlyArray<string> = Object.freeze([
  'media.pause',
  'media.stop',
]);
