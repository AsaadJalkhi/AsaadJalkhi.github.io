/**
 * The shell every media adapter renders inside: shape, caption, credit and the
 * honest "Sample" marker for demo content. Adapters only care about their own
 * payload — layout lives here.
 *
 * Two ways to be shaped, and the distinction matters:
 *
 *   **A declared box.** `aspect="9:16"`, or a `ratio` an adapter has measured.
 *   The stage gets `aspect-ratio` and the media fills it absolutely. Everything
 *   that cannot size itself — a video, an iframe, an embed — needs this.
 *
 *   **No box at all.** `fill`. The stage has no ratio and the child sizes the
 *   frame from the inside. This is what true Auto looks like for an image:
 *   nothing is cropped, nothing is letterboxed, and a 3:4 photograph is 3:4
 *   because that is what it is. Reserving a ratio and then fitting the image
 *   into it is precisely the behaviour "Auto" is supposed to avoid.
 *
 * The caption is editorial copy, not a label. It keeps its newlines, wraps
 * instead of overflowing, and grows the frame downwards — see `media.css`.
 */
import type { ReactNode } from 'react';
import type { Aspect } from '@/types/content';
import { cx } from '@/lib/utils';
import { DemoBadge } from '@/components/ui/Ui';
import { RATIO_CSS, isAuto } from './aspect';

/** CSS `aspect-ratio` for every ratio the schema allows. */
export const RATIOS = RATIO_CSS;

export interface MediaFrameProps {
  children: ReactNode;
  /** Manual shape from the content. Absent/'auto' defers to `ratio` or `fill`. */
  aspect?: Aspect;
  /**
   * A measured ratio (width ÷ height) for Auto items that cannot size
   * themselves — a video that has reported `videoWidth`, a cover image that has
   * been probed. Ignored when `aspect` is a manual value.
   */
  ratio?: number;
  /**
   * The item's own title (`media.title`), shown above the caption. Optional and
   * never inherited from anywhere: no title means no title element, not the
   * project's name standing in for it.
   */
  title?: string;
  caption?: string;
  credit?: string;
  demo?: boolean;
  /** Small chip in the corner, e.g. "YOUTUBE", "PDF". */
  kindLabel?: string;
  actions?: ReactNode;
  className?: string;
  /** Let the content size itself instead of filling a declared ratio. */
  fill?: boolean;
}

export function MediaFrame({
  children,
  aspect,
  ratio,
  title,
  caption,
  credit,
  demo,
  kindLabel,
  actions,
  className,
  fill,
}: MediaFrameProps) {
  // Manual first, then anything measured, then nothing — and nothing is a
  // perfectly good answer for a `fill` frame.
  const declared = isAuto(aspect)
    ? ratio && ratio > 0
      ? `${ratio}`
      : undefined
    : RATIO_CSS[aspect as Exclude<Aspect, 'auto'>];

  const sized = Boolean(declared) && !fill;

  return (
    <figure className={cx('media-frame', !sized && 'media-frame--fill', className)}>
      <div
        className="media-frame__stage"
        style={sized ? ({ aspectRatio: declared } as React.CSSProperties) : undefined}
      >
        {children}
        {kindLabel && <span className="media-frame__kind mono">{kindLabel}</span>}
      </div>

      {(title || caption || credit || demo || actions) && (
        <figcaption className="media-frame__caption">
          {title && <p className="media-frame__title">{title}</p>}
          {caption && <p className="media-frame__text">{caption}</p>}
          {(credit || demo || actions) && (
            <p className="media-frame__meta">
              {credit && <span className="media-frame__credit">{credit}</span>}
              {demo && <DemoBadge />}
              {actions && <span className="media-frame__actions">{actions}</span>}
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
