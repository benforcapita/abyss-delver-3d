import './RotatePrompt.css';

/**
 * Full-screen "Rotate your device" overlay. Visibility is controlled purely by
 * CSS: shown only for coarse pointers (touch) in portrait orientation.
 */
export function RotatePrompt() {
  return (
    <div className="rotate-prompt" role="alert" aria-live="polite" data-testid="rotate-prompt">
      <div className="rotate-prompt__icon" aria-hidden="true">📱</div>
      <div className="rotate-prompt__text">Rotate your device</div>
      <div>Abyss Delver plays in landscape.</div>
    </div>
  );
}
