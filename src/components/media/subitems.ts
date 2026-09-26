/**
 * Gallery images and website screenshots, turned into things Focus Mode can
 * show.
 *
 * Both are the same shape (`MediaSubItem`) and both want the same behaviour
 * when clicked: open full size, step with the arrow keys, caption underneath.
 * Focus Mode only knows how to display `MediaItem`s, so rather than teach it a
 * second vocabulary, each sub-item is promoted to a real image item here. One
 * viewer, one set of keyboard shortcuts, one place to fix anything.
 */
import type { MediaItem, MediaSubItem } from '@/types/content';

/**
 * The images in a gallery.
 *
 * Falls back to the item's own `src` because a gallery is an image that grew: a
 * legacy item, or one mid-edit in the Studio, may still be carrying its picture
 * on the parent rather than in `items`. Losing that picture would be the worst
 * possible outcome of adding a second one.
 */
export function galleryItems(media: MediaItem): MediaSubItem[] {
  if (media.items?.length) return media.items;
  if (media.src || media.url) {
    return [{ src: media.src, url: media.url, alt: media.alt, aspect: media.aspect }];
  }
  return [];
}

/** The screenshots of a website. Zero is a valid answer — see `WebsiteMedia`. */
export function screenshotItems(media: MediaItem): MediaSubItem[] {
  if (media.screenshots?.length) return media.screenshots;
  // Legacy: a website item whose only still was the `thumbnail` cover.
  if (media.thumbnail) return [{ src: media.thumbnail, alt: media.alt }];
  return [];
}

/**
 * Promote sub-items to full media items so the lightbox can show them.
 *
 * The parent's credit, tools, date and demo flag ride along: a screenshot of a
 * site built for a client is still that client's work, a gallery shot on one
 * camera in one week was still shot on that camera in that week, and a sample
 * gallery is still a sample when you open one of its pictures. Each picture keeps
 * its **own** caption, alt text and shape, because those are about the picture.
 */
export function asMediaItems(parent: MediaItem, items: MediaSubItem[]): MediaItem[] {
  return items.map((item, index) => ({
    id: item.id ?? `${parent.id}-${index}`,
    type: 'image' as const,
    src: item.src,
    url: item.url,
    alt: item.alt ?? parent.alt,
    caption: item.caption,
    credit: parent.credit,
    tools: parent.tools,
    date: parent.date,
    aspect: item.aspect,
    demo: parent.demo,
  }));
}
