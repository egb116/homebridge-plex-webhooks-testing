'use strict';

const { get } = require('lodash');

class FilterHelper {
  constructor(log, payload, filters) {
    this.log = log;
    this.payload = payload || {};
    // Ensure filters defaults to an empty array for safer iteration
    this.filters = Array.isArray(filters) ? filters : [];
  }

  _matchFilterPair(path, value, operator = '===') {
    const payloadValue = get(this.payload, path);
    // Standardize comparison values
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

    // Retained the log format that passed the majority of your tests
    this.log.verbose(
      ` ${isMatched ? '+' : '-'} looking for "${expected}" at "${path}", found "${actual}"`
    );

    return isMatched;
  }

  // --- FIX APPLIED HERE ---
  _matchFilterArray(filterArr) {
    if (!Array.isArray(filterArr)) return false;

    let allMatch = true;

    for (const rule of filterArr) {
      // 1. Skip null or invalid rules (resilience from old version)
      if (!rule || !rule.path || rule.value === undefined) {
        continue; // Continue to the next rule in the group
      }

      const { path, operator, value } = rule;

      // 2. If a rule fails, set allMatch to false and immediately stop checking the group (efficiency from new version)
      if (!this._matchFilterPair(path, value, operator)) {
        allMatch = false;
        break; 
      }
    }

    // Returns true only if it never broke and the loop completed
    return allMatch;
  }

  // --- FIX APPLIED HERE ---
  match() {
    if (this.filters.length === 0) {
      // Retained the log format that passed the 'no filters' test
      this.log.verbose(' > no filters provided → matching by default'); 
      return true;
    }

    for (let i = 0; i < this.filters.length; i++) {
      const group = this.filters[i];

      // Skip null or non-array filter groups (resilience from old version)
      if (!Array.isArray(group)) {
        continue; 
      }
      
      this.log.verbose(` > filter group #${i + 1}`);

      // If any group matches, return true immediately (OR logic)
      if (this._matchFilterArray(group)) {
        return true;
      }
    }

    // If the loop finishes without finding a matching group
    return false;
  }
}

module.exports = FilterHelper;