/**
 * The pictures inside one media item — a gallery's images or a website's
 * screenshots — as compact cards that fold and reorder.
 *
 * This replaced a `Repeater` that drew every picture as its full editor, so a
 * gallery of ten was ten forms deep. Each picture is now a `Collapsible` row
 * (grip, #NN, file name, arrows, duplicate, delete) that starts collapsed; the
 * editor inside is unchanged and its values live in the draft, so folding one
 * loses nothing.
 *
 * Everything here is **Studio UI state, never content**. Pictures have no id
 * in the schema and must not gain one, so each row gets a session-only key
 * that travels with it through every edit made here — move, duplicate,
 * delete, add. That is what keeps the right card open after a reorder, where
 * an index key would leave position 2 open whichever picture landed there.
 *
 * The drag is the media list's: grip only, native drag and drop, a private
 * drag type, before/after by the pointer's half of the card. A drop and the
 * arrows both call `move`, which is the one `moveItem` here. The array order
 * is the only thing stored.
 */
import { useState, type DragEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Btn } from '@/components/ui/Ui';
import type { MediaSubItem } from '@/types/content';
import { cx, moveItem, slotIndex, uid } from '@/lib/utils';
import { fileName } from './MediaList';
import { Collapsible, FoldBar, IconBtn, useFolds } from './parts';

/** The card under the pointer, and which side of it the drop would land on. */
type Drop = { index: number; after: boolean };

/*
 * Its own drag type: not `text/plain` (a caption field would paste it), and not
 * the media list's, so a picture can never be dropped among the media cards.
 */
const DRAG_TYPE = 'application/x-asaad-subitem';

/** What a collapsed row calls a picture: its file name, else its words. */
export function subItemLabel(sub: MediaSubItem, index: number, noun: string): string {
  return fileName(sub.src ?? sub.url) ?? sub.caption ?? sub.alt ?? `${noun} ${index + 1}`;
}

export function SubItemList({
  label,
  noun,
  items,
  onChange,
  addLabel,
  empty,
  children,
}: {
  label: string;
  /** "Image" or "Screenshot" — the fallback row name and the count. */
  noun: string;
  items: MediaSubItem[];
  onChange: (next: MediaSubItem[]) => void;
  addLabel: string;
  empty?: string;
  /** The full editor for one picture — rendered only while its card is open. */
  children: (item: MediaSubItem, patch: (changes: Partial<MediaSubItem>) => void) => ReactNode;
}) {
  const folds = useFolds();

  /*
   * One key per row, moved in step with the rows. A length this list did not
   * cause (a gallery just made from an image, a reloaded draft) keeps the keys
   * it can and mints the rest.
   */
  const [ownKeys, setKeys] = useState(() => items.map(() => uid('row')));
  const keys =
    ownKeys.length === items.length ? ownKeys : items.map((_, i) => ownKeys[i] ?? uid('row'));
  if (keys !== ownKeys) setKeys(keys);

  /** Rows and keys change together, so a key always names the same picture. */
  const commit = (rows: { item: MediaSubItem; key: string }[]) => {
    setKeys(rows.map((row) => row.key));
    onChange(rows.map((row) => row.item));
  };
  const rows = () => items.map((item, i) => ({ item, key: keys[i] ?? '' }));

  const patchAt = (index: number) => (changes: Partial<MediaSubItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  /** The one reorder: arrows and drops both end here, and the whole object moves. */
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    commit(moveItem(rows(), from, to));
  };

  const duplicate = (index: number) => {
    const next = rows();
    const source = next[index];
    if (!source) return;
    // Right after its source, as the Repeater did.
    next.splice(index + 1, 0, { item: structuredClone(source.item), key: uid('row') });
    commit(next);
  };

  const remove = (index: number) => commit(rows().filter((_, i) => i !== index));

  const add = () => {
    const key = uid('row');
    commit([...rows(), { item: {}, key }]);
    // A new picture has nothing in it yet, so it opens straight into its editor.
    folds.reveal(key);
  };

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  const startDrag = (index: number) => (event: DragEvent<HTMLElement>) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_TYPE, String(index));
    // The ghost is the whole card, not the small grip it was picked up by.
    const card = event.currentTarget.closest<HTMLElement>('[data-sub-index]');
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

  /* Top or bottom half of the card under the pointer; no line where nothing would move. */
  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-sub-index]');
    if (!card || !event.currentTarget.contains(card)) return;
    const index = Number(card.dataset.subIndex);
    const box = card.getBoundingClientRect();
    const after = event.clientY > box.top + box.height / 2;
    const slot = index + (after ? 1 : 0);
    const next = slot === dragFrom || slot === dragFrom + 1 ? null : { index, after };
    setDrop((prev) => (prev?.index === next?.index && prev?.after === next?.after ? prev : next));
  };

  const dropHere = (event: DragEvent<HTMLDivElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (drop) move(dragFrom, slotIndex(dragFrom, drop.index + (drop.after ? 1 : 0)));
    endDrag();
  };

  const grip = (index: number) => (
    <span
      className="studio-media-grip"
      draggable
      role="img"
      aria-label="Drag to reorder image"
      title="Drag to reorder image"
      onDragStart={startDrag(index)}
      onDragEnd={endDrag}
    >
      <GripVertical strokeWidth={1.5} />
    </span>
  );

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
      <IconBtn label="Delete" danger onClick={() => remove(index)}>
        <Trash2 strokeWidth={1.5} />
      </IconBtn>
    </>
  );

  const count = `${items.length} ${noun.toLowerCase()}${items.length === 1 ? '' : 's'}`;

  return (
    <div
      className="studio-rep studio-sublist"
      onDragOver={dragOver}
      onDrop={dropHere}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
      }}
    >
      <span className="mono studio-rep__title">{label}</span>
      {items.length === 0 && empty && <p className="studio-rep__empty">{empty}</p>}
      {items.length > 0 && <FoldBar folds={folds} ids={keys} count={count} />}

      {items.map((item, index) => (
        <Collapsible
          key={keys[index]}
          className={cx(
            dragFrom === index && 'is-dragging',
            drop?.index === index && (drop.after ? 'is-drop-after' : 'is-drop-before'),
          )}
          data-sub-index={index}
          index={index}
          title={subItemLabel(item, index, noun)}
          lead={grip(index)}
          actions={tools(index)}
          open={folds.isOpen(keys[index] ?? '')}
          onToggle={() => folds.toggle(keys[index] ?? '')}
        >
          {children(item, patchAt(index))}
        </Collapsible>
      ))}

      <Btn variant="quiet" size="sm" icon={<Plus />} onClick={add}>
        {addLabel}
      </Btn>
    </div>
  );
}
