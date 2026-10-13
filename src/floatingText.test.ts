import { describe, expect, it } from 'vitest';
import {
  FLOATING_TEXT_CAP,
  FLOATING_TEXT_LIFE,
  FLOATING_TEXT_RISE,
  FloatingTextStore,
  createFloatingText,
  spawnText,
  textOpacity,
  updateTexts,
} from './floatingText';

describe('floatingText', () => {
  it('creates a text above the source position with unique ids', () => {
    const a = createFloatingText('12', [1, 2, 3], '#f00');
    const b = createFloatingText('Potion!', [0, 0, 0], '#0f0', true);
    expect(a).toMatchObject({ text: '12', pos: [1, 2.5, 3], color: '#f00', life: 0, maxLife: FLOATING_TEXT_LIFE, scale: 1 });
    expect(b.scale).toBe(1.4);
    expect(a.id).not.toBe(b.id);
  });

  it('spawn appends without mutating', () => {
    const list = [createFloatingText('a', [0, 0, 0])];
    const next = spawnText(list, createFloatingText('b', [0, 0, 0]));
    expect(list).toHaveLength(1);
    expect(next.map((t) => t.text)).toEqual(['a', 'b']);
  });

  it('update ages and raises texts, purely', () => {
    const list = [createFloatingText('a', [0, 0, 0])];
    const next = updateTexts(list, 0.2);
    expect(next[0].life).toBeCloseTo(0.2);
    expect(next[0].pos[1]).toBeCloseTo(0.5 + 0.2 * FLOATING_TEXT_RISE);
    expect(list[0].life).toBe(0);
    expect(list[0].pos[1]).toBe(0.5);
  });

  it('expires texts at maxLife', () => {
    let list = [createFloatingText('a', [0, 0, 0])];
    list = updateTexts(list, FLOATING_TEXT_LIFE - 0.01);
    expect(list).toHaveLength(1);
    list = updateTexts(list, 0.02);
    expect(list).toHaveLength(0);
  });

  it('fades out near the end of life', () => {
    expect(textOpacity({ life: 0, maxLife: 1 })).toBe(1);
    expect(textOpacity({ life: 0.6, maxLife: 1 })).toBe(1);
    expect(textOpacity({ life: 0.8, maxLife: 1 })).toBeCloseTo(0.5);
    expect(textOpacity({ life: 1, maxLife: 1 })).toBe(0);
  });

  it('caps the number of texts, dropping the oldest', () => {
    let list: ReturnType<typeof spawnText> = [];
    for (let i = 0; i < FLOATING_TEXT_CAP + 5; i++) list = spawnText(list, createFloatingText(String(i), [0, 0, 0]));
    expect(list).toHaveLength(FLOATING_TEXT_CAP);
    expect(list[0].text).toBe('5');
    expect(list.at(-1)!.text).toBe(String(FLOATING_TEXT_CAP + 4));
  });

  it('store never loses texts spawned in the same frame as an update', () => {
    const s = new FloatingTextStore();
    s.spawn('before', [0, 0, 0]);
    expect(s.update(0.016)).toBe(true);
    s.spawn('after', [0, 0, 0]); // e.g. hit resolved later in the same frame
    s.spawn('also', [0, 0, 0]);
    expect(s.list.map((t) => t.text)).toEqual(['before', 'after', 'also']);
    s.update(0.016);
    expect(s.list.map((t) => t.text)).toEqual(['before', 'after', 'also']);
    expect(s.list[1].life).toBeCloseTo(0.016);
  });

  it('store update is a no-op when empty and clear empties it', () => {
    const s = new FloatingTextStore(3);
    expect(s.update(0.1)).toBe(false);
    for (const t of ['a', 'b', 'c', 'd']) s.spawn(t, [0, 0, 0]);
    expect(s.list.map((t) => t.text)).toEqual(['b', 'c', 'd']);
    s.clear();
    expect(s.list).toEqual([]);
  });
});
