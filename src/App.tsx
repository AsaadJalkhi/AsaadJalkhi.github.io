/**
 * Root orchestration.
 *
 * Responsibilities, in order: validate content (and show a readable error if it
 * is broken), gate the boot sequence, pick the shell for the device, keep the
 * URL hash in sync with the current view, and own the global hotkeys.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { loadPortfolio } from '@/lib/contentStore';
import { hasBootedBefore, useOs } from '@/state/os';
import { PortfolioProvider, usePortfolio } from '@/state/portfolio';
import { useHashRoute, routeParts } from '@/hooks/useHashRoute';
import { useHotkeys, type Hotkey } from '@/hooks/useHotkeys';
import { useIsCompact, useViewport } from '@/hooks/useEnvironment';
import { useApplyTheme } from '@/hooks/useTheme';
import { useTypography } from '@/hooks/useTypography';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { BootSequence } from '@/components/os/BootSequence';
import { CommandPalette } from '@/components/os/CommandPalette';
import { CustomCursor } from '@/components/os/CustomCursor';
import { Desktop } from '@/components/os/Desktop';
import { MobileShell } from '@/components/mobile/MobileShell';
import { QuickView } from '@/components/quick-view/QuickView';
import type { ValidationResult } from '@/types/content';
import '@/styles/error.css';

/**
 * The Studio is its own full-screen mode, not an app inside the OS.
 *
 * It is lazily imported here and nowhere else, which is what keeps it out of
 * the main bundle: a visitor who never types `#/studio` never downloads the
 * editor. It is also deliberately absent from the dock, the menu bar, search
 * and the command palette — the URL is the only door.
 */
const StudioApp = lazy(() =>
  import('@/studio/StudioApp').then((module) => ({ default: module.StudioApp })),
);

export default function App() {
  const result = loadPortfolio();
  if (!result.ok) return <ContentError issues={result.issues} />;

  return (
    <PortfolioProvider value={result.data}>
      <Shell />
    </PortfolioProvider>
  );
}

