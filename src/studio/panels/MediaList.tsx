/**
 * The media list of one project — compact cards, List or Grid.
 *
 * This replaced a `Repeater` that drew every media item as its fully expanded
 * editor. At ten items, and especially with galleries, that was a page several
 * screens long in which the only way to find the fifth item was to scroll past
 * the first four forms. Now every item is a one-line card until it is opened.
 *
 * Everything here is **Studio UI state, never content**:
 *
 *   - which cards are open is a `useFolds` set of media ids. It is
 *     session-only, and it resets when another project is selected because the
 *     caller keys this component by project id. Nothing about it reaches the
 *     draft, the export or the schema.
 *   - List / Grid is a preference, so it is remembered in localStorage under
 *     its own key, beside — not inside — the draft.
 *
 * The list operations (reorder, duplicate, delete, add) behave exactly as the
 * `Repeater` did: the same `moveItem`, the same id de-duplication on copy, the
 * same `onChange(next)` contract. A gallery is still one item; its images are
 * edited inside the expanded card, never promoted to cards of their own.
 *
 * Drag to reorder starts from the grip on each card or tile, never from the
 * card itself, so expanding, typing and the icon buttons cannot start a drag.
 * A drop resolves to an insertion slot and goes through the same `move` as the
 * arrows — one array, one reorder, in both views. The drag itself (which item,
 * which slot) is component state and never reaches the draft.
 */
import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  Trash2,
} from 'lucide-react';
import { Btn } from '@/components/ui/Ui';
import type { MediaItem } from '@/types/content';
import { asset } from '@/lib/paths';
import { readStore, storageKeys, writeStore } from '@/lib/storage';
import { cx, moveItem, slotIndex } from '@/lib/utils';
import { Collapsible, FoldBar, IconBtn, uniqueSlug, useFolds } from './parts';

type View = 'list' | 'grid';

/** The card under the pointer, and which side of it the drop would land on. */
type Drop = { index: number; after: boolean };

/*
 * A private drag type, not `text/plain`: a text field inside an open card would
 * accept plain text as a drop and paste the payload into itself.
 */
const DRAG_TYPE = 'application/x-asaad-media';

/** React keys from the media id; a repeated id (hand-edited JSON) gets its position too. */
function itemKeys(items: MediaItem[]): string[] {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const key = seen.has(item.id) ? `${item.id}-${index}` : item.id;
    seen.add(item.id);
    return key;
  });
}

/** Short names for the compact row — the dropdown's long labels do not fit. */
const TYPE_LABEL: Record<MediaItem['type'], string> = {
  image: 'Image',
  gallery: 'Gallery',
  video: 'Video',
  instagram: 'Instagram',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  drive: 'Drive',
  website: 'Website',
  pdf: 'PDF',
  embed: 'Embed',
  generative: 'Generative',
};

/** The last path segment, without a query string. */
function fileName(path?: string): string | undefined {
  if (!path) return undefined;
  const clean = path.split(/[?#]/)[0]?.replace(/[\\/]+$/, '') ?? '';
  const name = clean.split(/[\\/]/).pop();
  return name || undefined;
}

/** `https://www.example.com/a/b` → `example.com/a/b`. Never the whole URL. */
function shortUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return undefined;
  }
}

/**
 * What the compact card calls this item. Title first; then a file name from a
 * local source; then something specific to the type; then the type itself.
 * The stored values are never changed — long ones are truncated by CSS.
 */
export function mediaLabel(item: MediaItem): string {
  const title = item.title?.trim();
  if (title) return title;

  const local = item.src ?? item.items?.[0]?.src ?? item.screenshots?.[0]?.src;
  const file = fileName(local);
  if (file) return file;

  switch (item.type) {
    case 'instagram':
      return shortUrl(item.instagramUrl ?? item.url) ?? TYPE_LABEL[item.type];
    case 'generative':
      return item.scene ? `Scene · ${item.scene}` : TYPE_LABEL[item.type];
    default: {
      const remote = item.url ?? item.items?.[0]?.url ?? item.screenshots?.[0]?.url;
      return shortUrl(remote) ?? fileName(remote) ?? TYPE_LABEL[item.type];
    }
  }
}

