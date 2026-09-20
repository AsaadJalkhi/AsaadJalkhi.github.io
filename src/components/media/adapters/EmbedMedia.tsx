import { ExternalLink } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn } from '@/components/ui/Ui';
import { useInView } from '@/hooks/useInView';
import { MediaFrame } from '../MediaFrame';
import { FALLBACK_RATIO, isAuto, useImageRatio } from '../aspect';
import { FocusButton } from '../FocusAffordance';
import type { AdapterProps } from '../types';

/**
 * YouTube / Vimeo / generic iframes.
 *
 * These used to be click-to-load facades. They are not any more: a project is
 * a showcase, and making someone press play on every item before they can see
 * the work was the wrong trade. The player now initialises itself when the item
 * comes near the viewport (`useInView`, not on page load — a project with ten
 * videos still opens ten connections only if you scroll past all ten) and asks
 * for muted inline autoplay, which is what both platforms permit.
 *
 * "Asks for" is the honest verb. Muted autoplay is allowed by policy but not
 * guaranteed: data-saver mode, low-power mode and some mobile browsers refuse
 * it. When that happens the real player is still sitting there loaded and one
 * tap away — which is a better failure than a facade, because the visitor's tap
 * lands on the actual play button instead of on a loading state.
 *
 * `youtube-nocookie` is kept: no third-party cookie is set until playback.
 */

export function youTubeId(url?: string): string | undefined {
  if (!url) return undefined;
  const patterns = [
    /youtu\.be\/([\w-]{6,})/,
    /[?&]v=([\w-]{6,})/,
    /youtube\.com\/embed\/([\w-]{6,})/,
    /youtube\.com\/shorts\/([\w-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export function vimeoId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1];
}

/**
 * The embed URL, built for muted inline autoplay.
 *
 * YouTube requires `playlist=<id>` alongside `loop=1` — `loop` alone is a no-op
 * on a single video, which is an old and well-buried platform quirk.
 */
function embedUrl(media: AdapterProps['media']): string | undefined {
  if (media.type === 'youtube') {
    const id = youTubeId(media.url);
    if (!id) return undefined;
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1',
      playsinline: '1',
      loop: '1',
      playlist: id,
      rel: '0',
      modestbranding: '1',
    });
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
  }
  if (media.type === 'vimeo') {
    const id = vimeoId(media.url);
    if (!id) return undefined;
    const params = new URLSearchParams({
      autoplay: '1',
      muted: '1',
      playsinline: '1',
      loop: '1',
      title: '0',
      byline: '0',
    });
    return `https://player.vimeo.com/video/${id}?${params}`;
  }
  return media.url;
}

export function EmbedMedia({ media, seed, discipline, mode, priority, onFocus }: AdapterProps) {
  const { ref, near } = useInView({ eager: priority });
  const src = embedUrl(media);
  const label = media.type === 'youtube' ? 'YouTube' : media.type === 'vimeo' ? 'Vimeo' : 'Embed';

  /*
   * Auto, for something we cannot see inside.
   *
   * A cross-origin player iframe will not tell us the shape of the video it is
   * playing — there is no API for it that does not mean loading each platform's
   * JavaScript SDK, which would hand two third parties a script on every page
   * that mentions them. So: if a cover image was supplied, its shape is the
   * video's shape, and that is measured. Otherwise 16:9, which these are.
   *
   * Which is the honest reason Cover / Thumbnail is worth filling in for a
   * vertical YouTube Short.
   */
  const auto = isAuto(media.aspect);
  const coverRatio = useImageRatio(auto ? (media.thumbnail ?? media.poster) : undefined);
  const ratio = auto ? (coverRatio ?? FALLBACK_RATIO[media.type] ?? 16 / 9) : undefined;

  const cover = (
    <SmartImage
      src={media.thumbnail ?? media.poster}
      alt={media.alt ?? media.caption ?? `${label} video`}
      seed={`${seed}-${media.id}`}
      discipline={discipline}
      label={media.caption}
      className="media-fill"
    />
  );

  const body = (
    <div className="media-player" ref={ref}>
      {/*
       * The cover sits underneath, not over: an iframe cannot tell us when it
       * has painted, so fading a cover out on a timer would either flash or
       * linger. Underneath, it simply stops being visible the moment the player
       * draws over it — and stays as the fallback if the player never does.
       */}
      <div className="media-player__under">{cover}</div>

      {near && src ? (
        <iframe
          className="media-fill media-iframe"
          src={src}
          title={media.caption ?? `${label} embed`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : null}

      {!src && (
        <div className="media-placeholder__overlay">
          <p className="media-placeholder__title">No {label} URL set</p>
          <p className="media-placeholder__hint mono">Add it in Studio → Media</p>
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
      title={media.title}
      caption={media.caption}
      credit={media.credit}
      demo={media.demo}
      ratio={ratio}
      kindLabel={label}
      actions={
        media.url ? (
          <Btn
            size="sm"
            variant="ghost"
            iconEnd={<ExternalLink />}
            onClick={() => window.open(media.url, '_blank', 'noopener,noreferrer')}
          >
            Open on {label}
          </Btn>
        ) : undefined
      }
    >
      {body}
    </MediaFrame>
  );
}
