/**
 * Desktop widgets.
 *
 * Three types, deliberately few. `clock` is the practical one — the thing a real
 * desktop has. `note` is the personal one: a pinned sticky whose text comes
 * straight from the content file. `reaction` is the playful one, and lives in
 * its own file because it is the only one with state.
 *
 * No live services. Nothing here fetches anything; the clock reads the device
 * clock and the note reads JSON. That is the whole feature, and keeping it that
 * small is what stops the desktop turning into a dashboard.
 */
import { useEffect, useState, type PointerEvent } from 'react';
import type { Widget } from '@/types/content';
import type { LayoutPoint } from '@/hooks/useDesktopLayout';
import { cx } from '@/lib/utils';
import { ReactionWidget } from './ReactionWidget';

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Aligned to the next minute so the display never lags by up to 30s.
    let interval: number | undefined;
    const timeout = window.setTimeout(
      () => {
        setNow(new Date());
        interval = window.setInterval(() => setNow(new Date()), 60_000);
      },
      (60 - new Date().getSeconds()) * 1000,
    );
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, []);
  return now;
}

const LABELS: Record<Widget['type'], string> = {
  clock: 'Clock',
  note: 'Note',
  reaction: 'Reaction time test',
};

export function DesktopWidget({
  widget,
  point,
  dragging,
  onPointerDown,
}: {
  widget: Widget;
  point: LayoutPoint;
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
}) {
  const now = useNow();

  return (
    <div
      className={cx('widget', `widget--${widget.type}`, dragging && 'widget--dragging')}
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      onPointerDown={onPointerDown}
      role="note"
      aria-label={widget.title ?? LABELS[widget.type]}
    >
      {widget.type === 'clock' && (
        <>
          <span className="widget__label">{widget.title ?? 'Local time'}</span>
          <span className="widget__time">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="widget__date">
            {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </>
      )}

      {widget.type === 'note' && (
        <>
          {widget.title && <p className="widget__title">{widget.title}</p>}
          {widget.body && <p className="widget__body">{widget.body}</p>}
        </>
      )}

      {widget.type === 'reaction' && <ReactionWidget title={widget.title} />}
    </div>
  );
}
