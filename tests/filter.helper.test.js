const beforeEach = require('mocha').beforeEach;
const describe = require('mocha').describe;
const it = require('mocha').it;
const chai = require('chai');
const assert = require('chai').assert;
const expect = require('chai').expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const FilterHelper = require('../src/helpers/filter-helper');
const payload1 = require('./data/payload_1.json');
const payload2 = require('./data/payload_2.json');
const payload3 = require('./data/payload_3.json');
const config = require('./data/config.json');
const configEmpty = require('./data/config_empty.json');

chai.should();
chai.use(sinonChai);

describe('Filter helper\'s', function() {
  it('constructor should instatiate', function() {
    const filterHelper = new FilterHelper({ verbose: () => {} });

    assert.ok(filterHelper instanceof FilterHelper);
  });

  describe('_matchFilterPair function', function() {
    const log = {};

    beforeEach(() => {
      log.verbose = sinon.spy();
    });

    it('should find movie at Metadata.librarySectionType in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1);
      const result = filterHelper._matchFilterPair('Metadata.librarySectionType', 'movie');
      assert.equal(result, true);
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "movie" at "Metadata.librarySectionType", found "movie"'
      );
    });

    it('shouldn\'t find show at Metadata.librarySectionType in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1);
      const result = filterHelper._matchFilterPair('Metadata.librarySectionType', 'show');
      expect(result).to.equal(false);
      expect(log.verbose).to.have.been.calledWith(
        ' - looking for "show" at "Metadata.librarySectionType", found "movie"'
      );
    });

    it('should find Apple TV at Player.title in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1);
      const result = filterHelper._matchFilterPair('Player.title', 'Apple TV');
      assert.equal(result, true);
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "Apple TV" at "Player.title", found "Apple TV"'
      );
    });

    it('shouldn\'t find Safari at Player.title in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1);
      const result = filterHelper._matchFilterPair('Player.title', 'Safari');
      assert.equal(result, false);
      expect(log.verbose).to.have.been.calledWith(
        ' - looking for "Safari" at "Player.title", found "Apple TV"'
      );
    });

    it('should find show at Metadata.librarySectionType in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2);
      const result = filterHelper._matchFilterPair('Metadata.librarySectionType', 'show');
      assert.equal(result, true);
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "show" at "Metadata.librarySectionType", found "show"'
      );
    });

    it('shouldn\'t find movie at Metadata.librarySectionType in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2);
      const result = filterHelper._matchFilterPair('Metadata.librarySectionType', 'movie');
      expect(result).to.equal(false);
      expect(log.verbose).to.have.been.calledWith(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
    });

    it('should find Safari at Player.title in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2);
      const result = filterHelper._matchFilterPair('Player.title', 'Safari');
      assert.equal(result, true);
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "Safari" at "Player.title", found "Safari"'
      );
    });

    it('shouldn\'t find Apple TV at Player.title in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2);
      const result = filterHelper._matchFilterPair('Player.title', 'Apple TV');
      assert.equal(result, false);
      expect(log.verbose).to.have.been.calledWith(
        ' - looking for "Apple TV" at "Player.title", found "Safari"'
      );
    });

    it('should match when Player.title is not Apple TV in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2);
      const result = filterHelper._matchFilterPair('Player.title', 'Apple TV', '!==');
      assert.equal(result, true);
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "Apple TV" at "Player.title", found "Safari"'
      );
    });
  });

  describe('_matchFilterArray function', function() {
    const log = {};

    beforeEach(() => {
      log.verbose = sinon.spy();
    });

    it('should found a match in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1);
      const result = filterHelper._matchFilterArray(config.sensors[0].filters[1]);

      expect(result).to.equal(true);
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "movie" at "Metadata.librarySectionType", found "movie"'
      );
      expect(log.verbose).to.have.been.calledWith(
        ' + looking for "Apple TV" at "Player.title", found "Apple TV"'
      );
    });

    it('shouldn\'t found a match in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2);
      const result = filterHelper._matchFilterArray(config.sensors[0].filters[1]);

      expect(result).to.equal(false);
      expect(log.verbose).to.have.been.calledWith(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
    });

    it('shouldn\'t found a match in payload #3', function() {
      const filterHelper = new FilterHelper(log, payload3);
      const result = filterHelper._matchFilterArray(config.sensors[0].filters[1]);

      expect(result).to.equal(false);
      expect(log.verbose).to.have.been.calledWith(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
    });
  });

  describe('match function for sensor #1', function() {
    const log = {};

    beforeEach(() => {
      log.verbose = sinon.spy();
    });

    it('should find a match in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1, config.sensors[0].filters);
      const result = filterHelper.match();

      expect(result).to.equal(true);
      // Group 1 Start
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #1');
      // Group 1 Rule 1 (Matches)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' + looking for "movie" at "Metadata.librarySectionType", found "movie"'
      );
      // Group 1 Rule 2 (Fails)
      expect(log.verbose.getCall(2).args[0]).to.equal(
        ' - looking for "Safari" at "Player.title", found "Apple TV"'
      );
      // Group 2 Start (The array match in Group 1 failed, so it proceeds to Group 2)
      expect(log.verbose.getCall(3).args[0]).to.equal(' > filter group #2');
      // Group 2 Rule 1 (Matches)
      expect(log.verbose.getCall(4).args[0]).to.equal(
        ' + looking for "movie" at "Metadata.librarySectionType", found "movie"'
      );
      // Group 2 Rule 2 (Matches - returns true and stops)
      expect(log.verbose.getCall(5).args[0]).to.equal(
        ' + looking for "Apple TV" at "Player.title", found "Apple TV"'
      );
    });

    it('shouldn\'t find a match in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2, config.sensors[0].filters);
      const result = filterHelper.match();

      expect(result).to.equal(false);
      // Group 1 Start
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #1');
      // Group 1 Rule 1 (Fails - short circuits)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
      // Group 2 Start (The array match in Group 1 failed, so it proceeds to Group 2)
      expect(log.verbose.getCall(2).args[0]).to.equal(' > filter group #2');
      // Group 2 Rule 1 (Fails - short circuits)
      expect(log.verbose.getCall(3).args[0]).to.equal(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
      // Only 4 calls total
      expect(log.verbose.callCount).to.equal(4);
    });

    it('shouldn\'t find a match in payload #3', function() {
      const filterHelper = new FilterHelper(log, payload3, config.sensors[0].filters);
      const result = filterHelper.match();

      expect(result).to.equal(false);
      // Group 1 Start
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #1');
      // Group 1 Rule 1 (Fails - short circuits)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
      // Group 2 Start (The array match in Group 1 failed, so it proceeds to Group 2)
      expect(log.verbose.getCall(2).args[0]).to.equal(' > filter group #2');
      // Group 2 Rule 1 (Fails - short circuits)
      expect(log.verbose.getCall(3).args[0]).to.equal(
        ' - looking for "movie" at "Metadata.librarySectionType", found "show"'
      );
      // Only 4 calls total
      expect(log.verbose.callCount).to.equal(4);
    });
  });

  describe('match function for sensor #2', function() {
    const log = {};

    beforeEach(() => {
      log.verbose = sinon.spy();
    });

    it('shouldn\'t find a match in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1, config.sensors[1].filters);
      const result = filterHelper.match();

      expect(result).to.equal(false);
      // Group 1 Start
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #1');
      // Group 1 Rule 1 (Fails - short circuits)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' - looking for "show" at "Metadata.librarySectionType", found "movie"'
      );
      expect(log.verbose.callCount).to.equal(2);
    });

    it('shouldn\'t find a match in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2, config.sensors[1].filters);
      const result = filterHelper.match();

      expect(result).to.equal(false);
      // Group 1 Start
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #1');
      // Group 1 Rule 1 (Matches)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' + looking for "show" at "Metadata.librarySectionType", found "show"'
      );
      // Group 1 Rule 2 (Fails - returns false and stops)
      expect(log.verbose.getCall(2).args[0]).to.equal(
        ' - looking for "Roku" at "Player.title", found "Safari"'
      );
      expect(log.verbose.callCount).to.equal(3);
    });

    it('should find a match in payload #3', function() {
      const filterHelper = new FilterHelper(log, payload3, config.sensors[1].filters);
      const result = filterHelper.match();

      expect(result).to.equal(true);
      // Group 1 Start
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #1');
      // Group 1 Rule 1 (Matches)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' + looking for "show" at "Metadata.librarySectionType", found "show"'
      );
      // Group 1 Rule 2 (Matches - returns true and stops)
      expect(log.verbose.getCall(2).args[0]).to.equal(
        ' + looking for "Roku" at "Player.title", found "Roku"'
      );
    });
  });

  describe('match function for sensor #3', function() {
    const log = {};

    beforeEach(() => {
      log.verbose = sinon.spy();
    });

    it('shouldn\'t find a match in payload #1', function() {
      const filterHelper = new FilterHelper(log, payload1, config.sensors[2].filters);
      const result = filterHelper.match();

      expect(result).to.equal(false);
      // Group 2 Start (The first group was null and skipped)
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #2');
      // Group 2 Rule 1 (Fails - short circuits)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' - looking for "show" at "Metadata.librarySectionType", found "movie"'
      );
      expect(log.verbose.callCount).to.equal(2);
    });

    it('shouldn\'t find a match in payload #2', function() {
      const filterHelper = new FilterHelper(log, payload2, config.sensors[2].filters);
      const result = filterHelper.match();

      expect(result).to.equal(false);
      // Group 2 Start (The first group was null and skipped)
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #2');
      // Group 2 Rule 1 (Matches)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' + looking for "show" at "Metadata.librarySectionType", found "show"'
      );
      // Group 2 Rule 2 (Fails)
      expect(log.verbose.getCall(2).args[0]).to.equal(
        ' - looking for "Roku" at "Player.title", found "Safari"'
      );
    });

    it('should find a match in payload #3', function() {
      const filterHelper = new FilterHelper(log, payload3, config.sensors[2].filters);
      const result = filterHelper.match();

      expect(result).to.equal(true);
      // Group 2 Start (The first group was null and skipped)
      expect(log.verbose.getCall(0).args[0]).to.equal(' > filter group #2');
      // Group 2 Rule 1 (Matches)
      expect(log.verbose.getCall(1).args[0]).to.equal(
        ' + looking for "show" at "Metadata.librarySectionType", found "show"'
      );
      // Group 2 Rule 2 (Matches)
      expect(log.verbose.getCall(2).args[0]).to.equal(
        ' + looking for "Roku" at "Player.title", found "Roku"'
      );
    });
  });

  describe('match function for sensor without filters', function() {
    const log = {};

    beforeEach(() => {
      log.verbose = sinon.spy();
    });

    it('should return true', function() {
      const filterHelper = new FilterHelper(log, payload1, configEmpty.sensors[0].filters);
      const result = filterHelper.match();

      expect(result).to.equal(true);
      expect(log.verbose.getCall(0).args[0]).to.equal(
        ' > no filters provided → matching by default'
      );
    });
  });
});