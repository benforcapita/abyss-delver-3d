import {afterEach, describe, expect, it} from 'vitest';
import {debugCheats, isDebugEnabled} from './debug';

describe('isDebugEnabled', () => {
  describe('DEV on/off', () => {
    it('returns true when DEV is on regardless of query string', () => {
      expect(isDebugEnabled('', true)).toBe(true);
      expect(isDebugEnabled('?debug=0', true)).toBe(true);
      expect(isDebugEnabled('?debug=true', true)).toBe(true);
      expect(isDebugEnabled('?foo=bar', true)).toBe(true);
    });

    it('returns false when DEV is off and query string is empty', () => {
      expect(isDebugEnabled('', false)).toBe(false);
    });
  });

  describe('flag on/off', () => {
    it('returns true when debug=1 is present (with leading ?)', () => {
      expect(isDebugEnabled('?debug=1', false)).toBe(true);
    });

    it('returns true when debug=1 is present (without leading ?)', () => {
      expect(isDebugEnabled('debug=1', false)).toBe(true);
    });

    it('returns false when debug flag is omitted', () => {
      expect(isDebugEnabled('', false)).toBe(false);
      expect(isDebugEnabled('?foo=bar', false)).toBe(false);
    });
  });

  describe('other params', () => {
    it('returns true when debug=1 is combined with other params', () => {
      expect(isDebugEnabled('?foo=bar&debug=1', false)).toBe(true);
      expect(isDebugEnabled('?debug=1&foo=bar', false)).toBe(true);
      expect(isDebugEnabled('?a=1&debug=1&b=2', false)).toBe(true);
    });

    it('returns false when other params are present without debug=1', () => {
      expect(isDebugEnabled('?foo=bar&baz=qux', false)).toBe(false);
      expect(isDebugEnabled('?foo=1', false)).toBe(false);
    });
  });

  describe('debug=0', () => {
    it('returns false when debug=0', () => {
      expect(isDebugEnabled('?debug=0', false)).toBe(false);
      expect(isDebugEnabled('debug=0', false)).toBe(false);
      expect(isDebugEnabled('?foo=bar&debug=0', false)).toBe(false);
    });
  });

  describe('debug=true', () => {
    it('returns false when debug=true', () => {
      expect(isDebugEnabled('?debug=true', false)).toBe(false);
      expect(isDebugEnabled('debug=true', false)).toBe(false);
      expect(isDebugEnabled('?foo=1&debug=true', false)).toBe(false);
    });
  });

  describe('empty', () => {
    it('returns false for empty query strings and empty debug values', () => {
      expect(isDebugEnabled('', false)).toBe(false);
      expect(isDebugEnabled('?', false)).toBe(false);
      expect(isDebugEnabled('?debug=', false)).toBe(false);
      expect(isDebugEnabled('?debug', false)).toBe(false);
    });
  });
});

describe('debugCheats', () => {
  afterEach(() => {
    debugCheats.godMode = false;
    debugCheats.killBossRequested = false;
  });

  it('defaults to inert/false values', () => {
    expect(debugCheats.godMode).toBe(false);
    expect(debugCheats.killBossRequested).toBe(false);
  });

  it('allows mutation of cheat flags', () => {
    debugCheats.godMode = true;
    expect(debugCheats.godMode).toBe(true);

    debugCheats.killBossRequested = true;
    expect(debugCheats.killBossRequested).toBe(true);
  });
});
