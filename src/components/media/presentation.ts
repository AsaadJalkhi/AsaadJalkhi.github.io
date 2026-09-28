/**
 * Stacked or slideshow — one decision for galleries and website screenshots.
 *
 * Pure, so the rule is asserted with real values in check-ui. Both adapters ask
 * `slideshowOf()` and render `MultiImageSlideshow` when it answers; `null` means
 * the stacked layout they always had.
 */
import type { Presentation } from '@/types/content';

/** What the Studio writes when Slideshow is first chosen, and what absent means. */
export const DEFAULT_SLIDE_INTERVAL = 2000;
export const MIN_SLIDE_INTERVAL = 1000;
export const MAX_SLIDE_INTERVAL = 10000;

export interface SlideshowSettings {
  autoplay: boolean;
  /** Milliseconds between slides. */
  interval: number;
}

/**
 * Slideshow settings, or `null` for stacked.
 *
 * Stacked when `presentation` is absent, says stacked, or there are fewer than
 * two images — a stale slideshow setting on a single picture is ignored.
 */
export function slideshowOf(
  presentation: Presentation | undefined,
  count: number,
): SlideshowSettings | null {
  if (count < 2 || presentation?.mode !== 'slideshow') return null;
  const interval = presentation.interval ?? DEFAULT_SLIDE_INTERVAL;
  return {
    autoplay: presentation.autoplay !== false,
    interval: Math.min(MAX_SLIDE_INTERVAL, Math.max(MIN_SLIDE_INTERVAL, interval)),
  };
}

/** The value the Studio writes on a switch to Slideshow. */
export function startSlideshow(): Presentation {
  return { mode: 'slideshow', autoplay: true, interval: DEFAULT_SLIDE_INTERVAL };
}
