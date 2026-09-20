/**
 * "Is this element near the viewport?" — the trigger for every media adapter.
 *
 * Media in ASAAD.OS initialises itself. There is no "Load embed" button any
 * more: a project is scrolled, and each video-like item wakes up as it arrives
 * and stands down as it leaves. Two thresholds do that, and they are separate
 * on purpose:
 *
 *   `near`    — within `rootMargin` of the viewport. Start *preparing*: mount
 *               the iframe, attach the <video> source, let the network warm up.
 *               Deliberately NOT "on page load", so opening a project with ten
 *               videos in it does not open ten connections to YouTube.
 *   `visible` — actually on screen past `threshold`. Start *playing*.
 *
 * Once `near` goes true it stays true. Tearing an iframe down and rebuilding it
 * on every scroll reversal is worse than leaving it mounted: it re-downloads the
 * player and restarts the ad roll. `visible` keeps toggling, which is what
 * pauses a native <video> that has scrolled away.
 *
 * The scroll container is a window body, not the page, but IntersectionObserver
 * with a null root observes against the viewport — and a window body is inside
 * the viewport, so items inside a scrolled-away window correctly read as
 * off-screen too.
 */
import { useEffect, useRef, useState } from 'react';

export interface InViewOptions {
  /** How far outside the viewport counts as "near". */
  rootMargin?: string;
  /** Fraction visible before `visible` flips true. */
  threshold?: number;
  /** Treat as near+visible immediately — for hero media above the fold. */
  eager?: boolean;
}

export interface InViewState {
  /** Attach to the element being watched. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Latched: has been within rootMargin at least once. Gate loading on this. */
  near: boolean;
  /** Live: currently on screen. Gate playback on this. */
  visible: boolean;
}

export function useInView({
  rootMargin = '300px 0px',
  threshold = 0.35,
  eager = false,
}: InViewOptions = {}): InViewState {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(eager);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (very old browser, some test environments): fail
    // towards working media rather than towards a permanently blank frame.
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      setVisible(true);
      return;
    }

    // Two observers because the margins differ: "near" is generous so loading
    // starts before the item arrives, "visible" is strict so playback only
    // begins for something actually being looked at.
    const nearObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          nearObserver.disconnect(); // latched — see the header
        }
      },
      { rootMargin, threshold: 0 },
    );

    const visibleObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(entry.isIntersecting);
      },
      { rootMargin: '0px', threshold },
    );

    nearObserver.observe(node);
    visibleObserver.observe(node);

    return () => {
      nearObserver.disconnect();
      visibleObserver.disconnect();
    };
  }, [rootMargin, threshold]);

  return { ref, near, visible };
}
