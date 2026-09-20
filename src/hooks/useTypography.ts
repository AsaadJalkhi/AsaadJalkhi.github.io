/**
 * Custom fonts, three roles, one global scale.
 *
 * `settings.typography.font` is the **shared** face: one file in `public/fonts/`,
 * used by DISPLAY, HEADING and BODY alike. Any role may then override it with its
 * own `font`, which is how a display face gets paired with a different text face.
 * A role with no font of its own inherits the shared one; with neither, the
 * native system stack. The simple case is therefore still one field, and nobody
 * has to fill in three to change one.
 *
 * What is still deliberately absent: no ZIP upload, no folder scanning, no
 * per-weight slots, no automatic weight-file mapping. One file per role is a
 * typographic choice; four files per role is inventory. If a file is a variable
 * font the weights come out of it; if it is a static face the browser does what
 * it always does, which is fine for a portfolio and requires nobody to maintain a
 * font library.
 *
 * **No Google Fonts. No font CDN. No external service.** A font file goes in
 * `public/fonts/`, gets named here, and ships with the site — the same deal as
 * every other asset in this project, which means the site renders identically
 * offline, behind a firewall, and in five years when a hosted service has
 * changed its URLs.
 *
 * A spec has two independent halves, and either alone is useful:
 *
 *   `family` — the family name. On its own it selects something already on the
 *              machine, which is the right answer for Georgia or Helvetica.
 *   `file`   — a path under `public/`. Supplying this loads the file and uses
 *              it under `family` (or under a name derived from the filename).
 *
 * `primary` / `secondary` are the previous two-font system and are still
 * honoured: `primary` stands in as the shared face when `font` is unset, and
 * `secondary` still supplies the editorial family. Existing content needs no
 * migration.
 *
 * Failure is quiet and total: a font that does not load leaves the variables
 * alone, so the page keeps the system stack from tokens.css. It never blanks,
 * never blocks first paint, and never shows invisible text — `FontFace` is used
 * precisely because it reports failure, which an injected `@font-face` rule
 * cannot do.
 *
 * Nothing here styles a component. Every value lands on `:root` as a token that
 * tokens.css already consumes, which is why there are no typography styles
 * scattered through the React tree.
 */
import { useEffect } from 'react';
import type { FontSpec, TypeRole, TypographySettings } from '@/types/content';
import { asset } from '@/lib/paths';

/** What `format()` to declare, from the extension. */
function formatOf(file: string): string | undefined {
  const ext = file.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'woff2':
      return 'woff2';
    case 'woff':
      return 'woff';
    case 'ttf':
      return 'truetype';
    case 'otf':
      return 'opentype';
    default:
      return undefined;
  }
}

/** A usable family name when only a file was given: fonts/PPNeue.woff2 → PPNeue. */
function familyFromFile(file: string): string {
  const base = file.split('/').pop() ?? file;
  return base.replace(/\.(woff2|woff|ttf|otf)$/i, '') || 'Custom';
}

/**
 * Resolves one spec to a CSS font-family value, loading a file if asked.
 *
 * Returns `null` when there is nothing to apply, so the caller can leave the
 * token untouched rather than writing an empty string over the system stack.
 */
export async function loadFont(spec?: FontSpec): Promise<string | null> {
  if (!spec) return null;
  const family = spec.family?.trim() || (spec.file ? familyFromFile(spec.file) : '');
  if (!family) return null;

  // Family only: a font already installed, or one of the generic names. Nothing
  // to fetch, and quoting it keeps multi-word names valid.
  if (!spec.file) return `'${family}'`;

  const url = asset(spec.file);
  if (!url) return `'${family}'`;

  const format = formatOf(spec.file);
  const source = format
    ? `url(${JSON.stringify(url)}) format('${format}')`
    : `url(${JSON.stringify(url)})`;

  try {
    const face = new FontFace(family, source, { display: 'swap' });
    await face.load();
    document.fonts.add(face);
    return `'${family}'`;
  } catch {
    // A typo in the path, a file that never got committed, a corrupt woff2.
    // None of those should cost the visitor the page — but the person editing
    // the content does need to know, and this is the only place that knows.
    console.warn(`Typography: could not load "${spec.file}". Falling back to the system font.`);
    // The family may still exist on this machine even though the file did not
    // load, so it is still worth naming.
    return `'${family}'`;
  }
}

