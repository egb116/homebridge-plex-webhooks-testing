import { Logging } from 'homebridge';
import { get } from 'lodash';

// Define types for filter rule
interface FilterRule {
  path: string;
  value: any;
  operator?: '===' | '!==' | string; // Default to '==='
}

type FilterGroup = FilterRule[];

class FilterHelper {
  private log: Logging;
  private payload: Record<string, any>;
  private filters: FilterGroup[];

  constructor(log: Logging, payload: Record<string, any>, filters: FilterGroup | undefined) {
    this.log = log;
    this.payload = payload || {};
    this.filters = Array.isArray(filters) ? filters : [];
  }

  private _matchFilterPair(path: string, value: any, operator: string = '==='): boolean {
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

  private _matchFilterArray(filterArr: FilterGroup): boolean {
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

  public match(): boolean {
    if (this.filters.length === 0) {
      this.log.verbose(' > no filters provided → matching by default');
      return true;
    }

    // At least one filter group must match (OR logic)
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

export = FilterHelper;
