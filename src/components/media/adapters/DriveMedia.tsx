/**
 * Google Drive video.
 *
 * The case for this existing at all: a lot of client work ships as a file in a
 * Drive folder and never gets a YouTube or Vimeo home. Asking someone to
 * re-upload their own finished video to a public platform just to put it in
 * their portfolio is a bad trade, and pasting a Drive link into the `video`
 * type produced a silently broken player.
 *
 * Which is the thing to be careful about here: **a Drive share URL is not a
 * video file.** `https://drive.google.com/file/d/<id>/view` returns an HTML
 * page, so handing it to `<video src>` gives you a player that reports a
 * network error and nothing else. Drive's only supported embed is the
 * `/preview` iframe, which is what this uses.
 *
 * What that costs, said plainly rather than papered over:
 *
 *   - **Autoplay is not guaranteed.** The preview player is Google's, inside a
 *     cross-origin iframe; it does not accept an autoplay parameter and we
 *     cannot reach in and press play. It very often opens paused. That is why
 *     the cover image matters and why there is no pretending otherwise.
 *   - **The file must be shared.** "Anyone with the link can view". A
 *     restricted file renders a Google sign-in page inside the frame, which is
 *     Drive working correctly and looks like the site being broken.
 *   - **No shape information.** Same as every other cross-origin player: the
 *     iframe will not say what it contains, so Auto uses the cover image's real
 *     ratio if there is one, and 16:9 if there is not.
 *
 * Everything else matches the rest of the media layer: it initialises as it
 * approaches the viewport, never on page load, and there is no "Load embed"
 * button to press.
 */
import { ExternalLink } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn } from '@/components/ui/Ui';
import { useInView } from '@/hooks/useInView';
import { MediaFrame } from '../MediaFrame';
import { FALLBACK_RATIO, isAuto, useImageRatio } from '../aspect';
import { FocusButton } from '../FocusAffordance';
import type { AdapterProps } from '../types';

/**
 * Pull the file id out of whatever Drive link someone pasted.
 *
 * Drive hands out several shapes depending on where you copied from — the
 * share dialog, the address bar, an old "open?id=" link, a direct download URL.
 * They all contain the same id, so all of them are accepted rather than making
 * anyone learn which one is the right one to copy.
 */
export function driveFileId(url?: string): string | undefined {
  if (!url) return undefined;
  const patterns = [
    /drive\.google\.com\/file\/d\/([\w-]{10,})/,
    /drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([\w-]{10,})/,
    /docs\.google\.com\/(?:file|uc)\/d\/([\w-]{10,})/,
    /drive\.google\.com\/drive\/[^?#]*\/d\/([\w-]{10,})/,
    /[?&]id=([\w-]{10,})/,
    /\/d\/([\w-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

/** The only embeddable form of a Drive file. */
export function drivePreviewUrl(url?: string): string | undefined {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : undefined;
}

export function DriveMedia({ media, seed, discipline, mode, priority, onFocus }: AdapterProps) {
  const { ref, near } = useInView({ eager: priority });
  const source = media.url ?? media.src;
  const src = drivePreviewUrl(source);

  const auto = isAuto(media.aspect);
  const coverRatio = useImageRatio(auto ? (media.thumbnail ?? media.poster) : undefined);
  const ratio = auto ? (coverRatio ?? FALLBACK_RATIO.drive) : undefined;

  const cover = (
    <SmartImage
      src={media.thumbnail ?? media.poster}
      alt={media.alt ?? media.caption ?? 'Video still'}
      seed={`${seed}-${media.id}`}
      discipline={discipline}
      label={media.caption}
      className="media-fill"
    />
  );

  const body = (
    <div className="media-player" ref={ref}>
      {/*
       * Underneath rather than over, for the same reason as every other iframe
       * here: there is no event that tells us a cross-origin frame has painted,
       * so a cover that fades out on a timer either flashes or lingers. Under
       * it, the cover is simply what you see until the player draws over it —
       * and what you keep seeing if the player never does.
       */}
      <div className="media-player__under">{cover}</div>

      {near && src ? (
        <iframe
          className="media-fill media-iframe"
          src={src}
          title={media.caption ?? 'Google Drive video'}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : null}

      {!src && (
        <div className="media-placeholder__overlay">
          <p className="media-placeholder__title">
            {source ? 'That is not a Google Drive link' : 'No Google Drive link set'}
          </p>
          <p className="media-placeholder__hint mono">Add it in Studio → Media → Google Drive video</p>
        </div>
      )}

      {mode === 'full' && onFocus && <FocusButton onClick={onFocus} />}
    </div>
  );

  // In focus mode the lightbox owns the box — no frame, no caption, no ratio.
  if (mode === 'card' || mode === 'focus') return body;

  return (
    <MediaFrame
      aspect={media.aspect}
      ratio={ratio}
      title={media.title}
      caption={media.caption}
      demo={media.demo}
      kindLabel="Drive"
      actions={
        source ? (
          <Btn
            size="sm"
            variant="ghost"
            iconEnd={<ExternalLink />}
            onClick={() => window.open(source, '_blank', 'noopener,noreferrer')}
          >
            Open in Google Drive
          </Btn>
        ) : undefined
      }
    >
      {body}
    </MediaFrame>
  );
}
