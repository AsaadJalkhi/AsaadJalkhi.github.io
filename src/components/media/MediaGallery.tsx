/**
 * The media layout inside a case study.
 *
 * **Masonry, properly.** Two columns packed independently: each item goes into
 * whichever column is currently shorter, so a short landscape still next to a
 * tall portrait one does not leave a hole underneath it waiting for the row to
 * end. The old layout was a plain two-column CSS grid, which is row-based —
 * every item in a row is as tall as the tallest, and a page of mixed portrait
 * and landscape work turned into a column of gaps.
 *
 * The packing itself is `lib/masonry.ts` and the column count is
 * `hooks/useColumnCount.ts` — shared with the Work grid, which had the identical
 * problem for the identical reason. Only the height estimate below is local,
 * because only this file knows an item is a picture plus a caption.
 *
 * The packing is done from the data, not from measurement: each item's height
 * is estimated from its aspect ratio before anything loads (`estimateRatio`),
 * columns are filled shortest-first, and the DOM is then static. No layout
 * observers per item, no reflow loop, no jump when the images arrive. Being a
 * little wrong about a caption's height costs slightly uneven columns only.
 *
 * **An item and its caption are one block.** The caption is inside the column,
 * under its own image, and counts towards that column's height — so a long
 * caption pushes its own column down and leaves the other one alone. Captions
 * are editorial copy here, not labels: they wrap, they keep their paragraphs,
 * and they never widen the column.
 *
 * **`featured` breaks out.** A featured item spans the full width on its own
 * row, and the masonry resumes underneath it. That is now `featured`'s only
 * job — it used to secretly also decide the project hero, which is why nobody
 * could have a full-width item that was not the hero. The lead visual is now
 * `project.banner`, which is not in this list at all.
 *
 * **Nothing here is cropped.** Every item in this layout is a piece of work and
 * is shown whole, at its own resolved ratio; a tall one stops growing rather
 * than being cut. That ceiling lives in `MediaFrame` and `media.css`, not here,
 * so it applies to a featured breakout and a packed column alike.
 *
 * Narrow windows collapse to one column, in the original content order.
 *
 * Session 7 note that still holds: a tile is a plain container, never a
 * `<button>`. Wrapping a `<video>` or a cross-origin `<iframe>` in a button is
 * invalid nesting and swallows every click meant for the player's own controls.
 * Focus Mode is entered through each adapter's own explicit affordance.
 */
import { useCallback, useRef, useState } from 'react';
import type { Discipline, MediaItem } from '@/types/content';
import { useColumnCount } from '@/hooks/useColumnCount';
import { packColumns } from '@/lib/masonry';
import { MediaRenderer } from './MediaRenderer';
import { MediaFocus, type FocusContext } from './MediaFocus';
import { estimateRatio } from './aspect';
import './media.css';

/** At or above this container width the masonry is two-up; below it, one. */
const COLUMN_STEPS = [620] as const;

interface Placed {
  item: MediaItem;
  /** Index into the original `media` array — what Focus Mode steps through. */
  index: number;
}

/**
 * How tall this item will be, relative to one column's width.
 *
 * `1 / ratio` is the picture. The rest is the caption block, approximated from
 * its length — precision is not the point, keeping a five-line caption from
 * being treated as free is.
 */
function estimateHeight(item: MediaItem): number {
  /*
   * Clamped, because a tall item no longer grows without limit: `--media-cap`
   * stops it, and packing a 9:16 as though it were 1.78 column-widths tall when
   * it will render nearer one leaves the other column badly short. The exact
   * cap depends on the window's height, which this pass deliberately does not
   * measure — so this is a bound, not a calculation.
   */
  const picture = Math.min(1 / estimateRatio(item), 2.2);
  const caption = item.caption?.trim();
  if (!caption) return picture + 0.03;
  const lines = Math.ceil(caption.length / 48) + caption.split('\n').length - 1;
  return picture + 0.05 + lines * 0.05;
}

/** Fill `count` columns shortest-first, preserving order within each column. */
function pack(items: Placed[], count: number): Placed[][] {
  return packColumns(items, count, (placed) => estimateHeight(placed.item));
}

interface MediaGalleryProps {
  media: MediaItem[];
  seed: string;
  discipline?: Discipline;
  /** Allow tiles to open in Focus Mode. */
  lightbox?: boolean;
  /**
   * Project context for Focus Mode — title, company, year.
   *
   * Existing fields only; Focus Mode renders a section only when it has
   * something to put in it, so an absent context simply shows less. Tools are
   * not part of it: each item carries its own `media.tools`, and the project's
   * list stays in the project footer.
   */
  context?: FocusContext;
}

export function MediaGallery({
  media,
  seed,
  discipline,
  lightbox = true,
  context,
}: MediaGalleryProps) {
  const host = useRef<HTMLDivElement>(null);
  const columns = useColumnCount(host, COLUMN_STEPS);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + media.length) % media.length,
      ),
    [media.length],
  );

  const tile = (placed: Placed) => (
    <div className="media-masonry__item" key={placed.item.id}>
      <MediaRenderer
        media={placed.item}
        seed={seed}
        discipline={discipline}
        mode="full"
        onFocus={lightbox ? () => setOpenIndex(placed.index) : undefined}
      />
    </div>
  );

  if (!media.length) return null;

  /*
   * Split into runs around the full-width items, so a breakout interrupts the
   * masonry and the packing starts fresh underneath it. Packing the whole list
   * and then hoisting the featured ones out would reorder the work.
   */
  const rows: ({ kind: 'full'; placed: Placed } | { kind: 'run'; items: Placed[] })[] = [];
  let run: Placed[] = [];
  media.forEach((item, index) => {
    if (item.featured) {
      if (run.length) rows.push({ kind: 'run', items: run });
      run = [];
      rows.push({ kind: 'full', placed: { item, index } });
    } else {
      run.push({ item, index });
    }
  });
  if (run.length) rows.push({ kind: 'run', items: run });

  return (
    <>
      <div className="media-masonry" ref={host} data-columns={columns}>
        {rows.map((row, i) =>
          row.kind === 'full' ? (
            <div className="media-masonry__full" key={row.placed.item.id}>
              {tile(row.placed)}
            </div>
          ) : (
            <div className="media-masonry__run" key={`run-${i}`}>
              {pack(row.items, columns).map((column, c) => (
                <div className="media-masonry__col" key={c}>
                  {column.map(tile)}
                </div>
              ))}
            </div>
          ),
        )}
      </div>

      {openIndex !== null && (
        <MediaFocus
          media={media}
          index={openIndex}
          seed={seed}
          discipline={discipline}
          context={context}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}