/** "Gallery · 8 images", "Website · 3 screenshots", or just the type. */
export function mediaKind(item: MediaItem): string {
  const type = TYPE_LABEL[item.type] ?? item.type;
  if (item.type === 'gallery') {
    const count = item.items?.length ?? 0;
    return `${type} · ${count} image${count === 1 ? '' : 's'}`;
  }
  if (item.type === 'website' && item.screenshots?.length) {
    const count = item.screenshots.length;
    return `${type} · ${count} screenshot${count === 1 ? '' : 's'}`;
  }
  return type;
}

/** A picture to put on a grid tile, if the item has one we can show cheaply. */
function preview(item: MediaItem): { kind: 'img' | 'video'; src: string } | undefined {
  const still =
    item.thumbnail ??
    item.poster ??
    (item.type === 'image' ? (item.src ?? item.url) : undefined) ??
    item.items?.[0]?.src ??
    item.items?.[0]?.url ??
    item.screenshots?.[0]?.src ??
    item.screenshots?.[0]?.url;
  const img = asset(still);
  if (img) return { kind: 'img', src: img };
  if (item.type === 'video') {
    const video = asset(item.src ?? item.url);
    if (video) return { kind: 'video', src: video };
  }
  return undefined;
}

function Thumb({ item }: { item: MediaItem }) {
  const shown = preview(item);
  const [broken, setBroken] = useState<string | null>(null);

  if (!shown || broken === shown.src) {
    return <span className="mono studio-media-tile__none">{TYPE_LABEL[item.type]}</span>;
  }
  return shown.kind === 'img' ? (
    <img src={shown.src} alt="" loading="lazy" onError={() => setBroken(shown.src)} />
  ) : (
    // Metadata only: enough for the first frame, not the whole file.
    <video src={shown.src} preload="metadata" muted playsInline onError={() => setBroken(shown.src)} />
  );
}

