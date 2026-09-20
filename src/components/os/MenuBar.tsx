/**
 * Top bar. Wordmark, primary navigation, system actions.
 *
 * The four destinations a visitor actually wants — Work, About, CV, Contact —
 * are plain labels here rather than icons, because this is the one place in the
 * interface that has to be legible to someone who has never seen it before.
 */
import { useEffect, useState } from 'react';
import { LayoutList, Moon, Search, Sun } from 'lucide-react';
import { useOs, type AppId } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { useResolvedTheme } from '@/hooks/useTheme';
import { cx } from '@/lib/utils';

const NAV: Array<{ app: AppId; label: string }> = [
  { app: 'projects', label: 'Work' },
  { app: 'about', label: 'About' },
  { app: 'cv', label: 'CV' },
  { app: 'contact', label: 'Contact' },
];

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MenuBar() {
  const { profile, settings } = usePortfolio();
  const theme = useResolvedTheme();
  const toggleTheme = useOs((state) => state.toggleTheme);
  const clock = useClock();
  const { openApp } = useOpenTarget();
  const setPalette = useOs((state) => state.setPalette);
  const setView = useOs((state) => state.setView);
  // Subscribe to the array itself, never a derived copy: a selector that builds
  // a new array each call makes useSyncExternalStore re-render forever.
  const windows = useOs((state) => state.windows);
  const isOpen = (app: AppId) => windows.some((w) => w.app === app);

  return (
    <header className="menubar">
      <div className="menubar__left">
        <span className="menubar__mark">{profile.osName}</span>

        <nav className="menubar__nav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.app}
              type="button"
              className={cx('menubar__link', isOpen(item.app) && 'menubar__link--open')}
              onClick={() => openApp(item.app)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="menubar__right">
        {/*
          * No shortcut badge. ⌘K still opens the palette — see App.tsx — but
          * printing the chord next to the label is Mac-specific chrome that
          * means nothing to half the visitors and adds noise for the rest.
          */}
        <button type="button" className="menubar__btn" onClick={() => setPalette(true)}>
          <Search strokeWidth={1.6} />
          <span>Search</span>
        </button>

        <button type="button" className="menubar__btn" onClick={() => setView('quickview')}>
          <LayoutList strokeWidth={1.6} />
          <span>Quick View</span>
        </button>

        {settings.theme.allowToggle && (
          <button
            type="button"
            className="menubar__toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`}
          >
            {theme === 'dark' ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}
          </button>
        )}

        <span className="menubar__clock">{clock}</span>
      </div>
    </header>
  );
}
