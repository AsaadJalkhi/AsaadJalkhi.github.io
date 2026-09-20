/**
 * The desktop.
 *
 * Composition order matters: wallpaper → icons → windows → chrome. The window
 * layer spans the whole desktop (so drag bounds match the coordinates the store
 * calculates) but ignores pointer events except on the windows themselves.
 *
 * There is no splash plate over the desktop. The work opens immediately and
 * speaks for itself; an interstitial explaining the concept would only delay it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOs, type AppId, type WindowPayload } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { useDesktopLayout, type LayoutSubject } from '@/hooks/useDesktopLayout';
import { findNote, findProject } from '@/lib/contentStore';
import { APPS } from '@/components/windows/registry';
import { WindowLayer } from '@/components/windows/WindowLayer';
import { Wallpaper } from './Wallpaper';
import { DesktopIcon } from './DesktopIcon';
import { DesktopWidget } from './DesktopWidget';
import { MenuBar } from './MenuBar';
import { Dock } from './Dock';
import './os.css';

/** Turns an `autoOpen.payloadId` string into the payload that app expects. */
function payloadFor(app: AppId, payloadId?: string): WindowPayload {
  if (!payloadId) return {};
  switch (app) {
    case 'projects':
      return { folderId: payloadId };
    case 'project':
      return { projectId: payloadId };
    case 'note':
      return { noteId: payloadId };
    case 'media': {
      const [projectId, mediaId] = payloadId.split(':');
      return { projectId, mediaId };
    }
    case 'browser':
      return { url: payloadId };
    case 'alert':
      return { alertId: payloadId };
    default:
      return {};
  }
}

export function Desktop() {
  const portfolio = usePortfolio();
  const { openTarget } = useOpenTarget();
  const openWindow = useOs((state) => state.openWindow);
  const desktopEpoch = useOs((state) => state.desktopEpoch);

  const [selected, setSelected] = useState<string | null>(null);
  const openedEpoch = useRef<number | null>(null);
  const iconsRef = useRef<HTMLDivElement | null>(null);

  const items = portfolio.desktop.items;
  const widgets = portfolio.desktop.widgets;

  /*
   * Icons and widgets share the surface, so they share one layout pass — that
   * is the only way the scatter can keep them from landing on top of each
   * other. Widgets come last so they settle at the foot of their column.
   */
  const subjects = useMemo<LayoutSubject[]>(
    () => [
      ...items.map((item) => ({ id: item.id, zone: item.zone, x: item.x, y: item.y })),
      ...widgets.map((widget) => ({
        id: widget.id,
        zone: widget.zone,
        x: widget.x,
        y: widget.y,
      })),
    ],
    [items, widgets],
  );

  const layout = useDesktopLayout(subjects, iconsRef);

  // Restore the opening composition — once per desktop epoch, so "Reset
  // Desktop" replays it but ordinary re-renders never re-open windows.
  useEffect(() => {
    if (openedEpoch.current === desktopEpoch) return;
    openedEpoch.current = desktopEpoch;

    [...portfolio.desktop.autoOpen]
      .sort((a, b) => a.order - b.order)
      .forEach((spec) => {
        const app = spec.app as AppId;
        if (!APPS[app]) return;
        const payload = payloadFor(app, spec.payloadId);
        const project = findProject(portfolio, payload.projectId);
        const note = findNote(portfolio, payload.noteId);

        openWindow({
          app,
          title: note?.title ?? project?.shortTitle ?? project?.title ?? APPS[app].label,
          subtitle: app === 'media' ? (project?.company ?? undefined) : undefined,
          payload,
          box: { x: spec.x, y: spec.y, width: spec.width, height: spec.height },
        });
      });
  }, [desktopEpoch, openWindow, portfolio]);

  return (
    <div className="desktop" onPointerDown={() => setSelected(null)}>
      <Wallpaper />

      <div className="desktop__icons" ref={iconsRef}>
        {items.map((item) => (
          <DesktopIcon
            key={`${desktopEpoch}-${item.id}`}
            item={item}
            point={layout.positions[item.id] ?? { x: 50, y: 50 }}
            selected={selected === item.id}
            dragging={layout.dragging === item.id}
            wrapped={layout.wrapped === item.id}
            onPointerDown={(event) => {
              event.stopPropagation();
              layout.startDrag(item.id, event);
            }}
            onSelect={() => setSelected(item.id)}
            onOpen={() => {
              // A drop is not a click: never open the thing that was just moved.
              if (layout.didDrag()) return;
              setSelected(item.id);
              openTarget(item.target);
            }}
          />
        ))}

        {widgets.map((widget) => (
          <DesktopWidget
            key={`${desktopEpoch}-${widget.id}`}
            widget={widget}
            point={layout.positions[widget.id] ?? { x: 50, y: 50 }}
            dragging={layout.dragging === widget.id}
            onPointerDown={(event) => {
              event.stopPropagation();
              layout.startDrag(widget.id, event);
            }}
          />
        ))}
      </div>

      <div className="desktop__windows">
        <WindowLayer />
      </div>

      <MenuBar />
      <Dock />
    </div>
  );
}
