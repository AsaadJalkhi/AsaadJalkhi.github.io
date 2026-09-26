/**
 * How many columns the *container* can hold — not the screen.
 *
 * Everything that lays out in columns in this OS lives inside a draggable,
 * resizable window, so `window.innerWidth` answers a question nobody asked: a
 * case study or the Work grid can be 400px wide on a 2560px display, and two
 * windows side by side disagree with each other. The measurement is therefore
 * the element's own **content box** — what the columns actually get to share,
 * padding already taken off.
 *
 * `steps` are ascending minimum content widths, one per extra column: `[700,
 * 1150]` means one column below 700, two from 700, three from 1150. The array
 * must be module-level (or memoised) at the call site — it is an effect
 * dependency.
 *
 * Measured once synchronously in a layout effect, before the browser paints, so
 * the first frame is already right rather than being a wide layout that snaps
 * narrow. A `ResizeObserver` then keeps it honest when the window is resized
 * across a breakpoint — an observer, not a poll, and one per container rather
 * than one per card.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';
import { columnsForWidth } from '@/lib/masonry';

/** Content width, in the same units a ResizeObserver's `contentRect` reports. */
function contentWidth(node: HTMLElement): number {
  const style = getComputedStyle(node);
  return node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

export function useColumnCount(
  ref: RefObject<HTMLElement | null>,
  steps: readonly number[],
): number {
  // Fail open at the widest tier: a browser with no ResizeObserver and no
  // layout yet should show the grid it was designed as, not pin everything to
  // a single column.
  const [columns, setColumns] = useState(steps.length + 1);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = (width: number) => {
      // A hidden or minimised window measures 0. That is not "narrow", it is
      // "no answer", and collapsing to one column on it only causes a jump
      // when the window comes back.
      if (width <= 0) return;
      setColumns(columnsForWidth(width, steps));
    };

    measure(contentWidth(node));

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, steps]);

  return columns;
}
