/**
 * ASAAD.OS Mobile — the home screen. Nothing else.
 *
 * Three modes, three jobs. The desktop is the full computer. Quick View is the
 * conventional one-page portfolio. This is the OS on a phone or a tablet:
 * wallpaper, a status bar, square widgets, a large icon for every folder, and
 * a floating dock. It is deliberately NOT a second Quick View — no hero, no
 * selected-work cards, no about, no CV. Those are one tap away (the dock's
 * Quick View, or the apps), and duplicating them here is what made the old
 * home screen read as a portfolio page rather than an operating system.
 *
 * Everything shown is read from content that already exists: the icons are the
 * folders in folder order, with the desktop's own artwork (`lib/mobileHome`);
 * the widgets are the desktop's widgets drawn through the shared
 * `WidgetContent`; the dock is `DOCK_APPS` and `desktop.dockLinks`.
 * `settings.mobileHome` only chooses columns and which widgets appear.
 *
 * Opening is not this component's business. Every tap goes through
 * `useOpenTarget`, and `MobileSurface` — which wraps the whole app — turns it
 * into a full-screen sheet. No sheet state here, no window store, no drag.
 */
import { useState, type CSSProperties } from 'react';
import { Folder, LayoutGrid, LayoutList, Moon, Search, Sun } from 'lucide-react';
import { useOs } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { useResolvedTheme } from '@/hooks/useTheme';
import { dockLinkUrl } from '@/lib/contentStore';
import { iconSource, mobileApps, mobileColumns, mobileWidgets, type HomeApp, type HomeWidget } from '@/lib/mobileHome';
import { asset } from '@/lib/paths';
import type { Widget } from '@/types/content';
import { cx } from '@/lib/utils';
import { DOCK_APPS } from '@/components/windows/registry';
import { Wallpaper } from '@/components/os/Wallpaper';
import { LINK_ICONS } from '@/components/os/Dock';
import { WIDGET_LABELS, WidgetContent, useNow } from '@/components/os/DesktopWidget';
import '@/components/os/os.css';
import './mobile.css';

/** The Work window's own name for "every folder in turn". */
const ALL_WORK = 'All work';

