/**
 * The "open this larger" affordance that sits on a media frame.
 *
 * It is a small, explicit button in the corner rather than a click handler on
 * the whole frame, because the frame itself now contains a working player:
 * making the artwork one big button would steal every click from the scrubber,
 * the volume control and the fullscreen button underneath it.
 *
 * This is also the rule that keeps visitors inside the portfolio — the artwork
 * never navigates. Leaving the site is only ever an explicitly labelled action
 * ("View original post", "Open on YouTube"), which lives in the frame's caption
 * row, not on the image.
 */
import { Maximize2 } from 'lucide-react';

export function FocusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="media-focus-btn"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title="Open larger"
      aria-label="Open larger"
    >
      <Maximize2 strokeWidth={1.6} />
    </button>
  );
}
