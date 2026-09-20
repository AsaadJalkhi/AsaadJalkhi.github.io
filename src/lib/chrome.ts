/**
 * Measurements of the fixed OS chrome.
 *
 * The desktop is an unbounded workspace — a window can be dragged past the
 * left, right and bottom edges and left there on purpose (PROJECT_STATUS §5).
 * The TOP is the one exception, and it is a usability fix rather than a change
 * of heart: the menu bar is `position: fixed` at `--menubar-h`, so a window
 * pushed above it slides *underneath* it and takes its own title bar — and
 * therefore its close, minimise and maximise controls, and the only surface you
 * can grab to drag it back — out of reach.
 *
 * So: top stops just below the menu bar, the other three stay free.
 *
 * The height is read from the `--menubar-h` custom property rather than being
 * retyped as a literal, so restyling the bar in `tokens.css` moves the window
 * floor with it. The fallback matches the token's current value and only
 * applies before first paint or during SSR.
 */
const FALLBACK_MENUBAR_H = 36;

/** A hair of breathing room so the title bar never kisses the menu bar. */
const GAP = 8;

/** Height of the fixed menu bar, in CSS pixels. */
export function menubarHeight(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_MENUBAR_H;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--menubar-h');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MENUBAR_H;
}

/**
 * The smallest `y` a window may be dragged to: the first row of pixels where
 * its title bar is still visible and clickable.
 */
export function topSafeArea(): number {
  return menubarHeight() + GAP;
}