export function MediaList({
  items,
  onChange,
  create,
  children,
}: {
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  create: () => MediaItem;
  /** The full editor for one item — rendered only while its card is open. */
  children: (item: MediaItem, patch: (changes: Partial<MediaItem>) => void) => ReactNode;
}) {
  const [view, setViewState] = useState<View>(() =>
    readStore<View>(storageKeys.studioMediaView, 'list') === 'grid' ? 'grid' : 'list',
  );
  const folds = useFolds();
  /** The card a grid tile asked for, scrolled to once the list has rendered it. */
  const [reveal, setReveal] = useState<string | null>(null);

  const setView = (next: View) => {
    setViewState(next);
    writeStore(storageKeys.studioMediaView, next);
  };

  useEffect(() => {
    if (!reveal || view !== 'list') return;
    document
      .querySelector(`[data-media-card="${CSS.escape(reveal)}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setReveal(null);
  }, [reveal, view]);

  /** From a grid tile: open that item's editor in the list, where it has room. */
  const edit = (id: string) => {
    folds.reveal(id);
    setView('list');
    setReveal(id);
  };

  const patchAt = (index: number) => (changes: Partial<MediaItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const duplicate = (index: number) => {
    const source = items[index];
    if (!source) return;
    const copy = structuredClone(source);
    // A copy must not inherit the original's id — see Repeater.
    copy.id = uniqueSlug(
      items.map((other) => other.id),
      `${source.id}-copy`,
    );
    const next = [...items];
    next.splice(index + 1, 0, copy);
    onChange(next);
  };

  const add = () => {
    const item = create();
    onChange([...items, item]);
    // A new item has nothing in it yet, so it opens straight into its editor.
    folds.reveal(item.id);
  };

  /** The one reorder: arrows and drops both end here. */
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    onChange(moveItem(items, from, to));
  };

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  const startDrag = (index: number) => (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_TYPE, String(index));
    // The ghost is the whole card, not the small grip it was picked up by.
    const card = event.currentTarget.closest<HTMLElement>('[data-media-index]');
    if (card) {
      const box = card.getBoundingClientRect();
      event.dataTransfer.setDragImage(card, event.clientX - box.left, event.clientY - box.top);
    }
    setDragFrom(index);
  };

  const endDrag = () => {
    setDragFrom(null);
    setDrop(null);
  };

  /*
   * Before or after the card under the pointer: top/bottom half in List, left/
   * right half in Grid, where a row wraps. A target that would not move the
   * item (either side of itself) shows no line, so every line shown is a move.
   */
  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-media-index]');
    if (!card) return;
    const index = Number(card.dataset.mediaIndex);
    const box = card.getBoundingClientRect();
    const after =
      view === 'grid'
        ? event.clientX > box.left + box.width / 2
        : event.clientY > box.top + box.height / 2;
    const slot = index + (after ? 1 : 0);
    const next = slot === dragFrom || slot === dragFrom + 1 ? null : { index, after };
    setDrop((prev) => (prev?.index === next?.index && prev?.after === next?.after ? prev : next));
  };

  const dropHere = (event: DragEvent<HTMLDivElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    if (drop) move(dragFrom, slotIndex(dragFrom, drop.index + (drop.after ? 1 : 0)));
    endDrag();
  };

  /** Dragging, and the insertion line, for one card or tile. */
  const dragState = (index: number) =>
    cx(
      dragFrom === index && 'is-dragging',
      drop?.index === index && (drop.after ? 'is-drop-after' : 'is-drop-before'),
    );

  const grip = (index: number) => (
    <span
      className="studio-media-grip"
      draggable
      role="img"
      aria-label="Drag to reorder media"
      title="Drag to reorder media"
      onDragStart={startDrag(index)}
      onDragEnd={endDrag}
    >
      <GripVertical strokeWidth={1.5} />
    </span>
  );

  const keys = itemKeys(items);

  const tools = (index: number) => (
    <>
      <IconBtn label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)}>
        <ArrowUp strokeWidth={1.5} />
      </IconBtn>
      <IconBtn
        label="Move down"
        disabled={index === items.length - 1}
        onClick={() => move(index, index + 1)}
      >
        <ArrowDown strokeWidth={1.5} />
      </IconBtn>
      <IconBtn label="Duplicate" onClick={() => duplicate(index)}>
        <Copy strokeWidth={1.5} />
      </IconBtn>
      <IconBtn label="Delete" danger onClick={() => onChange(items.filter((_, i) => i !== index))}>
        <Trash2 strokeWidth={1.5} />
      </IconBtn>
    </>
  );

  return (
    <div
      className="studio-media"
      onDragOver={dragOver}
      onDrop={dropHere}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
      }}
    >
      {items.length > 0 && (
        <FoldBar
          folds={folds}
          ids={items.map((item) => item.id)}
          count={`${items.length} item(s)`}
          bulk={view === 'list'}
        >
          <div className="studio-media__view" role="group" aria-label="Media view">
            <button
              type="button"
              className={cx('studio-media__view-btn', view === 'list' && 'is-on')}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List strokeWidth={1.5} /> List
            </button>
            <button
              type="button"
              className={cx('studio-media__view-btn', view === 'grid' && 'is-on')}
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid strokeWidth={1.5} /> Grid
            </button>
          </div>
        </FoldBar>
      )}

      {items.length === 0 && (
        <p className="studio-rep__empty">
          No media yet — that is fine. Add one when you have a file or a link.
        </p>
      )}

      {view === 'list' ? (
        items.map((item, index) => (
          <Collapsible
            key={keys[index]}
            className={dragState(index)}
            data-media-card={item.id}
            data-media-index={index}
            index={index}
            tag={mediaKind(item)}
            title={mediaLabel(item)}
            lead={grip(index)}
            actions={tools(index)}
            open={folds.isOpen(item.id)}
            onToggle={() => folds.toggle(item.id)}
          >
            {children(item, patchAt(index))}
          </Collapsible>
        ))
      ) : (
        <div className="studio-media-grid">
          {items.map((item, index) => (
            <article
              key={keys[index]}
              className={cx('studio-media-tile', dragState(index))}
              data-media-index={index}
            >
              <button
                type="button"
                className="studio-media-tile__open"
                title="Edit this media item"
                onClick={() => edit(item.id)}
              >
                <span className="studio-media-tile__thumb">
                  <Thumb item={item} />
                </span>
                <span className="studio-media-tile__meta">
                  <span className="mono studio-media-tile__line">
                    #{String(index + 1).padStart(2, '0')} · {mediaKind(item)}
                  </span>
                  <span className="studio-media-tile__label">{mediaLabel(item)}</span>
                </span>
              </button>
              <div className="studio-media-tile__tools">
                {grip(index)}
                {tools(index)}
              </div>
            </article>
          ))}
        </div>
      )}

      <Btn variant="quiet" size="sm" icon={<Plus />} onClick={add}>
        Add media
      </Btn>
    </div>
  );
}
