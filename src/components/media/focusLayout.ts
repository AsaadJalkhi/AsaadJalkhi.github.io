/**
 * Focus Mode layout decisions.
 *
 * Kept separate from the component, and pure, for one reason: the thing that
 * kept going wrong was *one layout being forced onto every shape of media*. A
 * 9:16 Reel and a 16:9 YouTube player have nothing in common, and squeezing the
 * second into the arrangement that suits the first is what made the player
 * small and the surrounding black rectangle enormous.
 *
 * So the arrangement is chosen from the media's **resolved** aspect ratio —
 * manual aspect first, then the real measured one, then the per-type fallback,
 * all of which `media/aspect.ts` already decides — and from how much room the
 * viewport actually has. Nothing here reads the DOM, so it can be tested with
 * plain numbers.
 */

/** Which arrangement the media gets. */
export type FocusLayout = 'portrait' | 'balanced' | 'landscape';

/** Whether the information sits beside the media or underneath it. */
export type FocusFlow = 'side' | 'stack';

/*
 * Thresholds. Deliberately not 1.0: a 4:5 Instagram post (0.8) and a 5:4 photo
 * (1.25) both want the same treatment as a square, and a hard 1.0 boundary
 * would send two near-identical shapes to opposite layouts.
 */
export const PORTRAIT_BELOW = 0.95;
export const LANDSCAPE_FROM = 1.5;

/** Below this the side-by-side arrangements collapse; a phone gets one column. */
export const SIDE_BY_SIDE_MIN_WIDTH = 1024;

/** A 9:16 Reel stretched across an ultrawide reads as a mistake, not a Reel. */
const PORTRAIT_MAX_WIDTH = 560;

/** Information panel width in the side-by-side layouts. */
const INFO_MIN = 260;
const INFO_MAX = 420;
const INFO_SHARE = 0.31;

/** Room kept for the information section under the media in a stacked layout. */
const INFO_STACK_MIN = 108;
const INFO_STACK_MAX = 260;
const INFO_STACK_SHARE = 0.26;

export interface Viewportish {
  width: number;
  height: number;
}

/**
 * Horizontal lane reserved at each edge of the overlay for a navigation arrow.
 *
 * The arrows are not allowed to sit *over* anything. Raising their z-index was
 * the wrong fix and was tried first: it keeps them clickable but still draws
 * them across the caption, the media title and the media itself. So the layout
 * gives up the width instead —
 *
 *   [ gutter ][ information ][ media ][ gutter ]   side by side
 *   [ gutter ][        main content        ][ gutter ]   stacked
 *
 * and the arrow is centred inside its own lane, where there is nothing else.
 * Zero when there is only one item, so a single piece of media gets the full
 * width rather than paying for controls that are not rendered.
 */
export const NAV_GUTTER = 64;
export const NAV_GUTTER_NARROW = 44;

export interface FocusPlan {
  layout: FocusLayout;
  flow: FocusFlow;
  /** Pixel box the media may occupy. Already fitted to `ratio`. */
  media: { width: number; height: number };
  /** Pixel width of the information column, or 0 when it sits underneath. */
  infoWidth: number;
  /** Width reserved at each edge for the navigation arrows. 0 when there are none. */
  gutter: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Portrait / balanced / landscape from the resolved ratio.
 *
 * `ratio` is width ÷ height. A non-finite or zero ratio means nothing has been
 * measured yet, and the honest answer there is the widescreen default rather
 * than a guess that makes the media jump when the real shape arrives.
 */
export function focusLayout(ratio: number): FocusLayout {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'landscape';
  if (ratio < PORTRAIT_BELOW) return 'portrait';
  if (ratio < LANDSCAPE_FROM) return 'balanced';
  return 'landscape';
}

/**
 * The whole arrangement: which layout, information beside or below, and the
 * exact box the media gets.
 *
 * Landscape never goes side-by-side — that is the rule the brief is built on.
 * Handing a 16:9 player a third of the width makes it smaller than the tile it
 * was opened from, which is the opposite of focusing on it.
 */
export function focusPlan(
  ratio: number,
  viewport: Viewportish,
  options: { hasInfo: boolean; padding: number; gap: number; hasNav?: boolean },
): FocusPlan {
  const layout = focusLayout(ratio);
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9;

  /*
   * The navigation lanes come out of the width before anything else is
   * measured, so no amount of caption or media can end up underneath an arrow.
   */
  const gutter = options.hasNav
    ? viewport.width < 720
      ? NAV_GUTTER_NARROW
      : NAV_GUTTER
    : 0;

  const availableWidth = Math.max(120, viewport.width - options.padding * 2 - gutter * 2);
  const availableHeight = Math.max(120, viewport.height - options.padding * 2);

  const wideEnough = viewport.width >= SIDE_BY_SIDE_MIN_WIDTH;
  const flow: FocusFlow =
    options.hasInfo && wideEnough && layout !== 'landscape' ? 'side' : 'stack';

  let boxWidth: number;
  let boxHeight: number;
  let infoWidth = 0;

  if (flow === 'side') {
    infoWidth = clamp(availableWidth * INFO_SHARE, INFO_MIN, INFO_MAX);
    boxWidth = availableWidth - infoWidth - options.gap;
    boxHeight = availableHeight;
  } else {
    const reserve = options.hasInfo
      ? clamp(availableHeight * INFO_STACK_SHARE, INFO_STACK_MIN, INFO_STACK_MAX) + options.gap
      : 0;
    boxWidth = availableWidth;
    boxHeight = availableHeight - reserve;
  }

  boxWidth = Math.max(80, boxWidth);
  boxHeight = Math.max(80, boxHeight);

  // Portrait media is capped in width so it stays a tall object rather than
  // growing into the whole column on a very large screen.
  if (layout === 'portrait') boxWidth = Math.min(boxWidth, PORTRAIT_MAX_WIDTH);

  // Fit the ratio inside the box: whichever axis runs out first decides.
  const width = Math.min(boxWidth, boxHeight * safeRatio);
  const height = width / safeRatio;

  return {
    layout,
    flow,
    media: { width: Math.round(width), height: Math.round(height) },
    infoWidth: Math.round(infoWidth),
    gutter,
  };
}
