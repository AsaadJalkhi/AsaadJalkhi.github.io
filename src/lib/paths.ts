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

/** Readable hostname for link chips: "instagram.com/asaad" → "instagram.com". */
export function hostOf(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url.startsWith('//') ? `https:${url}` : url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  }
}
