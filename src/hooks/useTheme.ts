/**
 * Theme resolution.
 *
 * Two inputs, one answer. The content file names a default (light, unless
 * `settings.theme.default` says otherwise); the visitor may override it with
 * the menu-bar toggle, and that choice persists. `null` in the store means
 * "never chose", which is why the default stays a content decision rather than
 * something hard-coded in a component.
 *
 * The resolved value is written to `<html data-theme>`, which is the only hook
 * the stylesheets need — see tokens.css.
 */
import { useEffect } from 'react';
import { useOs, type Theme } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';

export function useResolvedTheme(): Theme {
  const { settings } = usePortfolio();
  const chosen = useOs((state) => state.theme);
  // A locked theme (allowToggle: false) ignores any stored choice, so turning
  // the toggle off in the Studio actually forces the mode for everyone.
  if (!settings.theme.allowToggle) return settings.theme.default;
  return chosen ?? settings.theme.default;
}

export function useApplyTheme(): Theme {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return theme;
}