/** Trim trailing zeros so the CSS stays readable in devtools. */
function num(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * How much each role gives up on a small screen.
 *
 * A configured size is the DESKTOP reference. Display is the loud one, so it
 * shrinks hardest — a 40px title that stays 40px on a phone is a wall. Heading
 * moves a little. Body does not move at all, because body text is already at its
 * readable size and shrinking it is how sites become unreadable on the device
 * most people use.
 */
const SHRINK = { display: 0.55, heading: 0.2, body: 0 } as const;

/** The viewport width (px) at which a role reaches its configured size. */
const FULL_AT_VW = 1280;

/**
 * A responsive `font-size` for one role, in a form the global scale multiplies.
 *
 * The clamp's lower bound is the fluid term evaluated at zero width — the
 * smallest value this formula can produce. It is written out rather than left
 * implicit so the intent is legible in devtools.
 */
function sizeValue(px: number, role: keyof typeof SHRINK): string {
  const scaled = (value: string) => `calc(${value} * var(--type-scale))`;
  const shrink = SHRINK[role];
  if (!shrink) return scaled(`${num(px)}px`);

  const floor = px * (1 - shrink);
  const perVw = (px - floor) / (FULL_AT_VW / 100);
  return scaled(`clamp(${num(floor)}px, ${num(floor)}px + ${num(perVw)}vw, ${num(px)}px)`);
}

const ROLES = ['display', 'heading', 'body'] as const;

/** Every property this hook may write, so a cleared setting really does clear. */
const OWNED = [
  '--font-custom',
  '--font-editorial',
  '--font-serif',
  '--type-scale',
  ...ROLES.flatMap((role) => [
    `--font-custom-${role}`,
    `--size-${role}`,
    `--weight-${role}`,
    `--tracking-${role}`,
    `--leading-${role}`,
  ]),
];

/** Writes one role's four numeric settings; an absent field keeps the default. */
function applyRole(root: HTMLElement, name: keyof typeof SHRINK, role?: TypeRole) {
  if (!role) return;
  if (role.size !== undefined) root.style.setProperty(`--size-${name}`, sizeValue(role.size, name));
  if (role.weight !== undefined) root.style.setProperty(`--weight-${name}`, num(role.weight));
  if (role.tracking !== undefined)
    root.style.setProperty(`--tracking-${name}`, `${num(role.tracking)}em`);
  if (role.leading !== undefined) root.style.setProperty(`--leading-${name}`, num(role.leading));
}

/**
 * Loads a set of specs, fetching each distinct file exactly once.
 *
 * Three roles pointing at the same file is the normal case, not an edge case, and
 * without this it would mean three `FontFace` objects for one download — three
 * entries in `document.fonts` under the same family name, which is wasteful at
 * best and ambiguous at worst.
 */
function loadAll(specs: Record<string, FontSpec | undefined>): Promise<Record<string, string | null>> {
  const cache = new Map<string, Promise<string | null>>();
  const keys = Object.keys(specs);

  return Promise.all(
    keys.map((key) => {
      const spec = specs[key];
      if (!spec || (!spec.family && !spec.file)) return Promise.resolve(null);
      const id = `${spec.family ?? ''}|${spec.file ?? ''}`;
      let pending = cache.get(id);
      if (!pending) {
        pending = loadFont(spec);
        cache.set(id, pending);
      }
      return pending;
    }),
  ).then((values) => Object.fromEntries(keys.map((key, i) => [key, values[i]])));
}

/**
 * Applies the configured typography to the document.
 *
 * The custom family is put in FRONT of the system stack rather than replacing
 * it, so the tokens' fallbacks still catch everything the file does not cover —
 * a Latin-only display face will not turn Arabic or emoji into boxes.
 */
export function useTypography(typography?: TypographySettings) {
  // One serialised dependency, so the effect re-runs when a value actually
  // changes and not every time the Studio hands back an equal object. There are
  // now four font specs and twelve numbers in play; twelve `useMemo`s would be
  // worse than one string comparison.
  const config = JSON.stringify({
    shared: typography?.font ?? typography?.primary,
    secondary: typography?.secondary,
    scale: typography?.scale,
    display: typography?.display,
    heading: typography?.heading,
    body: typography?.body,
  });

  useEffect(() => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;

    const root = document.documentElement;
    let cancelled = false;

    // Clear the previous run BEFORE reading anything, otherwise a second run
    // reads its own output and stacks the old font inside the new one's fallback
    // list — forever.
    for (const name of OWNED) root.style.removeProperty(name);

    const styles = getComputedStyle(root);
    // The native stacks are never overwritten by anyone, so this is stable.
    const nativeSans = styles.getPropertyValue('--font-native-sans').trim();
    const baseEditorial = styles.getPropertyValue('--font-editorial').trim();

    const settings = JSON.parse(config) as {
      shared?: FontSpec;
      secondary?: FontSpec;
      scale?: number;
      display?: TypeRole;
      heading?: TypeRole;
      body?: TypeRole;
    };

    if (settings.scale !== undefined) {
      root.style.setProperty('--type-scale', num(settings.scale / 100));
    }
    for (const role of ROLES) applyRole(root, role, settings[role]);

    // Only what is configured is fetched, each distinct file exactly once. An
    // unset face costs no request — and the *absence* of `--font-custom-*` is
    // exactly why the page looks untouched when nothing is configured.
    void loadAll({
      shared: settings.shared,
      display: settings.display?.font,
      heading: settings.heading?.font,
      body: settings.body?.font,
      secondary: settings.secondary,
    }).then((loaded) => {
      if (cancelled) return;

      // The shared face first, then each role's own on top of it. Both levels are
      // written; the cascade in tokens.css decides which one a role actually gets,
      // so there is no precedence logic duplicated here.
      if (loaded.shared) root.style.setProperty('--font-custom', `${loaded.shared}, ${nativeSans}`);
      for (const role of ROLES) {
        const value = loaded[role];
        if (value) root.style.setProperty(`--font-custom-${role}`, `${value}, ${nativeSans}`);
      }

      if (loaded.secondary) {
        // --font-serif is an alias of --font-editorial in tokens.css; setting it
        // inline breaks that link, so it is written explicitly too.
        root.style.setProperty('--font-editorial', `${loaded.secondary}, ${baseEditorial}`);
        root.style.setProperty('--font-serif', `${loaded.secondary}, ${baseEditorial}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config]);
}
