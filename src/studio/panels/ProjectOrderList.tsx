/**
 * One ordered list of projects in the Projects sidebar — a folder's projects,
 * or the featured ones in Quick View.
 *
 * Rows are compact: grip, #NN, title, a line of meta, and up/down arrows.
 * Clicking the row selects the project; only the grip starts a drag. A drop
 * resolves to an insertion slot exactly as in MediaList, and drops and arrows
 * both call the one `onMove(from, to)` the caller gives — which is a
 * `lib/projectOrder` writer for that collection.
 *
 * Drag state lives in this instance, so a row can only land in the list it came
 * from: dragging between folders (or into Quick View) is not possible. None of
 * it reaches the draft.
 */
import { useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { Project } from '@/types/content';
import { cx, slotIndex } from '@/lib/utils';
import { IconBtn } from './parts';

/** The row under the pointer, and which half of it the drop would land on. */
type Drop = { index: number; after: boolean };

/* A private drag type, as in MediaList, so no text field accepts the payload. */
const DRAG_TYPE = 'application/x-asaad-project';

export function ProjectOrderList({
  projects,
  selectedId,
  onSelect,
  onMove,
  meta,
  what,
}: {
  projects: Project[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  /** The small line under the title. */
  meta: (project: Project) => string;
  /** "in this folder" / "in Quick View" — for the grip and arrow labels. */
  what: string;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  const startDrag = (index: number) => (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_TYPE, String(index));
    const row = event.currentTarget.closest<HTMLElement>('[data-order-index]');
    if (row) {
      const box = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(row, event.clientX - box.left, event.clientY - box.top);
    }
    setDragFrom(index);
  };

  const endDrag = () => {
    setDragFrom(null);
    setDrop(null);
  };

  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-order-index]');
    if (!row) return;
    const index = Number(row.dataset.orderIndex);
    const box = row.getBoundingClientRect();
    const after = event.clientY > box.top + box.height / 2;
    const slot = index + (after ? 1 : 0);
    const next = slot === dragFrom || slot === dragFrom + 1 ? null : { index, after };
    setDrop((prev) => (prev?.index === next?.index && prev?.after === next?.after ? prev : next));
  };

  const dropHere = (event: DragEvent<HTMLDivElement>) => {
    if (dragFrom === null) return;
    event.preventDefault();
    if (drop) onMove(dragFrom, slotIndex(dragFrom, drop.index + (drop.after ? 1 : 0)));
    endDrag();
  };

  return (
    <div
      className="studio-order"
      onDragOver={dragOver}
      onDrop={dropHere}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
      }}
    >
      {projects.map((project, index) => (
        <div
          key={project.id}
          data-order-index={index}
          className={cx(
            'studio-order__row',
            project.id === selectedId && 'studio-order__row--active',
            dragFrom === index && 'is-dragging',
            drop?.index === index && (drop.after ? 'is-drop-after' : 'is-drop-before'),
          )}
        >
          <span
            className="studio-media-grip"
            draggable
            role="img"
            aria-label={`Drag to reorder ${what}`}
            title={`Drag to reorder ${what}`}
            onDragStart={startDrag(index)}
            onDragEnd={endDrag}
          >
            <GripVertical strokeWidth={1.5} />
          </span>
          <button type="button" className="studio-order__pick" onClick={() => onSelect(project.id)}>
            <span className="mono studio-rep__index">#{String(index + 1).padStart(2, '0')}</span>
            <span className="studio-order__text">
              <span className="studio-list__title">
                {project.title}
                {project.featured && <span className="studio-list__star">★</span>}
              </span>
              <span className="mono studio-list__meta">{meta(project)}</span>
            </span>
          </button>
          <IconBtn
            label={`Move up ${what}`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUp strokeWidth={1.5} />
          </IconBtn>
          <IconBtn
            label={`Move down ${what}`}
            disabled={index === projects.length - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDown strokeWidth={1.5} />
          </IconBtn>
        </div>
      ))}
    </div>
  );
}
