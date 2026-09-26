import { useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/paths';
import { SmartImage } from '@/components/ui/SmartImage';
import { useInView } from '@/hooks/useInView';
import { usePrefersReducedMotion } from '@/hooks/useEnvironment';
import { MediaFrame } from '../MediaFrame';
import { FALLBACK_RATIO, isAuto, useImageRatio } from '../aspect';
import { FocusButton } from '../FocusAffordance';
import type { AdapterProps } from '../types';

/**
 * Local or remote MP4 / webm.
 *
 * The contract (PROJECT_STATUS §5, session 7): video behaves like video. It
 * loads as it approaches the viewport, plays muted and inline when it is on
 * screen, and pauses when it is not. There is no play facade to click through
 * and nothing about it navigates away from the portfolio.
 *
 * `preload` is driven by proximity rather than pinned to "none": a page of ten
 * videos still downloads nothing until you scroll towards them, but the one you
 * are about to reach is already buffering. That is what makes it feel instant
 * without making it expensive.
 *
 * The poster is optional *on purpose*. Given a file but no poster, we let the
 * browser decode and show the first frame (`preload="metadata"` plus the
 * `#t=0.001` media fragment, which is what nudges iOS and Safari into painting
 * a frame instead of a black rectangle). Generated Poster art is a fallback for
 * media with no file at all, not a tax on every real video.
 */
export function VideoMedia({ media, seed, discipline, mode, priority, onFocus }: AdapterProps) {
  const { ref, near, visible } = useInView({ eager: priority });
  const video = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();
  const [showPoster, setShowPoster] = useState(true);

  const source = asset(media.src ?? media.url);
  const poster = asset(media.poster ?? media.thumbnail);

  /*
   * Auto means the video's REAL shape, and a video knows it: once metadata has
   * loaded, `videoWidth`/`videoHeight` are the actual dimensions of the file.
   * A vertical Reel therefore renders vertical without anyone having to
   * remember to set 9:16.
   *
   * The poster is measured as well, because it arrives first — it gives the
   * frame the right shape immediately instead of starting at 16:9 and jumping
   * when the video's metadata lands.
   */
  const auto = isAuto(media.aspect);
  const [videoRatio, setVideoRatio] = useState<number | undefined>(undefined);
  const posterRatio = useImageRatio(auto && !videoRatio ? (media.poster ?? media.thumbnail) : undefined);
  const ratio = auto ? (videoRatio ?? posterRatio ?? FALLBACK_RATIO.video) : undefined;

  // Play when looked at, pause when not. `play()` rejects if the browser blocks
  // it (a muted inline video rarely is, but a low-power-mode phone will) — the
  // catch is required or it surfaces as an unhandled rejection in the console.
  useEffect(() => {
    const node = video.current;
    if (!node || !source) return;
    if (visible && !reduced) {
      void node.play().catch(() => {
        /* blocked — controls are right there, and the poster still reads */
      });
    } else {
      node.pause();
    }
  }, [visible, reduced, source]);

  const posterArt = (
    <SmartImage
      src={media.poster ?? media.thumbnail}
      alt={media.alt ?? media.caption ?? 'Video still'}
      seed={`${seed}-${media.id}`}
      discipline={discipline}
      label={media.caption}
      className="media-fill"
    />
  );

  let body;

  if (!source) {
    // Honest placeholder — no request, no console noise, no broken player.
    body = (
      <div className="media-placeholder">
        {posterArt}
        <div className="media-placeholder__overlay">
          <p className="media-placeholder__title">No video file attached</p>
          <p className="media-placeholder__hint mono">Add a path in Studio → Media → Video</p>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="media-player" ref={ref}>
        {/*
         * The cover sits above the video and fades out on first frame. Without
         * an explicit poster there is nothing to fade, so it is skipped and the
         * video's own decoded frame is what you see — see the header.
         */}
        {showPoster && poster && <div className="media-player__cover">{posterArt}</div>}
        <video
          ref={video}
          className="media-fill media-video"
          src={near ? `${source}${source.includes('#') ? '' : '#t=0.001'}` : undefined}
          poster={poster}
          controls
          muted
          loop
          playsInline
          preload={near ? 'metadata' : 'none'}
          onLoadedMetadata={(event) => {
            const node = event.currentTarget;
            if (node.videoWidth > 0 && node.videoHeight > 0) {
              setVideoRatio(node.videoWidth / node.videoHeight);
            }
          }}
          onLoadedData={() => setShowPoster(false)}
        />
        {mode === 'full' && onFocus && <FocusButton onClick={onFocus} />}
      </div>
    );
  }

  if (mode === 'card' || mode === 'focus') return body;

  return (
    <MediaFrame
      aspect={media.aspect}
      ratio={ratio}
      title={media.title}
      caption={media.caption}
      demo={media.demo}
      kindLabel="Video"
    >
      {body}
    </MediaFrame>
  );
}
