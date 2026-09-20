import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useState } from 'react';
import { usePortfolio } from '@/state/portfolio';
import { findProject, primaryDiscipline } from '@/lib/contentStore';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { MediaRenderer, MEDIA_LABELS } from '@/components/media/MediaRenderer';
import { RATIOS } from '@/components/media/MediaFrame';
import { Btn, DemoBadge, Empty } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/**
 * Media player / viewer. Steps through the media of one project so a video
 * window doubles as a lightweight reel.
 *
 * Session 7: this used to render `mode="full"`, which meant every item arrived
 * wrapped in a `MediaFrame` — so the window drew the caption in the frame *and*
 * again in its own bar below, and every item was forced into the frame's 16:9
 * default no matter what it was. A 9:16 Reel opened here came out letterboxed
 * inside a widescreen box inside a window the person had just resized to suit
 * it.
 *
 * The window is the frame. It renders `mode="focus"` (bare media, no frame, no
 * caption, no ratio of its own) into a box shaped by the item's own aspect and
 * bounded by the window, and keeps the caption, the counter and the honest
 * Sample marker in its bar where they belong.
 */
export function MediaApp({ win }: AppProps) {
  const portfolio = usePortfolio();
  const project = findProject(portfolio, win.payload.projectId);
  const startIndex = Math.max(
    0,
    project?.media.findIndex((item) => item.id === win.payload.mediaId) ?? 0,
  );
  const [index, setIndex] = useState(startIndex);
  const { openProject } = useOpenTarget();

  if (!project || project.media.length === 0) {
    return <Empty title="Media not found" hint="Check the media id in portfolio.json." />;
  }

  const media = project.media[Math.min(index, project.media.length - 1)];
  if (!media) return <Empty title="Media not found" />;

  // Same default as Focus Mode: Instagram is portrait-ish far more often than
  // not, so an unset aspect there should not fall back to widescreen.
  const aspect = media.aspect ?? (media.type === 'instagram' ? '4:5' : 'auto');

  const step = (delta: number) =>
    setIndex((current) => (current + delta + project.media.length) % project.media.length);

  return (
    <div className="player">
      <div className="player__stage">
        <div
          className="player__box"
          data-type={media.type}
          style={aspect === 'auto' ? undefined : { aspectRatio: RATIOS[aspect] }}
        >
          {/* `key` remounts the adapter when stepping, so the previous item's
              iframe or <video> cannot keep playing behind the new one. */}
          <MediaRenderer
            key={media.id}
            media={media}
            seed={project.id}
            discipline={primaryDiscipline(project)}
            mode="focus"
            priority
          />
        </div>
      </div>

      <div className="player__bar">
        <div className="player__info">
          <span className="player__title">
            {media.caption ?? media.id}
            {media.demo && (
              <>
                {' '}
                <DemoBadge />
              </>
            )}
          </span>
          <span className="mono player__meta">
            {MEDIA_LABELS[media.type]} · {index + 1} of {project.media.length}
          </span>
        </div>

        <div className="player__controls">
          {project.media.length > 1 && (
            <>
              <Btn size="sm" variant="ghost" icon={<ChevronLeft />} onClick={() => step(-1)} aria-label="Previous item" />
              <Btn size="sm" variant="ghost" icon={<ChevronRight />} onClick={() => step(1)} aria-label="Next item" />
            </>
          )}
          <Btn size="sm" variant="outline" icon={<Layers />} onClick={() => openProject(project.id)}>
            Case study
          </Btn>
        </div>
      </div>
    </div>
  );
}
