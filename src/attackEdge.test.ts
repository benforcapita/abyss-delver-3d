import {describe, expect, it} from 'vitest';
import {pointerDownStartsAttack} from './attackEdge';

describe('pointerDownStartsAttack', () => {
  it('returns false for touch events', () => {
    expect(pointerDownStartsAttack('touch')).toBe(false);
  });

  it('returns true for mouse events', () => {
    expect(pointerDownStartsAttack('mouse')).toBe(true);
  });

  it('returns true for pen events', () => {
    expect(pointerDownStartsAttack('pen')).toBe(true);
  });
});
