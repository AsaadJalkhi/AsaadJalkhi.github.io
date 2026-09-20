/**
 * Focus Mode — the media viewer.
 *
 * Rebuilt in session 10. Only the *presentation* changed: the adapters, the
 * load/play lifecycle, the Instagram embed behaviour and the external-link
 * rules are all untouched and are still the single source of how media plays.
 *
 * What was wrong, and what this answers:
 *
 *   **One layout was forced onto every shape.** A single media-sized box with a
 *   caption underneath suits a portrait Reel and actively harms a 16:9 player,
 *   which ended up small and surrounded by a large dark rectangle. The
 *   arrangement is now chosen from the media's resolved aspect ratio — see
 *   `focusLayout.ts`, which is pure and decides it from numbers alone.
 *
 *   - **Portrait** (9:16, 4:5, a tall photo): information on the left, media on
 *     the right, media using the full height.
 *   - **Landscape** (16:9, 3:2, a wide campaign asset): media large across the
 *     top, an editorial information row underneath. Never side-by-side — a
 *     third of the width is smaller than the tile it was opened from.
 *   - **Balanced** (1:1, 4:3, 5:4): side-by-side where the viewport is wide
 *     enough for it to look composed, stacked where it is not.
 *   - **Narrow viewport**: everything stacks, media then information.
 *
 *   **The caption hung outside the composition.** It now lives *inside* the
 *   information region in every layout — left panel when side-by-side, the row
 *   beneath the media when stacked. The information region is what scrolls if
 *   the copy is long; the media is never a nested scrolling box.
 *
 *   **The media and the scrim read as two separate things.** There is no
 *   detached dark card any more: a full-screen scrim, and the content laid out
 *   deliberately inside it.
 *
 * The controls belong to the overlay, not to the media: close top-right, arrows
 * pinned to the viewport edges and vertically centred, all above the media on
 * the z axis so an iframe can never draw over them and a tall caption can never
 * displace them. Esc closes, ← and → step.
 *
 * ── Session 11 ───────────────────────────────────────────────────────────────
 *
 *   **It is portalled to `document.body`, and it has to be.** `.focus` is
 *   `position: fixed` at `var(--z-focus)`, which outranks the menu bar on the
 *   token scale — and that was still not enough, because the viewer is rendered
 *   from inside a project window and `.window` carries `isolation: isolate` (the
 *   backdrop-filter corner fix in window.css). That makes the window a stacking
 *   context, so a z-index set inside it is only compared against its siblings
 *   *in that window*, and the window itself sits at `--z-windows` — below
 *   `--z-menubar`. The menu bar therefore painted straight over portrait media.
 *   A portal moves the overlay out of that stacking context so the token means
 *   what it says. **Raising the number instead does nothing.**
 *
 *   **The arrows own reserved gutters.** They used to be absolutely positioned
 *   at the overlay edges, above the content on the z axis — clickable, but drawn
 *   across the caption and the information column. The layout now gives up that
 *   width before it measures anything (`NAV_GUTTER` in focusLayout.ts), so the
 *   arrows sit in lanes that contain nothing else.
 *
 *   **A media item's title is its own, or it has none.** `media.title` is shown
 *   when it is set. When it is not, no title is rendered — the project title is
 *   **never** substituted, which previously stamped "Brand Marketing &
 *   Campaigns" across every individual image in the project. Project context
 *   survives as a quiet line at the bottom of the information, where it reads as
 *   provenance rather than as the name of the picture.
 */
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Discipline, MediaItem } from '@/types/content';
import { useViewport } from '@/hooks/useEnvironment';
import { MediaRenderer } from './MediaRenderer';
import { useMediaRatio } from './aspect';
import { focusPlan } from './focusLayout';
import './media.css';

/** Kept in step with the padding/gap in `media.css`. */
const PADDING = 28;
const PADDING_NARROW = 14;
const GAP = 24;

/**
 * Context from whatever opened the viewer.
 *
 * Deliberately not a new schema: these are fields that already exist on the
 * project. Every one is optional, and a section with nothing in it is not
 * rendered at all — no empty headings.
 */
export interface FocusContext {
  title?: string;
  company?: string;
  year?: string | number;
  tools?: string[];
}

interface MediaFocusProps {
  media: MediaItem[];
  index: number;
  seed: string;
  discipline?: Discipline;
  context?: FocusContext;
  onClose: () => void;
  onStep: (delta: number) => void;
}