export function MobileShell() {
  const portfolio = usePortfolio();
  const setView = useOs((state) => state.setView);
  const setPalette = useOs((state) => state.setPalette);
  const toggleTheme = useOs((state) => state.toggleTheme);
  const theme = useResolvedTheme();
  const now = useNow();
  const { present, openFolder, openApp, openExternal } = useOpenTarget();

  const { profile, settings, desktop } = portfolio;
  const home = settings.mobileHome;
  const columns = mobileColumns(home);
  const widgets = mobileWidgets(home, desktop.widgets);
  const apps = mobileApps(portfolio.folders, desktop.items, ALL_WORK);

  // The All Work icon is the grid's first; the dock need not repeat it.
  const dockApps = DOCK_APPS.filter((app) => app.id !== 'projects');

  const open = (app: HomeApp) => {
    if (app.folderId) openFolder(app.folderId);
    // The Work window with no folder filter — the same view as the desktop's.
    else present({ app: 'projects', title: ALL_WORK });
  };

  const top = widgets.filter((entry) => entry.area === 'top');
  const after = widgets.filter((entry) => entry.area === 'afterApps');

  return (
    <div
      className="m-home"
      style={
        {
          '--m-cols-phone': columns.phone,
          '--m-cols-tablet': columns.tablet,
        } as CSSProperties
      }
    >
      <div className="m-home__backdrop">
        <Wallpaper />
      </div>

      <header className="m-status">
        <time className="m-status__time" dateTime={now.toISOString()}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
        <span className="mono m-status__mark">{profile.osName}</span>
        <div className="m-status__actions">
          <button
            type="button"
            className="m-status__btn"
            onClick={() => setPalette(true)}
            aria-label="Search"
          >
            <Search strokeWidth={1.6} />
          </button>
          {settings.theme.allowToggle && (
            <button
              type="button"
              className="m-status__btn"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`}
            >
              {theme === 'dark' ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}
            </button>
          )}
        </div>
      </header>

      <main className="m-home__body">
        <WidgetRow entries={top} label="Widgets" />

        <nav className="m-apps" aria-label="Work">
          <ul className="m-apps__grid">
            {apps.map((app, index) => (
              <li key={app.folderId ?? 'all-work'} style={{ '--i': index } as CSSProperties}>
                <AppIcon app={app} theme={theme} onOpen={() => open(app)} />
              </li>
            ))}
            {desktop.dockLinks.map((link, index) => {
              // Normally inherited from profile.socials — see dockLinkUrl.
              const url = dockLinkUrl(link, profile);
              if (!url) return null;
              const Icon = LINK_ICONS[link.icon];
              return (
                <li key={link.id} style={{ '--i': apps.length + index } as CSSProperties}>
                  <button
                    type="button"
                    className="m-app"
                    onClick={() => openExternal(url)}
                    aria-label={`${link.label} (opens in a new tab)`}
                  >
                    <span className="m-app__art m-app__art--glyph" aria-hidden="true">
                      <Icon strokeWidth={1.3} />
                    </span>
                    <span className="m-app__label">{link.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <WidgetRow entries={after} label="More widgets" />
      </main>

      <nav className="m-dock" aria-label="Dock">
        <ul className="m-dock__rail">
          {dockApps.map((app) => {
            const Icon = app.icon;
            return (
              <li key={app.id}>
                <button
                  type="button"
                  className="m-dock__item"
                  onClick={() => openApp(app.id)}
                  aria-label={app.label}
                >
                  <Icon strokeWidth={1.4} aria-hidden="true" />
                  <span className="m-dock__label" aria-hidden="true">
                    {app.label}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="m-dock__sep" aria-hidden="true" />
          <li>
            <button
              type="button"
              className="m-dock__item"
              onClick={() => setView('quickview')}
              aria-label="Quick View — the portfolio as one page"
            >
              <LayoutList strokeWidth={1.4} aria-hidden="true" />
              <span className="m-dock__label" aria-hidden="true">
                Quick View
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/**
 * One icon on the home grid. Same artwork rule as the desktop icon — a file per
 * theme, then the monogram, then a glyph — drawn bare and contained, never
 * cropped, so a logo looks here exactly as it does on the desktop.
 */
function AppIcon({
  app,
  theme,
  onOpen,
}: {
  app: HomeApp;
  theme: 'light' | 'dark';
  onOpen: () => void;
}) {
  const resolved = asset(iconSource(app.icon, theme));
  // Remembered per path, as on the desktop: a missing dark file must not
  // condemn the light one.
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const image = resolved && resolved !== failedSrc ? resolved : undefined;
  const monogram = app.icon?.text?.trim();
  const Glyph = app.folderId ? Folder : LayoutGrid;

  return (
    <button type="button" className="m-app" onClick={onOpen} aria-label={`Open ${app.label}`}>
      {image ? (
        <span className="m-app__art" aria-hidden="true">
          <img
            className="m-app__img"
            src={image}
            alt=""
            draggable={false}
            onError={() => setFailedSrc(resolved)}
          />
        </span>
      ) : (
        <span
          className="m-app__art m-app__art--glyph"
          style={app.icon?.tint ? { color: app.icon.tint } : undefined}
          aria-hidden="true"
        >
          {monogram ? <span className="m-app__mono">{monogram}</span> : <Glyph strokeWidth={1.2} />}
        </span>
      )}
      <span className="m-app__label">{app.label}</span>
    </button>
  );
}

/** A row of square tiles; two to a phone row, more on a tablet. */
function WidgetRow({ entries, label }: { entries: HomeWidget[]; label: string }) {
  if (!entries.length) return null;
  return (
    <section className="m-widgets" aria-label={label}>
      {entries.map(({ widget }) => (
        <MobileWidget key={widget.id} widget={widget} />
      ))}
    </section>
  );
}

/**
 * The desktop's widget without the desktop's positioning or drag: a static
 * square. What it shows is the shared `WidgetContent`, as a `tile`.
 */
function MobileWidget({ widget }: { widget: Widget }) {
  return (
    <div
      className={cx('m-widget', `m-widget--${widget.type}`)}
      role="note"
      aria-label={widget.title ?? WIDGET_LABELS[widget.type]}
    >
      <WidgetContent widget={widget} variant="tile" />
    </div>
  );
}
