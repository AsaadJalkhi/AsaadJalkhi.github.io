import type { Discipline, MediaItem } from '@/types/content';

/** Every media adapter receives exactly this. */
export interface AdapterProps {
  media: MediaItem;
  /** Usually the project id — makes generated fallback art deterministic. */
  seed: string;
  discipline?: Discipline;
  /**
   * "full"  — inside a case study or media window: frame, caption, actions.
   * "card"  — inside a grid or tile: bare visual, no chrome.
   * "focus" — inside the lightbox: bare visual again, but filling a box whose
   *           size `MediaFocus` has already decided from the aspect ratio. An
   *           adapter in this mode must NOT add its own frame, caption or
   *           aspect-ratio box — doing that is what produced the nested,
   *           double-scrolling viewer this mode was introduced to fix.
   */
  mode: 'full' | 'card' | 'focus';
  /** Skip lazy-loading for above-the-fold media. */
  priority?: boolean;
  /**
   * Open this item in Focus Mode. Adapters render the affordance as a small
   * explicit button (see `FocusAffordance`), never as a click handler over the
   * whole frame — the frame contains a live player whose own controls must keep
   * working.
   */
  onFocus?: () => void;
}
