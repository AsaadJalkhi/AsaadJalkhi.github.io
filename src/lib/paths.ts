/**
 * Asset path helper.
 *
 * Content files store paths relative to /public ("media/gaf/hero.jpg").
 * At runtime those must be prefixed with Vite's BASE_URL so the site works
 * from a GitHub Pages subdirectory as well as from a domain root.
 * External URLs and data URIs pass straight through.
 */
const EXTERNAL = /^(https?:|data:|blob:|mailto:|tel:|\/\/)/i;

export function asset(path?: string | null): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (EXTERNAL.test(trimmed)) return trimmed;
  const base = import.meta.env.BASE_URL || './';
  return `${base.replace(/\/$/, '')}/${trimmed.replace(/^\.?\//, '')}`;
}

export function isExternal(url?: string | null): boolean {
  return Boolean(url && /^(https?:)?\/\//i.test(url.trim()));
}

/* -------------------------------------------------- local path normalization */

/**
 * Anything that is unambiguously a location on *this machine* rather than a
 * location in this repository: a Windows drive (`E:\…`, `E:/…`), a UNC share
 * (`\\server\…`) or a `file://` URL. A leading `/` is deliberately NOT in this
 * list — `/media/gaf/x.mp4` is how a lot of people write a site-root-relative
 * path, and guessing that it means `C:\media\…` would reject correct input.
 */
const MACHINE_PATH = /^(?:[a-z]:[\\/]|\\\\|file:\/\/)/i;

export interface LocalPath {
  /** Canonical, `public`-relative asset path. Absent when `error` is set. */
  path?: string;
  /** Why the input could not be used, in the author's language. */
  error?: string;
}

/**
 * Turn whatever was pasted into the one path shape `portfolio.json` stores.
 *
 * The Studio runs in a browser, which cannot be given a real filesystem path by
 * a file picker and cannot copy a file into `public/`. So the honest workflow is
 * "put the file in public/, then tell me where it is" — and people tell you that
 * in three different ways, all of which are accepted here:
 *
 *   media/gaf/video.mp4                            → media/gaf/video.mp4
 *   /public/media/gaf/video.mp4                    → media/gaf/video.mp4
 *   E:\asaad portifolio\public\media\gaf\video.mp4 → media/gaf/video.mp4
 *
 * The rule is one rule: backslashes become slashes, and everything up to and
 * including the last `public/` segment is dropped. A machine path with no
 * `public/` in it is the one case that cannot be rescued — the file is outside
 * the site and would not deploy — so it is reported rather than stored, because
 * an `E:\…` string in the content file is a path that works on exactly one
 * computer.
 */
export function normalizeLocalPath(input?: string | null): LocalPath {
  const raw = (input ?? '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return {};

  if (EXTERNAL.test(raw)) {
    return { error: 'That is a web address. Switch this source to URL, or paste a path inside public/.' };
  }

  const slashed = raw.replace(/\\/g, '/');
  const publicAt = slashed.toLowerCase().lastIndexOf('public/');

  const outside = { error: "This file must be inside the project's public/ folder." };

  let rest: string;
  if (publicAt >= 0 && (publicAt === 0 || slashed[publicAt - 1] === '/')) {
    rest = slashed.slice(publicAt + 'public/'.length);
  } else if (MACHINE_PATH.test(raw)) {
    return outside;
  } else {
    rest = slashed;
  }

  const cleaned = rest.replace(/^\.?\/+/, '').replace(/\/{2,}/g, '/');
  return cleaned ? { path: cleaned } : outside;
}

/**
 * The same rules stated as a yes/no, for schema validation. An empty value is
 * nobody's business here — required-ness is the caller's decision.
 */
export function localPathProblem(input?: string | null): string | undefined {
  return normalizeLocalPath(input).error;
}

/** Readable hostname for link chips: "instagram.com/asaad" → "instagram.com". */
export function hostOf(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url.startsWith('//') ? `https:${url}` : url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  }
}
