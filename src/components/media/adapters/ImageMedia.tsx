/**
 * Stills — a single image, and the gallery a single image becomes.
 *
 * Auto is real here. With no manual aspect the frame declares no ratio at all
 * and the picture sizes the frame from the inside, so a portrait photograph is
 * portrait and a panorama is a panorama. A manual aspect still wins, and still
 * letterboxes rather than crops, because an explicit 16:9 on a 3:4 image is an
 * instruction about the frame, not permission to cut the picture up.
 *
 * A still is safe to make clickable in a way a video never is: there are no
 * player controls underneath to steal the click from. So the whole image opens
 * Focus Mode, which is what everyone tries first.
 */
import { useCallback, useState } from 'react';
import type { Discipline, MediaItem } from '@/types/content';
import { SmartImage } from '@/components/ui/SmartImage';
import { MediaFrame } from '../MediaFrame';
import { isAuto } from '../aspect';
import { MediaFocus } from '../MediaFocus';
import { asMediaItems, galleryItems } from '../subitems';
import type { AdapterProps } from '../types';

export function ImageMedia({ media, seed, discipline, mode, priority, onFocus }: AdapterProps) {
  const auto = isAuto(media.aspect);
  // In `card` and `focus` the container has already decided the box, so the
  // image fills it. In `full` with Auto it is the other way round.
  const natural = auto && mode === 'full';

  const body = (
    <SmartImage
      src={media.src ?? media.thumbnail ?? media.url}
      alt={media.alt ?? media.caption ?? 'Project image'}
      seed={`${seed}-${media.id}`}
      discipline={discipline}
      label={media.caption ?? media.alt}
      eager={priority}
      natural={natural}
      objectFit={mode === 'card' ? 'cover' : 'contain'}
      // A natural image sizes its own container; `media-fill` pins it to a box,
      // which is right for every mode except the one where there is no box.
      className={natural ? undefined : 'media-fill'}
    />
  );

  if (mode === 'card' || mode === 'focus') return body;

  return (
    <MediaFrame
      aspect={media.aspect}
      fill={natural}
      title={media.title}
      caption={media.caption}
      credit={media.credit}
      demo={media.demo}
    >
      {onFocus ? (
        <button type="button" className="media-open" onClick={onFocus} aria-label="Open larger">
          {body}
        </button>
      ) : (
        body
      )}
    </MediaFrame>
  );
}

/**
 * Several stills.
 *
 * Not a contact sheet of thumbnails any more: each image keeps its own shape
 * and its own caption, and clicking one opens it full size with the arrow keys
 * stepping through the set. That is what a gallery is for — the old fixed
 * three-up strip cropped every picture to the same rectangle, which is the one
 * thing a gallery of work must not do.
 */
export function GalleryMedia({ media, seed, discipline, mode, priority }: AdapterProps) {
  const items = galleryItems(media);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + items.length) % items.length,
      ),
    [items.length],
  );

  if (!items.length) return null;

  // Card and focus modes show one representative image — a grid inside a
  // lightbox is a grid you cannot look at.
  if (mode === 'card' || mode === 'focus') {
    const first = items[0];
    return (
      <SmartImage
        src={first.src ?? first.url}
        alt={first.alt ?? media.alt ?? 'Project image'}
        seed={`${seed}-${media.id}-0`}
        discipline={discipline}
        label={media.caption}
        eager={priority}
        objectFit={mode === 'card' ? 'cover' : 'contain'}
        className="media-fill"
      />
    );
  }

  return (
    <>
      <MediaFrame
        fill
        title={media.title}
        caption={media.caption}
        credit={media.credit}
        demo={media.demo}
        kindLabel={items.length > 1 ? `${items.length} images` : undefined}
      >
        <div className="media-set" data-count={Math.min(items.length, 3)}>
          {items.map((item, index) => (
            <figure className="media-set__item" key={item.id ?? `${media.id}-${index}`}>
              <button
                type="button"
                className="media-open"
                onClick={() => setOpenIndex(index)}
                aria-label={item.alt ? `Open ${item.alt} larger` : 'Open larger'}
              >
                <SmartImage
                  src={item.src ?? item.url}
                  alt={item.alt ?? item.caption ?? `Image ${index + 1}`}
                  seed={`${seed}-${media.id}-${index}`}
                  discipline={discipline}
                  label={item.caption}
                  natural={isAuto(item.aspect)}
                  objectFit="contain"
                  className={isAuto(item.aspect) ? undefined : 'media-set__img'}
                />
              </button>
              {item.caption && <figcaption className="media-set__caption">{item.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </MediaFrame>

      {openIndex !== null && (
        <MediaFocus
          media={asMediaItems(media, items)}
          index={openIndex}
          seed={seed}
          discipline={discipline}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}

export type { Discipline, MediaItem };
