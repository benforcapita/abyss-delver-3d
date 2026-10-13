/// <reference types="vite/client" />
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import html from '../../index.html?raw';
import {RotatePrompt} from './RotatePrompt';

describe('RotatePrompt', () => {
  it('renders the rotate overlay (visibility is CSS-driven)', () => {
    const out = renderToStaticMarkup(<RotatePrompt />);
    expect(out).toContain('class="rotate-prompt"');
    expect(out).toContain('Rotate your device');
  });
  it('index.html viewport uses viewport-fit=cover for safe-area insets', () => {
    expect(html).toContain('viewport-fit=cover');
  });
});
