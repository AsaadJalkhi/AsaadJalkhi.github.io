import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Instagram } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn } from '@/components/ui/Ui';
import { useInView } from '@/hooks/useInView';
import { MediaFrame } from '../MediaFrame';
import { FALLBACK_RATIO, isAuto, useImageRatio } from '../aspect';
import { FocusButton } from '../FocusAffordance';
import type { AdapterProps } from '../types';

/**
 * Instagram — best-effort, and labelled as such.
 *
 * Instagram is the one platform where we cannot honour the playback contract in
 * full, and pretending otherwise would be a lie in the code. The official embed
 * is an opaque cross-origin iframe: we cannot mute it, cannot autoplay it,
 * cannot pause it when it scrolls away, and cannot read whether it worked. It
 * is also the slowest embed on the web and it breaks outright for private or
 * removed posts.
 *
 * So the rules here are deliberately narrower than for YouTube or Vimeo:
 *   - the embed DOES initialise automatically when the item comes into view,
 *     like everything else. The "Load embed" button is gone.
 *   - autoplay is NOT claimed, requested or faked. Instagram decides.
 *   - we do not scrape Instagram for a raw video file, and we do not touch
 *     private or undocumented endpoints to get one. That would break, and it
 *     would deserve to.
 *
 * The graceful hierarchy when the embed cannot render: supplied cover, then a
 * clean neutral fallback, always with an explicit "View original post". A
 * supplied cover is strongly recommended for Instagram for exactly this reason.
 */

const SCRIPT_SRC = 'https://www.instagram.com/embed.js';
const GIVE_UP_MS = 6000;

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

function loadEmbedScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('blocked')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('blocked'));
    document.body.appendChild(script);
  });
}

export function InstagramMedia({ media, seed, discipline, mode, priority, onFocus }: AdapterProps) {
  const { ref, near } = useInView({ eager: priority });
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const holder = useRef<HTMLDivElement>(null);

  // `instagramUrl` is the friendlier alias; either may carry the permalink.
  const permalink = media.instagramUrl ?? media.url;

  /*
   * Auto, for a box we are not allowed to look inside.
   *
   * The official embed is opaque and we do not restyle or measure through it —
   * that is the standing decision and it stands. So: the supplied cover's real
   * shape is the post's shape, measured; failing that 4:5, which is Instagram's
   * portrait default and the least wrong single guess for a feed post. A Reel
   * should say 9:16 explicitly, or supply a cover, which it should anyway.
   */
  const auto = isAuto(media.aspect);
  const coverRatio = useImageRatio(auto ? (media.thumbnail ?? media.src) : undefined);
  const ratio = auto ? (coverRatio ?? FALLBACK_RATIO.instagram) : undefined;

  // Auto-initialise on approach — this is what replaced the Load embed button.
  useEffect(() => {
    if (near && permalink && state === 'idle') setState('loading');
  }, [near, permalink, state]);

  useEffect(() => {
    if (state !== 'loading') return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!cancelled) setState((current) => (current === 'loading' ? 'failed' : current));
    }, GIVE_UP_MS);

    loadEmbedScript()
      .then(() => {
        if (cancelled) return;
        window.instgrm?.Embeds.process();
        // The script swaps the blockquote for an iframe when it succeeds. There
        // is no callback and no event, so polling the DOM is the only signal
        // available — hence the timeout rather than a promise.
        window.setTimeout(() => {
          if (cancelled) return;
          const ok = holder.current?.querySelector('iframe');
          setState(ok ? 'ready' : 'failed');
        }, 1500);
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state]);

  const open = () => permalink && window.open(permalink, '_blank', 'noopener,noreferrer');

  const cover = (
    <SmartImage
      src={media.thumbnail ?? media.src}
      alt={media.alt ?? media.caption ?? 'Instagram post'}
      seed={`${seed}-${media.id}`}
      discipline={discipline}
      label={media.caption}
      className="media-fill"
    />
  );

  const embedding = state === 'loading' || state === 'ready';

  const body = (
    <div className="media-player" ref={ref}>
      {/* Cover underneath: visible while the embed loads, and left showing if
          it never arrives. No spinner over the artwork. */}
      <div className="media-player__under">{cover}</div>

      {embedding && permalink && (
        <div className="media-instagram" ref={holder} data-state={state}>
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={permalink}
            data-instgrm-version="14"
            data-instgrm-captioned={undefined}
          />
        </div>
      )}

      {/* Failed, or no permalink at all: the artwork plus one honest action. */}
      {!embedding && (
        <button
          type="button"
          className="media-facade media-facade--quiet"
          onClick={permalink ? open : undefined}
          disabled={!permalink}
        >
          <span className="media-facade__play media-facade__play--soft" aria-hidden="true">
            <Instagram strokeWidth={1.5} />
          </span>
          <span className="media-facade__note">
            {permalink ? 'View original post' : 'No Instagram URL set'}
          </span>
        </button>
      )}

      {mode === 'full' && onFocus && <FocusButton onClick={onFocus} />}
    </div>
  );

  if (mode === 'card' || mode === 'focus') return body;

  return (
    <MediaFrame
      aspect={media.aspect}
      ratio={ratio}
      title={media.title}
      caption={media.caption}
      credit={media.credit}
      demo={media.demo}
      kindLabel="Instagram"
      actions={
        permalink ? (
          <Btn size="sm" variant="ghost" iconEnd={<ExternalLink />} onClick={open}>
            View original post
          </Btn>
        ) : undefined
      }
    >
      {body}
    </MediaFrame>
  );
}
