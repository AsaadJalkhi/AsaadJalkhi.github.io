/**
 * The mobile answer to "open this".
 *
 * This wraps the entire shell rather than the home screen, and the difference
 * matters more than it looks. The mobile bug was a tap that produced a desktop
 * window nobody could see; the first fix routed the home screen and everything
 * inside a sheet through here, which covered the reported case and left two
 * doors open — the command palette and a cold `#/project/<id>` deep link both
 * live *above* the home screen in the tree and would have gone on calling
 * `openWindow`. A surface that only covers part of the app is a surface that
 * has to be remembered, and the whole point is that nobody has to.
 *
 * So it sits at the top, and every open request on a phone lands here no matter
 * which component made it. `enabled` off provides nothing at all, which is how
 * the desktop keeps its windows: `useOpenTarget` falls back to `openWindow`
 * when no surface is offered.
 *
 * Sheets are a STACK. With one slot, opening a project from inside a folder
 * replaced the folder and Back left the app entirely, so going deeper is a
 * thing the shell can actually do. Every level stays mounted, so stepping back
 * finds the folder as it was left rather than rebuilt and scrolled to the top.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { OpenSurfaceContext, type OpenSurface } from '@/hooks/openSurface';
import type { AppId, OpenSpec, WindowInstance, WindowPayload } from '@/state/os';
import { APPS } from '@/components/windows/registry';
import './mobile.css';

interface Sheet {
  app: AppId;
  title: string;
  payload: WindowPayload;
}

/**
 * Apps expect a `WindowInstance`. On mobile there is no real window, so they
 * get a stand-in — this is the only place that fabricates one.
 *
 * The id carries the depth, because sheets stack: a folder and the project
 * opened from inside it are both in state at once, and two identical keys would
 * make React reuse one component for both.
 */
function sheetWindow(sheet: Sheet, depth: number): WindowInstance {
  return {
    id: `sheet-${depth}-${sheet.app}`,
    key: `sheet-${depth}-${sheet.app}`,
    app: sheet.app,
    title: sheet.title,
    payload: sheet.payload,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    z: 1,
    minimized: false,
    maximized: true,
    resizable: false,
  };
}

export function MobileSurface({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]);

  const push = useCallback<OpenSurface>((spec: OpenSpec) => {
    setSheets((stack) => [
      ...stack,
      { app: spec.app, title: spec.title, payload: spec.payload ?? {} },
    ]);
  }, []);

  const pop = useCallback(() => setSheets((stack) => stack.slice(0, -1)), []);

  // Widening past the breakpoint hands over to the desktop, which opens things
  // its own way. Leaving a stack behind would spring it back on the next
  // narrow resize, long after anyone remembers opening it.
  useEffect(() => {
    if (!enabled) setSheets([]);
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <OpenSurfaceContext.Provider value={push}>
      {children}
      {sheets.map((sheet, depth) => (
        <MobileSheet
          key={`${depth}-${sheet.app}`}
          sheet={sheet}
          depth={depth}
          buried={depth < sheets.length - 1}
          onClose={pop}
        />
      ))}
    </OpenSurfaceContext.Provider>
  );
}

/**
 * Only the top sheet is reachable. The ones underneath are covered opaquely and
 * made `inert`, or a screen reader would walk straight through the cover into
 * the folder behind it.
 */
function MobileSheet({
  sheet,
  depth,
  buried,
  onClose,
}: {
  sheet: Sheet;
  depth: number;
  buried: boolean;
  onClose: () => void;
}) {
  const AppBody = APPS[sheet.app].component;
  return (
    <div className="m-sheet" role="dialog" aria-modal="true" aria-label={sheet.title} inert={buried}>
      <header className="m-sheet__bar">
        <button type="button" className="m-sheet__back" onClick={onClose}>
          <ChevronLeft strokeWidth={1.5} />
          <span>Back</span>
        </button>
        <span className="m-sheet__title">{sheet.title}</span>
      </header>
      <div className="m-sheet__body">
        <AppBody win={sheetWindow(sheet, depth)} />
      </div>
    </div>
  );
}
