import { describe, expect, it } from 'vitest';
import { createOneShotLatch } from './floorLatch';

describe('floorLatch - createOneShotLatch', () => {
  it('returns true exactly once over many calls until reset', () => {
    const latch = createOneShotLatch();
    expect(latch.fired()).toBe(false);

    expect(latch.tryFire()).toBe(true);
    expect(latch.fired()).toBe(true);

    for (let i = 0; i < 100; i++) {
      expect(latch.tryFire()).toBe(false);
      expect(latch.fired()).toBe(true);
    }
  });

  it('returns true again once after reset over many calls', () => {
    const latch = createOneShotLatch();

    expect(latch.tryFire()).toBe(true);
    for (let i = 0; i < 50; i++) {
      expect(latch.tryFire()).toBe(false);
    }
    expect(latch.fired()).toBe(true);

    latch.reset();
    expect(latch.fired()).toBe(false);

    expect(latch.tryFire()).toBe(true);
    for (let i = 0; i < 50; i++) {
      expect(latch.tryFire()).toBe(false);
    }
    expect(latch.fired()).toBe(true);
  });

  it('supports multiple reset and fire cycles', () => {
    const latch = createOneShotLatch();

    for (let cycle = 0; cycle < 5; cycle++) {
      expect(latch.fired()).toBe(false);
      expect(latch.tryFire()).toBe(true);
      expect(latch.fired()).toBe(true);
      expect(latch.tryFire()).toBe(false);
      latch.reset();
    }
  });

  it('calling reset on unfired latch keeps it unfired', () => {
    const latch = createOneShotLatch();
    expect(latch.fired()).toBe(false);
    latch.reset();
    expect(latch.fired()).toBe(false);
    expect(latch.tryFire()).toBe(true);
  });
});
