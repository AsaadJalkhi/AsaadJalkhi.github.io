/**
 * A website you made.
 *
 * **This no longer iframes anything, and that is the point.** Embedding a live
 * site you do not control has exactly two outcomes and never a third: a blank
 * rectangle, because the site sends `X-Frame-Options` or a
 * `frame-ancestors` CSP — which most do, and every serious one does — or, if it
 * does allow framing, someone else's cookie banner, navigation and consent
 * modal rendered inside your case study at a window size nobody designed for.
 * A broken grey box with a scrollbar is not a portfolio piece.
 *
 * So a website is presented the way print always presented one: **your own
 * screenshots**, art-directed, at the size you chose, plus an explicit link for
 * anyone who wants the real thing. You control the crop, the state of the page
 * and what is on screen. Nothing loads from the other site, so nothing about it
 * can change, break, or start tracking your visitors.
 *
 * Three shapes, by how much you have:
 *
 *   **No screenshots** — a quiet link preview: the domain and a labelled way
 *   through to it. Deliberately minimal. Better an honest small card than a
 *   large empty frame pretending something failed to load.
 *   **One** — a single preview image at its own real shape.
 *   **Several** — a small gallery, each at its own shape, each openable.
 *
 * `media.iframe` is read by nothing here any more. It stays in the schema so
 * existing content keeps validating; see the note on it in types/content.ts.
 */
import { useCallback, useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn } from '@/components/ui/Ui';
import { hostOf } from '@/lib/paths';
import { MediaFrame } from '../MediaFrame';
import { isAuto } from '../aspect';
import { MediaFocus } from '../MediaFocus';
import { asMediaItems, screenshotItems } from '../subitems';
import type { AdapterProps } from '../types';

export function WebsiteMedia({ media, seed, discipline, mode, priority }: AdapterProps) {
  const shots = screenshotItems(media);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + shots.length) % shots.length,
      ),
    [shots.length],
  );

  const host = hostOf(media.url) || 'the site';
  const visit = () => window.open(media.url, '_blank', 'noopener,noreferrer');

  const shot = (index: number, className: string, natural: boolean) => {
    const item = shots[index];
    return (
      <button
        type="button"
        className={`media-open ${className}`}
        onClick={() => setOpenIndex(index)}
        aria-label={item.alt ? `Open ${item.alt} larger` : `Open screenshot ${index + 1} larger`}
      >
        <SmartImage
          src={item.src ?? item.url}
          alt={item.alt ?? item.caption ?? `Screenshot of ${host}`}
          seed={`${seed}-${media.id}-${index}`}
          discipline={discipline}
          label={item.caption ?? media.caption}
          eager={priority && index === 0}
          natural={natural}
          objectFit="contain"
          // A natural image sizes its own container; `media-fill` would pin it
          // to a box that, in a `fill` frame, has no height to pin it to.
          className={natural ? undefined : 'media-fill'}
        />
      </button>
    );
  };

  /* -------------------------------------------- card and focus: one image */

  if (mode === 'card' || mode === 'focus') {
    if (!shots.length) {
      return (
        <div className="media-linkcard media-fill">
          <Globe strokeWidth={1.4} />
          <span className="media-linkcard__host mono">{host}</span>
        </div>
      );
    }
    const first = shots[0];
    return (
      <SmartImage
        src={first.src ?? first.url}
        alt={first.alt ?? `Screenshot of ${host}`}
        seed={`${seed}-${media.id}-0`}
        discipline={discipline}
        label={media.caption}
        eager={priority}
        objectFit={mode === 'card' ? 'cover' : 'contain'}
        className="media-fill"
      />
    );
  }

  /* ------------------------------------------------------- full: the case */

  const action = media.url ? (
    <Btn size="sm" variant="ghost" iconEnd={<ExternalLink />} onClick={visit}>
      Visit Website
    </Btn>
  ) : undefined;

  // Nothing to show: a small, honest link preview rather than an empty frame.
  if (!shots.length) {
    return (
      <MediaFrame
        fill
        title={media.title}
        caption={media.caption}
        credit={media.credit}
        demo={media.demo}
        kindLabel="Website"
      >
        <div className="media-linkpreview">
          <span className="media-linkpreview__icon" aria-hidden="true">
            <Globe strokeWidth={1.4} />
          </span>
          <span className="media-linkpreview__body">
            <span className="media-linkpreview__title">{media.alt ?? host}</span>
            <span className="media-linkpreview__host mono">{host}</span>
          </span>
          {media.url && (
            <a
              className="media-linkpreview__go"
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Website ↗
            </a>
          )}
        </div>
      </MediaFrame>
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
        kindLabel="Website"
        actions={action}
      >
        {shots.length === 1 ? (
          shot(0, 'media-shot media-shot--single', isAuto(shots[0].aspect))
        ) : (
          <div className="media-set" data-count={Math.min(shots.length, 3)}>
            {shots.map((item, index) => (
              <figure className="media-set__item" key={item.id ?? `${media.id}-${index}`}>
                {shot(index, 'media-set__shot', isAuto(item.aspect))}
                {item.caption && <figcaption className="media-set__caption">{item.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </MediaFrame>

      {openIndex !== null && (
        <MediaFocus
          media={asMediaItems(media, shots)}
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