export function MediaFocus({
  media,
  index,
  seed,
  discipline,
  context,
  onClose,
  onStep,
}: MediaFocusProps) {
  const active = media[index];
  const viewport = useViewport();

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onStep(1);
      if (event.key === 'ArrowLeft') onStep(-1);
    },
    [onClose, onStep],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  /*
   * The resolved ratio of the item on screen. A manual aspect wins; otherwise
   * this measures the image, or the cover standing in for an embed, and only
   * falls back to a per-type default where the shape is genuinely unknowable.
   *
   * Hooks cannot be called after an early return, so it runs before the
   * `!active` guard and is given an empty item when there is nothing to show.
   */
  const ratio = useMediaRatio(active ?? { id: 'none', type: 'image' });

  if (!active) return null;

  /*
   * The title of THIS piece of media, and nothing else. There is deliberately
   * no `?? context.title` here: falling back to the project title made every
   * image in a project look as though it were called "Brand Marketing &
   * Campaigns". An item with no title of its own simply gets no title.
   */
  const title = active.title?.trim();
  const caption = active.caption?.trim();
  const credit = active.credit?.trim();
  const tools = context?.tools?.filter(Boolean) ?? [];
  const permalink = active.instagramUrl ?? active.url;

  /*
   * Project context is provenance, not a heading, so it does not on its own earn
   * an information panel — otherwise every untitled, uncaptioned image would
   * open with a company name floating beside it.
   */
  const hasInfo = Boolean(title || caption || credit || tools.length || permalink);
  const contextLine = [context?.title, context?.company, context?.year]
    .filter(Boolean)
    .join(' · ');

  const hasNav = media.length > 1;
  const padding = viewport.width < 640 ? PADDING_NARROW : PADDING;
  const plan = focusPlan(ratio, viewport, { hasInfo, padding, gap: GAP, hasNav });

  const externalLabel =
    active.type === 'instagram'
      ? 'View original post'
      : active.type === 'youtube'
        ? 'Open on YouTube'
        : active.type === 'vimeo'
          ? 'Open on Vimeo'
          : active.type === 'drive'
            ? 'Open in Google Drive'
            : active.type === 'website'
              ? 'Visit Website'
              : 'Open original';

  /*
   * One hierarchy, in one place, used by every layout:
   *
   *   media title → caption → tools → credit → external action
   *
   * Landscape splits it into two editorial columns (the writing left, the making
   * credits right); portrait and balanced stack the same blocks down one panel.
   * Nothing renders an empty heading — a section that has no value is absent
   * rather than blank.
   */
  const story = (
    <>
      {title && <h2 className="focus__title">{title}</h2>}
      {caption && <p className="focus__caption">{caption}</p>}
    </>
  );

  const facts = (
    <>
      {tools.length > 0 && (
        <p className="focus__fact">
          <span className="focus__fact-label mono">Tools</span>
          <span>{tools.join(', ')}</span>
        </p>
      )}
      {credit && (
        <p className="focus__fact">
          <span className="focus__fact-label mono">Credit</span>
          <span>{credit}</span>
        </p>
      )}
      {permalink && (
        <a className="focus__external" href={permalink} target="_blank" rel="noopener noreferrer">
          {externalLabel} ↗
        </a>
      )}
      {/*
       * Where this came from, kept deliberately quiet. It is the one place the
       * project is named in the viewer, and it is never the item's title.
       */}
      {contextLine && <span className="focus__context">{contextLine}</span>}
      {hasNav && (
        <span className="mono focus__count">
          {index + 1} / {media.length}
        </span>
      )}
    </>
  );

  const overlay = (
    <div
      className="focus"
      data-layout={plan.layout}
      data-flow={plan.flow}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? caption ?? 'Media viewer'}
      /*
       * The gutter travels to the stylesheet as a variable so the arrows can
       * centre themselves inside the very lane the layout gave up for them.
       * Both come from one number, in one place; they cannot drift apart.
       */
      style={
        {
          '--focus-pad': `${padding}px`,
          '--focus-gutter': `${plan.gutter}px`,
        } as React.CSSProperties
      }
    >
      {/* Clicking the backdrop closes; the content above it does not bubble. */}
      <button type="button" className="focus__scrim" onClick={onClose} aria-label="Close viewer" />

      <button type="button" className="focus__close" onClick={onClose} aria-label="Close">
        <X strokeWidth={1.6} />
      </button>

      {hasNav && (
        <>
          <button
            type="button"
            className="focus__nav focus__nav--prev"
            onClick={() => onStep(-1)}
            aria-label="Previous"
          >
            <ChevronLeft strokeWidth={1.6} />
          </button>
          <button
            type="button"
            className="focus__nav focus__nav--next"
            onClick={() => onStep(1)}
            aria-label="Next"
          >
            <ChevronRight strokeWidth={1.6} />
          </button>
        </>
      )}

      <div className="focus__layout" style={{ gap: GAP }}>
        <div className="focus__media">
          <div
            className="focus__box"
            data-type={active.type}
            style={{ width: plan.media.width, height: plan.media.height }}
          >
            {/*
             * `key` forces a fresh adapter per item. Without it, stepping from
             * a YouTube item to a Vimeo one reuses the same iframe node and the
             * old player keeps playing behind the new src.
             */}
            <MediaRenderer
              key={active.id}
              media={active}
              seed={seed}
              discipline={discipline}
              mode="focus"
              priority
            />
          </div>
        </div>

        {hasInfo && (
          <aside
            className="focus__info"
            style={plan.flow === 'side' ? { width: plan.infoWidth } : undefined}
          >
            <div className="focus__story">{story}</div>
            <div className="focus__facts">{facts}</div>
          </aside>
        )}
      </div>
    </div>
  );

  /*
   * SSR / test safety: without a document there is nothing to portal into, and
   * rendering in place is a better answer than throwing. In the browser this
   * branch never runs.
   */
  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
