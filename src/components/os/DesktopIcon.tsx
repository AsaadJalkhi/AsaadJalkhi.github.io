/**
 * A single icon on the desktop.
 *
 * Click selects, double-click (or Enter) opens — except on touch, where a
 * single tap opens, because nobody double-taps a phone. Position and dragging
 * are owned by useDesktopLayout; this component only renders what it is told.
 *
 * Artwork resolves in three steps, each falling back to the next:
 *   1. `icon.imageLight` / `icon.imageDark` — a real file, per theme, with the
 *      legacy single `icon.image` standing in for either;
 *   2. `icon.text`  — a short monogram, in `icon.tint` if one is set;
 *   3. the built-in lucide glyph for the item's kind.
 * A broken image path drops to the glyph rather than showing a torn thumbnail.
 *
 * **Nothing here is put on a plate.** Every one of those three is drawn as a
 * bare mark at the same 72px footprint: no raised tile, no gradient, no filled
 * backdrop, no rounded container clipping it. A logo exported as a transparent
 * PNG looks on the desktop exactly like it looks in the file, and the folder
 * next to it reads as the same kind of object rather than as a button. Removing
 * the tile from the *fallbacks* too is the point — one desktop, one visual
 * language, artwork and glyph alike.
 *
 * **The button owns the pointer.** The `<img>` is inert: `draggable={false}` and
 * `pointer-events: none`, so a press in the middle of the artwork reaches this
 * element rather than starting a native browser image drag. See the note on the
 * image below, and `useDesktopLayout` for the drag itself.
 */
import { useState, type PointerEvent } from 'react';
import { Film, FileText, Folder, Image, Layers, LayoutGrid, Link2, StickyNote } from 'lucide-react';
import type { ComponentType } from 'react';
import type { DesktopItem } from '@/types/content';
import { useIsTouch } from '@/hooks/useEnvironment';
import { useResolvedTheme } from '@/hooks/useTheme';
import type { LayoutPoint } from '@/hooks/useDesktopLayout';
import { asset } from '@/lib/paths';
import { cx } from '@/lib/utils';

const GLYPHS: Record<DesktopItem['kind'], ComponentType<{ strokeWidth?: number }>> = {
  folder: Folder,
  document: FileText,
  note: StickyNote,
  video: Film,
  image: Image,
  link: Link2,
  pdf: FileText,
  app: LayoutGrid,
  design: Layers,
};

export function DesktopIcon({
  item,
  point,
  selected,
  dragging,
  wrapped,
  onPointerDown,
  onSelect,
  onOpen,
}: {
  item: DesktopItem;
  point: LayoutPoint;
  selected: boolean;
  dragging: boolean;
  wrapped: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const touch = useIsTouch();
  const theme = useResolvedTheme();
  const Glyph = GLYPHS[item.kind];

  // One file per theme, because a logo drawn in black vanishes on a dark
  // desktop. Either may be omitted, and the legacy single `image` covers both.
  const icon = item.icon;
  const source =
    theme === 'dark'
      ? (icon?.imageDark ?? icon?.image ?? icon?.imageLight)
      : (icon?.imageLight ?? icon?.image ?? icon?.imageDark);

  // The failure is remembered per path, not as a flag: a missing dark-mode file
  // must not condemn the light-mode one when the visitor switches back.
  const resolved = asset(source);
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const image = resolved && resolved !== failedSrc ? resolved : undefined;

  const monogram = item.icon?.text?.trim();
  const tint = item.icon?.tint;

  return (
    <button
      type="button"
      className={cx(
        'dicon',
        selected && 'dicon--selected',
        dragging && 'dicon--dragging',
        wrapped && 'dicon--wrapped',
      )}
      data-kind={item.kind}
      data-discipline={item.accent}
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        ['--rotate' as string]: `${item.rotate}deg`,
      }}
      onPointerDown={onPointerDown}
      onClick={() => (touch ? onOpen() : onSelect())}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open ${item.label}`}
    >
      {image ? (
        // Bare. No plate, no tint, no clipping — see the note at the top.
        <span className="dicon__art">
          <img
            className="dicon__img"
            src={image}
            alt=""
            /*
             * The desktop item — this button — owns the pointer gesture.
             *
             * Without these, pressing on the artwork and moving started
             * Chrome's own image drag: a translucent copy of the PNG followed
             * the cursor (and floated over the widgets), the pointer stream to
             * `useDesktopLayout` was cut off mid-gesture, and the shortcut
             * stayed put. Dragging only worked if you grabbed the label or the
             * padding around the picture.
             *
             * `draggable={false}` turns off the native behaviour, the
             * `onDragStart` guard covers the browsers that still start one, and
             * `pointer-events: none` in the stylesheet makes every press land
             * on the button instead of the image. Clicking still works, because
             * the click is the button's.
             */
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onError={() => setFailedSrc(resolved)}
          />
          {item.badge && <span className="mono dicon__badge">{item.badge}</span>}
        </span>
      ) : (
        /*
         * Fallback: a glyph or a monogram, drawn as a mark — NOT set on a
         * rounded plate. A generic icon and a custom PNG should read as the same
         * kind of object on the same desktop, and one of them wearing a button
         * was what made the row look mismatched.
         *
         * `icon.tint` survives as the colour of the mark itself. It used to
         * paint a filled square behind it, which is the plate this pass removes.
         */
        <span className="dicon__glyph" style={tint ? { color: tint } : undefined}>
          {monogram ? (
            <span className="dicon__mono">{monogram}</span>
          ) : (
            <Glyph strokeWidth={1.3} />
          )}
          {item.badge && <span className="mono dicon__badge">{item.badge}</span>}
        </span>
      )}
      <span className="dicon__label">{item.label}</span>
    </button>
  );
}
