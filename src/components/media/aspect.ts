/**
 * What shape is this?
 *
 * One definition of "Auto", used by every adapter, by Focus Mode and by the
 * masonry packer, so a picture is never a different shape in two places.
 *
 * The rule:
 *
 *   **A manual aspect always wins.** 9:16, 4:5, 1:1, 16:9, 3:2, 4:3 — if the
 *   content says one of those, that is the answer, everywhere, no exceptions.
 *
 *   **Otherwise, use the media's REAL ratio.** Not a house default dressed up
 *   as automatic. An image reports `naturalWidth`/`naturalHeight`; a video
 *   reports `videoWidth`/`videoHeight`; anything with a cover image can be
 *   measured from the cover. That is what "Auto" has to mean, or a 3000×4000
 *   photograph gets letterboxed into 16:9 and the person who uploaded it
 *   reasonably concludes the site is broken.
 *
 *   **Fall back only where the real ratio is genuinely unknowable.** A
 *   cross-origin YouTube or Drive iframe will not tell us the shape of the
 *   video inside it, so those get 16:9 — which is what they almost always are —
 *   and Instagram gets 4:5 for the same reason. This is the last resort, not
 *   the first answer.
 *
 * `'auto'` as a stored string and an absent `aspect` are the same thing. There
 * is exactly one Auto; see `AspectSchema` in types/content.ts.
 */
import { useEffect, useState } from 'react';
import type { Aspect, MediaItem, MediaType } from '@/types/content';
import { asset } from '@/lib/paths';

/** Width ÷ height for every ratio the schema allows. */
export const RATIO: Record<Exclude<Aspect, 'auto'>, number> = {
  '16:9': 16 / 9,
  '4:5': 4 / 5,
  '1:1': 1,
  '9:16': 9 / 16,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
};

/** CSS `aspect-ratio` strings, for when a box has to be declared up front. */
export const RATIO_CSS: Record<Exclude<Aspect, 'auto'>, string> = {
  '16:9': '16 / 9',
  '4:5': '4 / 5',
  '1:1': '1 / 1',
  '9:16': '9 / 16',
  '3:2': '3 / 2',
  '4:3': '4 / 3',
};

/**
 * Is this item asking for its own shape? Absent and the legacy `'auto'` string
 * are deliberately the same answer.
 */
export function isAuto(aspect?: Aspect): boolean {
  return !aspect || aspect === 'auto';
}

/** The manual ratio, or undefined when the item wants Auto. */
export function manualRatio(aspect?: Aspect): number | undefined {
  return isAuto(aspect) ? undefined : RATIO[aspect as Exclude<Aspect, 'auto'>];
}

/**
 * Where to land when Auto cannot be resolved from the media itself.
 *
 * Only reached for embeds we cannot measure through, and for the split second
 * before an image or video reports its own dimensions.
 */
export const FALLBACK_RATIO: Record<MediaType, number> = {
  image: 4 / 3,
  gallery: 4 / 3,
  video: 16 / 9,
  youtube: 16 / 9,
  vimeo: 16 / 9,
  drive: 16 / 9,
  instagram: 4 / 5,
  website: 16 / 9,
  pdf: 3 / 2,
  embed: 16 / 9,
  generative: 16 / 9,
};

/**
 * The best ratio guess available without loading anything.
 *
 * Used by the masonry packer, which has to decide which column an item goes in
 * before the browser has fetched a single byte. Being approximately right here
 * costs nothing — the item still renders at its true size, the columns just end
 * up slightly less even than they could have been.
 */
export function estimateRatio(item: MediaItem): number {
  return manualRatio(item.aspect) ?? FALLBACK_RATIO[item.type] ?? 16 / 9;
}

/**
 * Measure an image's real ratio by loading it out of band.
 *
 * The browser serves the second request from cache — this is the same URL the
 * `<img>` is already fetching — so it costs a cache hit, not a download. Used
 * where the shape has to be known *before* the thing that needs it renders: a
 * cover image standing in for an Instagram embed, a Drive poster, the frame of
 * a Focus Mode box.
 *
 * Returns undefined until it knows, and stays undefined if the file is missing,
 * so every caller needs its fallback anyway.
 */
export function useImageRatio(src?: string): number | undefined {
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  const resolved = asset(src);

  useEffect(() => {
    if (!resolved) {
      setRatio(undefined);
      return;
    }
    let live = true;
    const probe = new Image();
    probe.onload = () => {
      if (live && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setRatio(probe.naturalWidth / probe.naturalHeight);
      }
    };
    // A missing file is not an error here — the caller falls back.
    probe.onerror = () => {
      if (live) setRatio(undefined);
    };
    probe.src = resolved;
    return () => {
      live = false;
    };
  }, [resolved]);

  return ratio;
}

/**
 * The resolved ratio for one media item, cover measurement included.
 *
 * This is the function Focus Mode uses, because Focus Mode has to size a box
 * before it knows what goes in it. Adapters that render a real element
 * (`<img>`, `<video>`) can do better — they read the element's own dimensions —
 * so they use their own local measurement instead.
 */
export function useMediaRatio(media: MediaItem): number {
  const manual = manualRatio(media.aspect);

  // Whichever still image best represents this item's shape. For an image, it
  // is the image; for a video or embed, whatever cover was supplied.
  const coverSrc =
    media.type === 'image' || media.type === 'gallery'
      ? (media.src ?? media.url ?? media.thumbnail)
      : (media.poster ?? media.thumbnail);

  // Hooks cannot be called conditionally, so measurement always runs; the
  // manual value simply wins when it exists.
  const measured = useImageRatio(manual ? undefined : coverSrc);

  return manual ?? measured ?? FALLBACK_RATIO[media.type] ?? 16 / 9;
}

/** The resolved ratio for one gallery image / website screenshot. */
export function useSubItemRatio(
  item: { src?: string; url?: string; aspect?: Aspect } | undefined,
): number | undefined {
  const manual = manualRatio(item?.aspect);
  const measured = useImageRatio(manual ? undefined : (item?.src ?? item?.url));
  return manual ?? measured;
}
