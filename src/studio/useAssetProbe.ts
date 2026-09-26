/**
 * Does this file actually exist in `public/`?
 *
 * The Studio cannot write files and will not pretend otherwise, so the one
 * useful thing it can do about a local path is *check* it — the same way the
 * site will: ask the server for it. A typo in a path used to be invisible until
 * the project was opened and a picture was missing, which is a long way from the
 * field that caused it.
 *
 * `HEAD`, because the answer is a status code and there is no reason to download
 * a 40 MB video to learn it. The content-type guard is for the dev server: Vite
 * answers unknown paths with `index.html` when the request looks like a page, so
 * a 200 whose body is HTML means "not found" rather than "found".
 *
 * A failure here is never an error state for the editor. The probe reports and
 * the panel says so quietly; nothing is blocked, nothing throws, and a path that
 * cannot be probed at all (offline, a file:// build) simply stays unknown.
 */
import { useEffect, useState } from 'react';
import { asset } from '@/lib/paths';

export type ProbeState = 'idle' | 'checking' | 'found' | 'missing';

/** Typing is not a question; a pause is. */
const SETTLE_MS = 400;

export function useAssetProbe(path?: string): ProbeState {
  const [state, setState] = useState<ProbeState>('idle');
  const resolved = asset(path);

  useEffect(() => {
    if (!resolved) {
      setState('idle');
      return;
    }

    let live = true;
    setState('checking');
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(resolved, { method: 'HEAD', signal: controller.signal });
        if (!live) return;
        const html = (response.headers.get('content-type') ?? '').includes('text/html');
        setState(response.ok && !html ? 'found' : 'missing');
      } catch {
        // Aborted, or no network. Neither is evidence the file is missing, but
        // an abort is followed by another run and the state is about to be
        // replaced anyway.
        if (live) setState(controller.signal.aborted ? 'checking' : 'missing');
      }
    }, SETTLE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [resolved]);

  return state;
}
