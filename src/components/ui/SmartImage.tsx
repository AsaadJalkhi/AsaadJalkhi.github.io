/**
 * Lazy image with a generated fallback.
 *
 * Never shows a broken-image icon: if the file is missing (common while the
 * portfolio is still filled with demo content) it renders a Poster instead.
 */
import { useState } from 'react';
import type { Discipline } from '@/types/content';
import { asset } from '@/lib/paths';
import { cx } from '@/lib/utils';
import { Poster } from './Poster';

interface SmartImageProps {
  src?: string;
  alt: string;
  seed: string;
  discipline?: Discipline;
  label?: string;
  className?: string;
  /** Load immediately instead of lazily — use for above-the-fold hero art. */
  eager?: boolean;
  objectFit?: 'cover' | 'contain';
  /**
   * Size the container from the image instead of filling one.
   *
   * This is what Auto means for a still: no reserved box, no letterboxing, no
   * crop — the picture is as tall as it actually is and the layout works around
   * it. The fallback Poster keeps a gentle 4:3 so a missing file does not
   * collapse to nothing.
   */
  natural?: boolean;
  /** Told the image's real ratio once the browser knows it. */
  onRatio?: (ratio: number) => void;
}

export function SmartImage({
  src,
  alt,
  seed,
  discipline,
  label,
  className,
  eager,
  objectFit = 'cover',
  natural,
  onRatio,
}: SmartImageProps) {
  const resolved = asset(src);
  const [state, setState] = useState<'idle' | 'loaded' | 'failed'>(resolved ? 'idle' : 'failed');

  if (!resolved || state === 'failed') {
    return (
      <span className={cx('smart-image', natural && 'smart-image--natural', className)}>
        <Poster seed={seed} label={label} discipline={discipline} className="smart-image__fallback" />
      </span>
    );
  }

  return (
    <span className={cx('smart-image', natural && 'smart-image--natural', className)}>
      {state === 'idle' && <span className="smart-image__skeleton" aria-hidden="true" />}
      <img
        className="smart-image__img"
        src={resolved}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        data-loaded={state === 'loaded'}
        style={natural ? undefined : { objectFit }}
        onLoad={(event) => {
          setState('loaded');
          const img = event.currentTarget;
          if (onRatio && img.naturalWidth > 0 && img.naturalHeight > 0) {
            onRatio(img.naturalWidth / img.naturalHeight);
          }
        }}
        onError={() => setState('failed')}
      />
    </span>
  );
}
