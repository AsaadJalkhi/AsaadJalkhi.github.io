/**
 * One image at a time — the slideshow form of a gallery or a screenshot set.
 *
 * Shared by `GalleryMedia` and `WebsiteMedia`; neither keeps any slide state of
 * its own. They decide *whether* with `slideshowOf()` and hand over the
 * resolved pictures, the frame's copy and an `onOpen(index)` that opens their
 * existing Focus Mode at that picture — so the slide on screen is the one that
 * opens, and stepping inside Focus Mode is unchanged.
 *
 * **The box is fixed, the picture is not cropped.** The stage takes one ratio —
 * the item's manual aspect, else the first picture's manual aspect, else the
 * first picture's measured shape, else the type's fallback — and every slide is
 * `contain`ed inside it. So the layout does not jump between slides, and a
 * picture of a different shape sits inside the box whole rather than being cut
 * to fit it. The ratio also reaches `MediaFrame`, which applies the same height
 * ceiling as every other piece of body media.
 *
 * **Autoplay is one timeout, restarted on every change of slide.** A manual step
 * therefore resets the clock, and there is never more than one timer. It only
 * runs while the stage is on screen (`useInView`), not hovered or being
 * swiped, not behind Focus Mode, and **never under prefers-reduced-motion** —
 * the arrows still work there, without the fade.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Aspect, Discipline, MediaSubItem } from '@/types/content';
import { SmartImage } from '@/components/ui/SmartImage';
import { useInView } from '@/hooks/useInView';
import { usePrefersReducedMotion } from '@/hooks/useEnvironment';
import { MediaFrame, type MediaFrameProps } from './MediaFrame';
import { manualRatio, useImageRatio } from './aspect';
import type { SlideshowSettings } from './presentation';

/** Horizontal travel, in px, before a touch drag counts as a swipe. */
const SWIPE_MIN = 40;

interface MultiImageSlideshowProps {
  items: MediaSubItem[];
  settings: SlideshowSettings;
  /** Everything the frame shows around the stage — title, caption, actions. */
  frame: Omit<MediaFrameProps, 'children' | 'aspect' | 'ratio' | 'fill'>;
  /** The parent item's manual aspect, if it has one. */
  aspect?: Aspect;
  /** Used only until the first picture reports its own shape. */
  fallbackRatio: number;
  /** Open picture `index` in Focus Mode. */
  onOpen: (index: number) => void;
  /** Hold the slideshow still — e.g. while Focus Mode is open over it. */
  held?: boolean;
  seed: string;
  discipline?: Discipline;
  priority?: boolean;
  /** Accessible names, per picture. */
  altOf: (item: MediaSubItem, index: number) => string;
  openLabelOf: (item: MediaSubItem, index: number) => string;
}

export function MultiImageSlideshow({
  items,
  settings,
  frame,
  aspect,
  fallbackRatio,
  onOpen,
  held = false,
  seed,
  discipline,
  priority,
  altOf,
  openLabelOf,
}: MultiImageSlideshowProps) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { ref, visible } = useInView();

  const first = items[0];
  const manual = manualRatio(aspect) ?? manualRatio(first?.aspect);
  const measured = useImageRatio(manual ? undefined : (first?.src ?? first?.url));
  const ratio = manual ?? measured ?? fallbackRatio;

  // An item edited down while mounted must not point past the end.
  const current = index % count;

  const step = useCallback(
    (delta: number) => setIndex((i) => (((i % count) + delta) % count + count) % count),
    [count],
  );

  const playing = settings.autoplay && !reduced && visible && !hovered && !touching && !held;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => step(1), settings.interval);
    return () => window.clearTimeout(timer);
  }, [playing, current, settings.interval, step]);

  /*
   * Swipe, touch only. `touch-action: pan-y` on the stage leaves vertical
   * scrolling to the browser; a mostly-horizontal drag past SWIPE_MIN steps,
   * and the click that follows it is swallowed so a swipe never opens Focus.
   */
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    start.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
    setTouching(true);
  };
  const onPointerEnd = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    const from = start.current;
    start.current = null;
    setTouching(false);
    if (!from || event.type === 'pointercancel') return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
      step(dx < 0 ? 1 : -1);
    }
  };

  const open = (i: number) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    onOpen(i);
  };

  const caption = items[current]?.caption;

  return (
    <MediaFrame {...frame} fill ratio={ratio}>
      <div className="media-slideshow" data-motion={reduced ? 'reduced' : undefined}>
        <div
          ref={ref}
          className="media-slideshow__stage"
          style={{ aspectRatio: `${ratio}` }}
          onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
          onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {items.map((item, i) => {
            const active = i === current;
            return (
              <button
                key={item.id ?? i}
                type="button"
                className="media-open media-slideshow__slide"
                data-active={active || undefined}
                aria-hidden={!active}
                tabIndex={active ? 0 : -1}
                onClick={() => open(i)}
                aria-label={`${openLabelOf(item, i)} — ${i + 1} of ${count}`}
              >
                <SmartImage
                  src={item.src ?? item.url}
                  alt={altOf(item, i)}
                  seed={`${seed}-${i}`}
                  discipline={discipline}
                  label={item.caption}
                  eager={priority && i === 0}
                  objectFit="contain"
                  className="media-fill"
                />
              </button>
            );
          })}

          <button
            type="button"
            className="media-slideshow__arrow media-slideshow__arrow--prev"
            onClick={() => step(-1)}
            aria-label="Previous image"
          >
            <ChevronLeft strokeWidth={1.6} />
          </button>
          <button
            type="button"
            className="media-slideshow__arrow media-slideshow__arrow--next"
            onClick={() => step(1)}
            aria-label="Next image"
          >
            <ChevronRight strokeWidth={1.6} />
          </button>
          {/* The slide's own label already says "n of N"; this is the visual copy. */}
          <span className="media-slideshow__count mono" aria-hidden="true">
            {current + 1} / {count}
          </span>
        </div>
        {caption && <p className="media-set__caption">{caption}</p>}
      </div>
    </MediaFrame>
  );
}
