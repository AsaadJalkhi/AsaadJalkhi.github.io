import { useEffect, useState } from 'react';

/** Generic media-query hook, SSR-safe and listener-cleaned. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Phone or tablet — gets the purpose-built mobile shell, not the desktop.
 *
 * Two ways in, either one enough:
 *   - a narrow viewport, whatever the input — a phone, or a desktop window
 *     dragged thin;
 *   - a touch-first device (no hover, coarse pointer) at tablet size. An iPad
 *     is 1024–1366px wide, so width alone handed it the draggable desktop, a
 *     mouse metaphor under a finger.
 *
 * Capabilities, never the user agent. A desktop browser with a mouse keeps the
 * desktop at any width above the breakpoint, including a touchscreen laptop
 * whose primary pointer is fine. The Studio's Mobile preview is a container
 * width, not this hook, so it is unaffected.
 */
export const COMPACT_QUERY =
  '(max-width: 900px), (hover: none) and (pointer: coarse) and (max-width: 1366px)';

export function useIsCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

/** True when the device has no precise pointer — disables the custom cursor. */
export function useIsTouch(): boolean {
  return useMediaQuery('(hover: none), (pointer: coarse)');
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export interface Viewport {
  width: number;
  height: number;
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setViewport({ width: window.innerWidth, height: window.innerHeight }),
      );
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return viewport;
}
