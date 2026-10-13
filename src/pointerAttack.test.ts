import {describe, expect, it} from 'vitest';
import {pointerDownAttacks} from './pointerAttack';

describe('pointerDownAttacks', () => {
  it('does not allow mouse pointerdown to attack when pointer is unlocked', () => {
    expect(pointerDownAttacks({pointerType: 'mouse', pointerLocked: false})).toBe(false);
  });

  it('allows mouse pointerdown to attack when pointer is locked', () => {
    expect(pointerDownAttacks({pointerType: 'mouse', pointerLocked: true})).toBe(true);
  });

  it('does not allow pen pointerdown to attack when pointer is unlocked', () => {
    expect(pointerDownAttacks({pointerType: 'pen', pointerLocked: false})).toBe(false);
  });

  it('allows pen pointerdown to attack when pointer is locked', () => {
    expect(pointerDownAttacks({pointerType: 'pen', pointerLocked: true})).toBe(true);
  });

  it('always allows touch pointerdown to attack regardless of lock state', () => {
    expect(pointerDownAttacks({pointerType: 'touch', pointerLocked: false})).toBe(true);
    expect(pointerDownAttacks({pointerType: 'touch', pointerLocked: true})).toBe(true);
  });

  it('defaults to locked state requirement for unknown or empty pointer types', () => {
    expect(pointerDownAttacks({pointerType: '', pointerLocked: false})).toBe(false);
    expect(pointerDownAttacks({pointerType: '', pointerLocked: true})).toBe(true);
  });
});
