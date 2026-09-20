import { useCallback, useEffect, useState } from 'react';

/**
 * Hash routing.
 *
 * GitHub Pages has no server-side rewrite, so path-based routes 404 on
 * refresh. Everything here lives after the "#", which means every URL is
 * shareable and reload-safe from any subdirectory.
 *
 * Routes used by the app:
 *   #/                       desktop
 *   #/quick                  Quick View
 *   #/project/<id>           open a project window / Quick View case study
 *   #/studio                 Portfolio Studio
 */
export function useHashRoute(): [string, (next: string) => void] {
  const [route, setRoute] = useState(() => normalise(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(normalise(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: string) => {
    const target = next.startsWith('/') ? next : `/${next}`;
    if (normalise(window.location.hash) === target) return;
    window.location.hash = target;
  }, []);

  return [route, navigate];
}

function normalise(hash: string): string {
  const value = hash.replace(/^#/, '');
  if (!value || value === '/') return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

/** "/project/gaf-brand" → ["project", "gaf-brand"] */
export function routeParts(route: string): string[] {
  return route.split('/').filter(Boolean);
}
