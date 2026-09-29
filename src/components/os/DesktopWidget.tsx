/**
 * Desktop widgets — and, through `WidgetContent`, the phone's too.
 *
 * Four types, deliberately few. `clock` is the practical one — the thing a real
 * desktop has. `note` is the personal one: a pinned sticky whose text comes
 * straight from the content file. `reaction` is the playful one. `weather` is
 * the one live service, and says "Weather unavailable" rather than break.
 * `reaction` and `weather` live in their own files because they hold state.
 *
 * Only `weather` fetches anything, from a keyless public API, for a place
 * written in the content. Keeping the set this small is what stops the desktop
 * turning into a dashboard.
 */
import { useEffect, useState, type PointerEvent } from 'react';
import type { Widget } from '@/types/content';
import type { LayoutPoint } from '@/hooks/useDesktopLayout';
import { cx } from '@/lib/utils';
import { ReactionWidget } from './ReactionWidget';
import { WeatherWidget } from './WeatherWidget';

export function useNow(): Date {
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

export const WIDGET_LABELS: Record<Widget['type'], string> = {
  clock: 'Clock',
  note: 'Note',
  reaction: 'Reaction time test',
  weather: 'Weather',
};

/**
 * What a widget shows, without where it sits. The desktop wraps it in a
 * draggable, percentage-positioned panel; the mobile home screen wraps it in a
 * static square tile. One set of widgets, drawn by one component, in two shells.
 *
 * `variant` is presentation only. A `tile` is square, so the clock splits its
 * date over two short lines instead of one long one; the time, the data and
 * the logic are the same.
 */
export function WidgetContent({
  widget,
  variant = 'panel',
}: {
  widget: Widget;
  variant?: 'panel' | 'tile';
}) {
  if (widget.type === 'clock') return <ClockContent title={widget.title} variant={variant} />;
  if (widget.type === 'reaction') return <ReactionWidget title={widget.title} />;
  if (widget.type === 'weather') {
    return (
      <WeatherWidget title={widget.title} latitude={widget.latitude} longitude={widget.longitude} />
    );
  }
  return (
    <>
      {widget.title && <p className="widget__title">{widget.title}</p>}
      {widget.body && <p className="widget__body">{widget.body}</p>}
    </>
  );
}

function ClockContent({ title, variant }: { title?: string; variant: 'panel' | 'tile' }) {
  const now = useNow();
  if (variant === 'tile') {
    // A 12-hour locale's "AM/PM" is set small, so the digits can be large in a square.
    const parts = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    const period = parts.find((part) => part.type === 'dayPeriod')?.value;
    const time = parts
      .filter((part) => part.type !== 'dayPeriod')
      .map((part) => part.value)
      .join('')
      .trim();
    return (
      <>
        <span className="widget__label">{title ?? 'Local time'}</span>
        <span className="widget__time">
          {time}
          {period && <span className="widget__period">{period}</span>}
        </span>
        <span className="widget__date">
          <span>{now.toLocaleDateString([], { weekday: 'long' })}</span>
          <span>{now.toLocaleDateString([], { day: 'numeric', month: 'long' })}</span>
        </span>
      </>
    );
  }
  return (
    <>
      <span className="widget__label">{title ?? 'Local time'}</span>
      <span className="widget__time">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="widget__date">
        {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
    </>
  );
}

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
  return (
    <div
      className={cx('widget', `widget--${widget.type}`, dragging && 'widget--dragging')}
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
      data-layout-id={widget.id}
      onPointerDown={onPointerDown}
      role="note"
      aria-label={widget.title ?? WIDGET_LABELS[widget.type]}
    >
      <WidgetContent widget={widget} />
    </div>
  );
}
