import {describe, expect, it} from 'vitest';
import {
  LOW_HP_THRESHOLD,
  VIGNETTE_MAX_OPACITY,
  VIGNETTE_PULSE_MS,
  applyLowHpVignette,
  vignetteIntensity,
  vignettePaint,
} from './lowHpVignette';

describe('vignette intensity curve', () => {
  it('stays off at and above about 30% HP', () => {
    expect(LOW_HP_THRESHOLD).toBeCloseTo(0.3);
    expect(vignetteIntensity(30, 100)).toBe(0);
    expect(vignetteIntensity(31, 100)).toBe(0);
    expect(vignetteIntensity(100, 100)).toBe(0);
    expect(vignetteIntensity(0.3, 1)).toBe(0);
  });

  it('fades in below the threshold and is strongest at 0 HP', () => {
    const at25 = vignetteIntensity(25, 100);
    const at15 = vignetteIntensity(15, 100);
    const at5 = vignetteIntensity(5, 100);
    const at0 = vignetteIntensity(0, 100);

    expect(at25).toBeGreaterThan(0);
    expect(at15).toBeGreaterThan(at25);
    expect(at5).toBeGreaterThan(at15);
    expect(at0).toBeGreaterThan(at5);
    expect(at0).toBe(1);
  });

  it('grows the red edge as HP falls', () => {
    const mild = vignettePaint(25, 100, false);
    const dire = vignettePaint(5, 100, false);

    expect(dire.intensity).toBeGreaterThan(mild.intensity);
    expect(dire.opacity).toBeGreaterThan(mild.opacity);
    expect(dire.opacity).toBeCloseTo(dire.intensity * VIGNETTE_MAX_OPACITY);
    expect(dire.clearPercent).toBeLessThan(mild.clearPercent);
    expect(dire.midPercent).toBeLessThan(mild.midPercent);
    expect(mild.pulse).toBe(true);
  });

  it('prefers-reduced-motion keeps the same vignette without pulsing', () => {
    const pulsing = vignettePaint(10, 100, false);
    const still = vignettePaint(10, 100, true);

    expect(still.opacity).toBeCloseTo(pulsing.opacity);
    expect(still.clearPercent).toBeCloseTo(pulsing.clearPercent);
    expect(still.pulse).toBe(false);
    expect(pulsing.pulse).toBe(true);
    expect(vignettePaint(100, 100, false).pulse).toBe(false);
  });

  it('treats a dead or invalid pool as a safe value', () => {
    expect(vignetteIntensity(-10, 100)).toBe(1);
    expect(vignetteIntensity(10, 0)).toBe(0);
    expect(vignetteIntensity(Number.NaN, 100)).toBe(0);
    expect(vignetteIntensity(10, Number.NaN)).toBe(0);
  });
});

describe('applyLowHpVignette', () => {
  function fakeEl() {
    const props = new Map<string, string>();
    const el = {
      style: {
        animation: '',
        setProperty(name: string, value: string) {
          props.set(name, value);
        },
      },
    } as unknown as HTMLElement;
    return {el, props};
  }

  it('writes the curve onto the element and does not pulse under reduced motion', () => {
    const {el, props} = fakeEl();
    applyLowHpVignette(el, 10, 100, true);

    expect(Number(props.get('--vignette-opacity'))).toBeGreaterThan(0.5);
    expect(props.get('--vignette-clear')).toMatch(/%$/);
    expect(el.style.animation).toBe('none');
  });

  it('arms the CSS pulse only while the vignette is up', () => {
    const {el, props} = fakeEl();
    applyLowHpVignette(el, 12, 100, false);
    expect(el.style.animation).toContain(`${VIGNETTE_PULSE_MS}ms`);

    applyLowHpVignette(el, 100, 100, false);
    expect(Number(props.get('--vignette-opacity'))).toBe(0);
    expect(el.style.animation).toBe('none');
  });

  it('ignores a missing element', () => {
    expect(() => applyLowHpVignette(null, 0, 100, false)).not.toThrow();
  });
});