function Shell() {
  const portfolio = usePortfolio();
  const [route, navigate] = useHashRoute();
  const compact = useIsCompact();
  const viewport = useViewport();
  const { openProject, openApp } = useOpenTarget();

  const view = useOs((state) => state.view);
  const setView = useOs((state) => state.setView);
  const finishBoot = useOs((state) => state.finishBoot);
  const togglePalette = useOs((state) => state.togglePalette);
  const setPalette = useOs((state) => state.setPalette);
  const paletteOpen = useOs((state) => state.paletteOpen);
  const cursorEnabled = useOs((state) => state.cursorEnabled);
  const tidy = useOs((state) => state.tidy);
  const cycleFocus = useOs((state) => state.cycleFocus);

  const { settings, profile } = portfolio;

  // Writes <html data-theme> from the content default plus any stored choice.
  // Everything visual keys off that one attribute; see styles/tokens.css.
  useApplyTheme();

  // Loads the two fonts the content names, if it names any. Nothing configured
  // means no request and the system stack from tokens.css; see useTypography.
  useTypography(settings.typography);

  // Repeat visitors get a much shorter intro; reduced motion skips it entirely
  // (handled inside BootSequence).
  const bootDuration = useMemo(() => {
    if (!settings.boot.enabled) return 0;
    const seen = hasBootedBefore();
    return settings.boot.shortenAfterFirstVisit && seen
      ? Math.min(500, settings.boot.duration)
      : settings.boot.duration;
  }, [settings.boot]);

  /*
   * Hash → app state. Deep links land on the right thing on a cold load.
   *
   * A route is applied ONCE, and `appliedRoute` is what guarantees it.
   *
   * This effect has to depend on `view` — it must not run during `boot`, and it
   * has to run again the moment boot finishes so a cold `#/quick` or
   * `#/project/<id>` still lands. But depending on `view` also means the effect
   * re-runs after *any* view change, and without the guard it re-read the
   * unchanged hash and overwrote that change: pressing "Explore the OS" called
   * `setView('desktop')`, this effect saw `#/quick` still in the address bar and
   * called `setView('quickview')` straight back, then the state→hash effect
   * below rewrote the hash, then this one re-asserted the route. The two fought
   * each other and Quick View could not be left — the reported bug, and nothing
   * to do with running on localhost.
   *
   * The hash is the source of truth for *navigation events*, not a lock on the
   * current view. Once a route has been applied, the app owns the view until the
   * route genuinely changes again (a link, a manual edit, Back/Forward).
   */
  const appliedRoute = useRef<string | null>(null);

  useEffect(() => {
    if (view === 'boot') return;
    if (appliedRoute.current === route) return;
    appliedRoute.current = route;

    const [head, id] = routeParts(route);

    if (head === 'quick') {
      setView('quickview');
      return;
    }
    if (head === 'project' && id) {
      setView('desktop');
      openProject(id);
      return;
    }
    // `#/studio` is handled below by rendering a different shell entirely, so
    // there is nothing to open here — just don't fall through to the desktop.
    if (head === 'studio') return;

    setView('desktop');
  }, [route, view, setView, openProject, openApp]);

  const inStudio = routeParts(route)[0] === 'studio';

  // App state → hash, so the URL is always shareable. Never rewrite the hash
  // while the Studio is open, or it would navigate itself away.
  useEffect(() => {
    if (inStudio) return;
    if (view === 'quickview') navigate('/quick');
    else if (view === 'desktop' && routeParts(route)[0] === 'quick') navigate('/');
  }, [view, route, navigate, inStudio]);

  const hotkeys = useMemo<Hotkey[]>(
    () => [
      { key: 'k', meta: true, allowInInput: true, handler: (e) => { e.preventDefault(); togglePalette(); } },
      { key: 'escape', allowInInput: true, handler: () => setPalette(false) },
      { key: 'q', handler: () => setView(view === 'quickview' ? 'desktop' : 'quickview') },
      { key: 't', meta: true, shift: true, handler: (e) => { e.preventDefault(); tidy(viewport); } },
      { key: 'tab', alt: true, handler: (e) => { e.preventDefault(); cycleFocus(1); } },
    ],
    [togglePalette, setPalette, setView, view, tidy, viewport, cycleFocus],
  );

  // Global shortcuts belong to the OS, not to the editor.
  useHotkeys(hotkeys, view !== 'boot' && !inStudio);

  const onBootDone = useCallback(() => finishBoot(), [finishBoot]);

  // Must sit below every hook: this is an early return, and hooks cannot be
  // called conditionally. The Studio replaces the shell entirely — no boot
  // sequence, no desktop, no window chrome around it.
  if (inStudio) {
    return (
      <Suspense fallback={<div className="studio-loading">Opening Studio…</div>}>
        <StudioApp />
      </Suspense>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {view === 'quickview' ? (
        <div id="main-content">
          <QuickView />
        </div>
      ) : compact ? (
        <div id="main-content">
          <MobileShell />
        </div>
      ) : (
        <div id="main-content">
          <Desktop />
        </div>
      )}

      {paletteOpen && <CommandPalette />}
      {!compact && <CustomCursor enabled={cursorEnabled && settings.customCursor} />}

      {/*
        The shell mounts underneath the startup screen rather than after it, so
        the hand-off is a cross-fade onto a desktop that has already settled —
        fading an opaque cover off nothing would just flash the page background.
      */}
      {view === 'boot' && (
        <BootSequence osName={profile.osName} duration={bootDuration} onDone={onBootDone} />
      )}
    </>
  );
}

/**
 * Content validation failed. This is the screen the spec asks for: a bad
 * `portfolio.json` must explain itself, not render a white page.
 */
function ContentError({ issues }: { issues: Extract<ValidationResult, { ok: false }>['issues'] }) {
  return (
    <div className="content-error">
      <div className="content-error__panel">
        <AlertTriangle className="content-error__icon" strokeWidth={1.4} />
        <h1 className="content-error__title">Content could not be loaded</h1>
        <p className="content-error__lede">
          <code>src/content/portfolio.json</code> does not match the schema in{' '}
          <code>src/types/content.ts</code>. Fix the entries below and the site will load again —
          nothing else is broken.
        </p>
        <ul className="content-error__list">
          {issues.map((issue) => (
            <li key={`${issue.path}-${issue.message}`}>
              <code className="content-error__path">{issue.path}</code>
              <span className="content-error__message">{issue.message}</span>
            </li>
          ))}
        </ul>
        <p className="content-error__hint mono">
          Tip: if you exported this file from Portfolio Studio, re-import it there to see the same
          errors with the fields highlighted.
        </p>
      </div>
    </div>
  );
}
