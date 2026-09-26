/**
 * Window chrome.
 *
 * react-rnd handles the drag/resize maths; everything else — focus, z-order,
 * minimise, maximise, open/close motion and keyboard access — lives here.
 *
 * Dragging is deliberately UNBOUNDED on the LEFT, RIGHT and BOTTOM. A window
 * can be pushed past those edges and even entirely off-screen, because that is
 * how a real desk works and the alternative — an invisible wall at the viewport
 * edge — feels cheap. There is no wrap-around: a window stays where it was put.
 *
 * The TOP is the one constrained edge, and only because of a real usability
 * bug: the menu bar is fixed, so a window dragged above it disappears behind it
 * along with its own title bar — and with it every control and the only grab
 * handle that could bring it back. `topSafeArea()` (see `lib/chrome.ts`, which
 * derives the number from the `--menubar-h` token rather than inventing one)
 * is the floor. Do NOT generalise this back into all-round bounds.
 *
 * Nothing is ever unrecoverable, because the ways back do not depend on the
 * window being visible: the dock restores minimised windows, `tidy()` drags
 * every open window back into a grid, maximise fills the screen, and Reset
 * Desktop starts over. Spawning is still clamped (see `openWindow` in
 * state/os.ts) so a window always *opens* somewhere sensible.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { Minus, Square, X, Copy } from 'lucide-react';
import { useOs, type WindowInstance } from '@/state/os';
import { useViewport, usePrefersReducedMotion } from '@/hooks/useEnvironment';
import { topSafeArea } from '@/lib/chrome';
import { cx } from '@/lib/utils';
import './window.css';

const CLOSE_MS = 150;

interface WindowShellProps {
  win: WindowInstance;
  children: ReactNode;
}

export function WindowShell({ win, children }: WindowShellProps) {
  const { closeWindow, focusWindow, minimizeWindow, toggleMaximize, setBox, topZ } = useOs();
  const viewport = useViewport();
  const reduced = usePrefersReducedMotion();
  const [closing, setClosing] = useState(false);
  const isFocused = win.z === topZ && !win.minimized;
  const rnd = useRef<Rnd>(null);

  const handleClose = useCallback(() => {
    if (reduced) {
      closeWindow(win.id);
      return;
    }
    setClosing(true);
    window.setTimeout(() => closeWindow(win.id), CLOSE_MS);
  }, [closeWindow, reduced, win.id]);

  // A maximised window tracks the viewport. Normal windows are left exactly
  // where the visitor put them — including off-screen. Clamping here is what
  // used to produce the wall, because this effect also runs on every x/y change.
  // Maximised runs to the bottom edge: the dock floats over it (see window.css
  // for the scroll clearance that keeps the last content reachable).
  useEffect(() => {
    if (!win.maximized) return;
    const top = topSafeArea();
    setBox(win.id, { x: 12, y: top, width: viewport.width - 24, height: viewport.height - top });
  }, [viewport.width, viewport.height, win.maximized, win.id, setBox]);

  // A window already sitting above the menu bar — restored from an older
  // session, or from content authored before this constraint existed — is
  // nudged back down once on mount so it can never be stranded up there.
  useEffect(() => {
    if (win.maximized) return;
    const top = topSafeArea();
    if (win.y < top) setBox(win.id, { y: top });
    // Deliberately mount-only: re-running on every y change would re-create the
    // "viewport is a wall" bug that session 6 removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (win.minimized) return null;

  return (
    <Rnd
      ref={rnd}
      size={{ width: win.width, height: win.height }}
      position={{ x: win.x, y: win.y }}
      minWidth={320}
      minHeight={200}
      /*
       * Still no `bounds` — see the note at the top of this file. The top edge
       * is held by clamping the controlled position in `onDrag` instead, which
       * constrains exactly one side and leaves the other three genuinely free.
       * `bounds` cannot express that: it always walls all four.
       */
      /* Rounds the wrapper react-rnd renders — part of the corner-clip fix. */
      className="window-rnd"
      dragHandleClassName="window__grab"
      cancel=".window__control"
      enableResizing={win.resizable && !win.maximized}
      disableDragging={win.maximized}
      style={{ zIndex: win.z }}
      onDragStart={() => focusWindow(win.id)}
      onDrag={(_event, data) => {
        // Slide along the menu bar rather than stopping the drag dead: only y
        // is pinned, so a window pushed into the top edge still tracks the
        // pointer sideways. Returning false here would abort the whole gesture.
        const top = topSafeArea();
        if (data.y < top) rnd.current?.updatePosition({ x: data.x, y: top });
      }}
      onDragStop={(_event, data) =>
        setBox(win.id, { x: data.x, y: Math.max(topSafeArea(), data.y) })
      }
      onResizeStart={() => focusWindow(win.id)}
      onResizeStop={(_event, _direction, ref, _delta, position) =>
        setBox(win.id, {
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          // Resizing from the top handle moves y too, so it needs the same floor.
          y: Math.max(topSafeArea(), position.y),
        })
      }
      resizeHandleClasses={{
        bottomRight: 'window__handle window__handle--br',
        bottom: 'window__handle window__handle--b',
        right: 'window__handle window__handle--r',
        left: 'window__handle window__handle--l',
        top: 'window__handle window__handle--t',
      }}
    >
      <section
        className={cx(
          'window',
          isFocused && 'window--focused',
          closing && 'window--closing',
          win.maximized && 'window--maximized',
        )}
        data-accent={win.accent}
        role="dialog"
        aria-label={win.title}
        onMouseDown={() => focusWindow(win.id)}
        onFocusCapture={() => focusWindow(win.id)}
      >
        <header className="window__bar window__grab">
          <div className="window__identity">
            <h2 className="window__title">{win.title}</h2>
            {win.subtitle && <span className="window__subtitle">{win.subtitle}</span>}
          </div>

          <div className="window__controls">
            <button
              type="button"
              className="window__control"
              onClick={() => minimizeWindow(win.id)}
              aria-label={`Minimise ${win.title}`}
              title="Minimise"
            >
              <Minus />
            </button>
            {win.resizable && (
              <button
                type="button"
                className="window__control"
                onClick={() => toggleMaximize(win.id, viewport)}
                aria-label={`${win.maximized ? 'Restore' : 'Maximise'} ${win.title}`}
                title={win.maximized ? 'Restore' : 'Maximise'}
              >
                {win.maximized ? <Copy /> : <Square />}
              </button>
            )}
            <button
              type="button"
              className="window__control window__control--close"
              onClick={handleClose}
              aria-label={`Close ${win.title}`}
              title="Close"
            >
              <X />
            </button>
          </div>
        </header>

        <div className="window__body">{children}</div>
      </section>
    </Rnd>
  );
}
