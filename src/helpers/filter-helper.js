'use strict';

const { get } = require('lodash');

class FilterHelper {
  constructor(log, payload, filters) {
    this.log = log;
    this.payload = payload || {};
    this.filters = Array.isArray(filters) ? filters : [];
  }

  _matchFilterPair(path, value, operator = '===') {
    const payloadValue = get(this.payload, path);
    const expected = String(value);
    const actual = payloadValue != null ? String(payloadValue) : '';

    let isMatched = false;

    switch (operator) {
      case '!==':
        isMatched = expected !== actual;
        break;
      case '===':
      default:
        isMatched = expected === actual;
    }

    this.log.verbose(
      ` ${isMatched ? '+' : '-'} "${path}": expected "${expected}", got "${actual}"`
    );

    return isMatched;
  }

  _matchFilterArray(filterArr) {
    if (!Array.isArray(filterArr)) return false;

    let allMatch = true;

    for (const rule of filterArr) {
      if (!rule?.path || rule.value === undefined) return false;

      const { path, operator, value } = rule;

      if (!this._matchFilterPair(path, value, operator)) {
        allMatch = false;
        break;
      }
    }

    return allMatch;
  }

  match() {
    if (this.filters.length === 0) {
      this.log.verbose(' > no filters provided → matching by default');
      return true;
    }

    for (let i = 0; i < this.filters.length; i++) {
      const group = this.filters[i];

      this.log.verbose(` > filter group #${i + 1}`);

      if (this._matchFilterArray(group)) {
        return true;
      }
    }

    return false;
  }
}

module.exports = FilterHelper;