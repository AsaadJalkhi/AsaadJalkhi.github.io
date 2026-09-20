/**
 * Dock.
 *
 * Three segments with a clear job each: a launcher rail for the apps that are
 * always available, a short set of external shortcuts (email, the social
 * profiles) that leave the site in a new tab, and a running list showing every
 * open window — including minimised ones, which is how they come back.
 */
import { Github, Instagram, Link2, Linkedin, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOs } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { APPS, DOCK_APPS } from '@/components/windows/registry';
import { dockLinkUrl } from '@/lib/contentStore';
import type { DockLink } from '@/types/content';
import { cx } from '@/lib/utils';

const LINK_ICONS: Record<DockLink['icon'], LucideIcon> = {
  mail: Mail,
  instagram: Instagram,
  linkedin: Linkedin,
  github: Github,
  link: Link2,
};

export function Dock() {
  const { profile, desktop } = usePortfolio();
  const { openApp, openExternal } = useOpenTarget();
  const windows = useOs((state) => state.windows);
  const topZ = useOs((state) => state.topZ);
  const toggleMinimize = useOs((state) => state.toggleMinimize);
  const focusWindow = useOs((state) => state.focusWindow);

  const runningApps = new Set(windows.map((w) => w.app));

  return (
    <nav className="dock" aria-label="Applications">
      <ul className="dock__rail">
        {DOCK_APPS.map((app) => {
          const Icon = app.icon;
          return (
            <li key={app.id}>
              <button
                type="button"
                className={cx('dock__app', runningApps.has(app.id) && 'dock__app--running')}
                onClick={() => openApp(app.id)}
                aria-label={app.label}
              >
                <Icon strokeWidth={1.4} />
                <span className="dock__tip">{app.label}</span>
              </button>
            </li>
          );
        })}

        {/*
         * External shortcuts. Separated by a hairline so it is obvious these
         * leave the site rather than opening another window inside it.
         */}
        {desktop.dockLinks.length > 0 && (
          <>
            <li className="dock__sep" aria-hidden="true" />
            {desktop.dockLinks.map((link) => {
              const Icon = LINK_ICONS[link.icon];
              // Normally inherited from profile.socials — see dockLinkUrl.
              const url = dockLinkUrl(link, profile);
              if (!url) return null;
              return (
                <li key={link.id}>
                  <button
                    type="button"
                    className="dock__app"
                    onClick={() => openExternal(url)}
                    aria-label={`${link.label} (opens in a new tab)`}
                  >
                    <Icon strokeWidth={1.4} />
                    <span className="dock__tip">{link.label}</span>
                  </button>
                </li>
              );
            })}
          </>
        )}
      </ul>

      {windows.length > 0 && (
        <ul className="dock__running">
          {windows.map((win) => {
            const Icon = APPS[win.app].icon;
            const focused = win.z === topZ && !win.minimized;
            return (
              <li key={win.id}>
                <button
                  type="button"
                  className={cx(
                    'dock__task',
                    win.minimized && 'dock__task--minimized',
                    focused && 'dock__task--focused',
                  )}
                  data-discipline={win.accent}
                  onClick={() =>
                    win.minimized || !focused ? focusWindow(win.id) : toggleMinimize(win.id)
                  }
                  title={win.minimized ? `Restore ${win.title}` : `Focus ${win.title}`}
                >
                  <Icon strokeWidth={1.5} />
                  <span className="dock__task-label">{win.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
