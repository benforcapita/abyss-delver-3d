import {describe, expect, it} from 'vitest';
import {formatBest} from './utils/helper';

describe('formatBest', () => {
  it('shows a placeholder when no best is stored', () => {
    expect(formatBest({score: 0, floor: 0})).toBe('Best: — (no runs yet)');
  });
  it('shows score and floor', () => {
    expect(formatBest({score: 4200, floor: 3})).toBe('Best: 4200 · Floor 3');
  });
});
