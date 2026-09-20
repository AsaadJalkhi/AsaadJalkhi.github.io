/**
 * Custom cursor — pointer devices only.
 *
 * A dot that tracks exactly plus a ring that lags slightly. It never replaces
 * text carets or hides the pointer over inputs, and it is off entirely for
 * touch, reduced motion, and when the user disables it.
 */
import { useEffect, useRef } from 'react';
import { useIsTouch, usePrefersReducedMotion } from '@/hooks/useEnvironment';

const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, .dicon, .rnd-handle';

export function CustomCursor({ enabled }: { enabled: boolean }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const touch = useIsTouch();
  const reduced = usePrefersReducedMotion();
  const active = enabled && !touch && !reduced;

  useEffect(() => {
    if (!active) {
      document.body.removeAttribute('data-cursor');
      return;
    }
    document.body.setAttribute('data-cursor', 'on');

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const eased = { ...target };
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      if (dot.current) {
        dot.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      }
      const el = event.target as HTMLElement | null;
      const state = el?.closest(INTERACTIVE) ? 'active' : 'idle';
      ring.current?.setAttribute('data-state', state);
    };

    const onLeave = () => ring.current?.setAttribute('data-state', 'hidden');
    const onEnter = () => ring.current?.setAttribute('data-state', 'idle');

    const loop = () => {
      eased.x += (target.x - eased.x) * 0.18;
      eased.y += (target.y - eased.y) * 0.18;
      if (ring.current) {
        ring.current.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0)`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerenter', onEnter);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      document.body.removeAttribute('data-cursor');
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="cursor" aria-hidden="true">
      <div ref={ring} className="cursor__ring" data-state="idle" />
      <div ref={dot} className="cursor__dot" />
    </div>
  );
}
