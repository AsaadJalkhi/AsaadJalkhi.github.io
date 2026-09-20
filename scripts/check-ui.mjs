/**
 * Shell regressions — every UI bug found by hand, pinned.
 *
 * Exists for the same reason `roundtrip.mjs` exists: each of these was found by
 * hand, and a bug verified by hand is a bug that comes back. Plain Node, no test
 * runner to install, same shape as its neighbour:
 *
 *   node scripts/check-ui.mjs
 *
 * Checks 11–15 are session 11: Focus Mode above the whole OS, arrows in reserved
 * gutters rather than on top of the words, `media.title` with no project-title
 * fallback, typography-only type scaling, and Quick View handing the desktop
 * back. Each one carries its root cause in a comment, because in every case the
 * obvious fix — a bigger z-index, a page reload — was the wrong one.
 *
 * Checks 1–10 are session 10, each of which was actually broken:
 *
 * 1. **`#/studio` renders Studio, not a giant poster.** The route was never the
 *    problem. `.studio-hero-preview` lost `position: relative`, so the hero
 *    picker's `<SmartImage class="media-fill">` — `position: absolute; inset: 0`
 *    — resolved its containing block all the way up to `.studio`, which is
 *    `position: fixed; inset: 0`, and covered the whole editor. `overflow:
 *    hidden` does not save you: a clipper only clips descendants whose
 *    containing block is inside it. Checked here as a property of every
 *    container that renders media in `card` or `focus` mode, because the mode
 *    contract is "the container supplies the box" and the next one will forget.
 *
 * 2. **Focus Mode picks its layout from the aspect ratio.** Ratios in, layout
 *    out — `focusLayout.ts` is pure precisely so this can be asserted with
 *    numbers instead of a browser.
 *
 * 3. **A desktop icon drags from the middle of its artwork.** Pressing on the
 *    PNG started Chrome's native image drag: a ghost of the image followed the
 *    cursor over the widgets, the pointer stream to `useDesktopLayout` was cut,
 *    and the shortcut stayed put. The fix is `draggable={false}` on the image
 *    and `pointer-events: none` in the stylesheet, so the button owns the
 *    gesture. Both are asserted; either one alone leaves the bug reachable.
 *
 * Source-text assertions where the property lives in CSS or JSX, a real import
 * where the property lives in a function. Neither needs a DOM.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

/**
 * The body of one CSS rule, by selector. Comments are stripped first, and
 * whitespace inside the selector is treated as flexible so a grouped rule can be
 * asked for as `.a, .b` however it happens to be wrapped in the file.
 */
function rule(css, selector) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = selector
    .trim()
    .split(/\s*,\s*/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(',\\s*');
  const found = new RegExp(`(^|[};\\n])\\s*${pattern}\\s*\\{([^}]*)\\}`, 'm').exec(clean);
  if (!found) throw new Error(`no rule for \`${selector.replace(/\s+/g, ' ')}\``);
  return found[2];
}

/* ------------------------------------------- load the pure layout decider */

const outdir = mkdtempSync(join(tmpdir(), 'asaad-ui-'));
const bundle = join(outdir, 'focus-layout.mjs');

await build({
  entryPoints: [join(root, 'src/components/media/focusLayout.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'silent',
  alias: { '@': join(root, 'src') },
});

const { focusLayout, focusPlan } = await import(pathToFileURL(bundle).href);

/* ------------------------------------------------------------- the checks */

const failures = [];
const notes = [];

function check(name, fn) {
  try {
    const note = fn();
    if (note) notes.push(`   ${note}`);
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

console.log('\nShell regressions\n');

/* ------------------------------------------------------------ 1. #/studio */

check('1. #/studio bypasses the OS shell and renders Studio', () => {
  const app = read('src/App.tsx');
  if (!/routeParts\(route\)\[0\] === 'studio'/.test(app)) {
    throw new Error('App.tsx no longer recognises the studio route');
  }
  if (!/if \(inStudio\) \{/.test(app)) throw new Error('the studio early return is gone');
  // Lazy, so the editor is not in the visitor's bundle.
  if (!/lazy\(\(\) =>\s*import\('@\/studio\/StudioApp'\)/.test(app)) {
    throw new Error('StudioApp is no longer lazily imported');
  }
  // The early return must come before the desktop, or the shell renders under it.
  const studioAt = app.indexOf('if (inStudio) {');
  const desktopAt = app.indexOf('<Desktop');
  if (desktopAt >= 0 && studioAt > desktopAt) {
    throw new Error('the studio return sits after the desktop render');
  }
  return 'route → <Suspense> → <StudioApp />, ahead of the shell';
});

check('2. every card/focus media container is a containing block', () => {
  /*
   * THE session-10 regression. `card` and `focus` hand back a bare adapter whose
   * root may be `position: absolute; inset: 0`; without `position: relative`
   * here it escapes to the nearest positioned ancestor and fills that instead.
   */
  const containers = [
    ['src/studio/studio.css', '.studio-hero-preview'],
    ['src/components/media/media.css', '.focus__box'],
  ];
  for (const [file, selector] of containers) {
    const body = rule(read(file), selector);
    if (!/position:\s*relative/.test(body)) {
      throw new Error(`${selector} in ${file} is missing \`position: relative\``);
    }
  }
  return `${containers.length} containers positioned`;
});

/* --------------------------------------------------------- 3. Focus Mode */

check('3. Focus Mode layout follows the aspect ratio', () => {
  const cases = [
    ['9:16 Reel', 9 / 16, 'portrait'],
    ['4:5 IG post', 4 / 5, 'portrait'],
    ['1:1 square', 1, 'balanced'],
    ['4:3 photo', 4 / 3, 'balanced'],
    ['16:9 player', 16 / 9, 'landscape'],
    ['3:2 photo', 3 / 2, 'landscape'],
    ['2.39:1 campaign', 2.39, 'landscape'],
    ['unmeasured', 0, 'landscape'],
  ];
  for (const [label, ratio, expected] of cases) {
    const got = focusLayout(ratio);
    if (got !== expected) throw new Error(`${label} (${ratio}) → ${got}, expected ${expected}`);
  }
  return `${cases.length} ratios classified`;
});

check('4. landscape is never side-by-side; portrait is, when there is room', () => {
  const opts = { hasInfo: true, padding: 28, gap: 24 };
  const desk = { width: 1680, height: 1050 };

  if (focusPlan(16 / 9, desk, opts).flow !== 'stack') {
    throw new Error('a 16:9 player was put in the portrait side-by-side layout');
  }
  if (focusPlan(9 / 16, desk, opts).flow !== 'side') {
    throw new Error('a Reel was stacked on a wide desktop');
  }
  // Balanced follows the viewport: composed side-by-side when wide, stacked when not.
  if (focusPlan(1, desk, opts).flow !== 'side') throw new Error('a square was stacked at 1680px');
  if (focusPlan(1, { width: 900, height: 1200 }, opts).flow !== 'stack') {
    throw new Error('a square stayed side-by-side at 900px');
  }
  // A phone gets one column whatever the shape is.
  for (const ratio of [9 / 16, 1, 16 / 9]) {
    if (focusPlan(ratio, { width: 390, height: 844 }, opts).flow !== 'stack') {
      throw new Error(`ratio ${ratio} was not stacked on a phone`);
    }
  }
  return 'landscape stacked, portrait beside, balanced by width';
});

check('5. the media box keeps its aspect and fits the viewport', () => {
  const opts = { hasInfo: true, padding: 28, gap: 24 };
  const viewports = [
    { width: 1680, height: 1050 },
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ];
  for (const viewport of viewports) {
    for (const ratio of [9 / 16, 4 / 5, 1, 4 / 3, 16 / 9, 2.39]) {
      const { media } = focusPlan(ratio, viewport, opts);
      // Rounded to whole pixels, so allow a pixel of slack — not a stretch.
      if (Math.abs(media.width / media.height - ratio) > 0.02) {
        throw new Error(`ratio ${ratio} at ${viewport.width}× came out as ${media.width}×${media.height}`);
      }
      if (media.width > viewport.width || media.height > viewport.height) {
        throw new Error(`ratio ${ratio} overflows ${viewport.width}×${viewport.height}`);
      }
      if (media.width < 80 || media.height < 80) {
        throw new Error(`ratio ${ratio} at ${viewport.width}× collapsed to ${media.width}×${media.height}`);
      }
    }
  }
  return 'aspect preserved, nothing overflows, nothing collapses';
});

check('6. Focus sits above the dock, on the shared z-index scale', () => {
  const css = read('src/components/media/media.css');
  const focus = rule(css, '.focus');
  const token = /z-index:\s*var\(--z-([a-z-]+)\)/.exec(focus);
  if (!token) throw new Error('.focus uses a raw z-index instead of a token');

  // The token must actually outrank the dock and the windows on the one scale.
  const tokens = read('src/styles/tokens.css');
  const value = (name) => {
    const found = new RegExp(`--z-${name}:\\s*(\\d+)`).exec(tokens);
    if (!found) throw new Error(`--z-${name} is not defined in tokens.css`);
    return Number(found[1]);
  };
  const focusZ = value(token[1]);
  for (const below of ['dock', 'window', 'icon', 'widget']) {
    const other = new RegExp(`--z-${below}:`).test(tokens) ? value(below) : null;
    if (other !== null && focusZ <= other) {
      throw new Error(`--z-${token[1]} (${focusZ}) does not outrank --z-${below} (${other})`);
    }
  }

  // The controls are the overlay's, not the media's: absolute, above the iframe.
  const nav = rule(css, '.focus__close, .focus__nav');
  if (!/position:\s*absolute/.test(nav)) throw new Error('the controls are in the document flow');
  return `--z-${token[1]} (${focusZ})`;
});

check('7. the caption wraps inside the layout and never scrolls the media', () => {
  const css = read('src/components/media/media.css');
  const caption = rule(css, '.focus__caption');
  if (!/white-space:\s*pre-wrap/.test(caption)) throw new Error('author line breaks are discarded');
  if (!/overflow-wrap:\s*anywhere/.test(caption)) throw new Error('a long word can overflow');
  // The information region scrolls. The media must not become a nested scroller.
  const box = rule(css, '.focus__box');
  if (/overflow-[xy]?:\s*(auto|scroll)/.test(box)) {
    throw new Error('.focus__box is a nested scrolling box');
  }
  return 'pre-wrap + anywhere, media not scrollable';
});

/* ------------------------------------------------------- 4. desktop icons */

check('8. desktop icon artwork cannot start a native image drag', () => {
  const tsx = read('src/components/os/DesktopIcon.tsx');
  if (!/draggable=\{false\}/.test(tsx)) throw new Error('the icon image is still draggable');
  if (!/onDragStart=\{\(event\) => event\.preventDefault\(\)\}/.test(tsx)) {
    throw new Error('no dragstart guard on the icon image');
  }
  // The wrapper owns the gesture, so a press in the middle of the PNG reaches it.
  const img = rule(read('src/components/os/os.css'), '.dicon__img');
  if (!/pointer-events:\s*none/.test(img)) {
    throw new Error('.dicon__img still takes the pointer from the button');
  }
  if (!/-webkit-user-drag:\s*none/.test(img)) throw new Error('.dicon__img lacks -webkit-user-drag');
  return 'image inert, button owns the gesture';
});

check('9. the desktop drag gesture is still intact', () => {
  // The fix above must not have been "the button no longer drags".
  const tsx = read('src/components/os/DesktopIcon.tsx');
  if (!/onPointerDown=\{onPointerDown\}/.test(tsx)) throw new Error('the wrapper lost onPointerDown');
  if (!/onClick=/.test(tsx) || !/onDoubleClick=\{onOpen\}/.test(tsx)) {
    throw new Error('the wrapper lost its click/open behaviour');
  }
  const layout = read('src/hooks/useDesktopLayout.ts');
  for (const part of ['setPointerCapture', 'DRAG_THRESHOLD', 'didDrag']) {
    if (!layout.includes(part)) throw new Error(`useDesktopLayout lost ${part}`);
  }
  return 'pointer capture, drag threshold and click all present';
});

check('10. no icon is drawn on a plate', () => {
  const glyph = rule(read('src/components/os/os.css'), '.dicon__glyph');
  for (const [property, why] of [
    ['background', 'a filled backdrop'],
    ['box-shadow', 'a raised tile'],
    ['border-radius', 'a rounded square'],
  ]) {
    if (new RegExp(`${property}:`).test(glyph)) {
      throw new Error(`.dicon__glyph has ${why} again (${property})`);
    }
  }
  // Artwork and generic glyph must occupy the same footprint, or the row
  // reads as two different kinds of object.
  const size = (selector) => {
    const body = rule(read('src/components/os/os.css'), selector);
    return /width:\s*(\d+)px/.exec(body)?.[1];
  };
  if (size('.dicon__art') !== size('.dicon__glyph')) {
    throw new Error(`footprints differ: art ${size('.dicon__art')}px, glyph ${size('.dicon__glyph')}px`);
  }
  // The monogram is a mark, not text in a coloured square.
  const tsx = read('src/components/os/DesktopIcon.tsx');
  if (/style=\{tint \? \{ background/.test(tsx)) throw new Error('tint paints a plate again');
  return `both ${size('.dicon__art')}px, unplated`;
});

/* ------------------------------------------------------- 5. session-11 bugs */

check('11. the nav arrows get their own reserved gutters', () => {
  // The arrows were overlapping the title and the caption, and the tempting fix
  // — a bigger z-index — only moves the collision behind the text instead of in
  // front of it. So the LAYOUT gives up the width: focusPlan subtracts a gutter
  // at each edge, and .focus__layout pads by the identical amount.
  const viewport = { width: 1440, height: 900 };
  const base = { hasInfo: true, padding: 28, gap: 24 };

  const alone = focusPlan(9 / 16, viewport, { ...base, hasNav: false });
  if (alone.gutter !== 0) throw new Error(`a single item reserved ${alone.gutter}px of gutter`);

  const many = focusPlan(9 / 16, viewport, { ...base, hasNav: true });
  if (many.gutter <= 0) throw new Error('no gutter was reserved for the arrows');
  if (many.media.width >= alone.gutter + 1 + viewport.width - base.padding * 2) {
    throw new Error('the media did not give up any width for the gutters');
  }
  if (many.media.width > alone.media.width) {
    throw new Error('reserving gutters made the media wider');
  }

  // A phone still reserves a lane — narrower, but never zero, or the arrows go
  // back on top of the words.
  const phone = focusPlan(1, { width: 390, height: 844 }, { ...base, hasNav: true });
  if (phone.gutter <= 0) throw new Error('a phone reserved no gutter at all');

  // And the stylesheet must spend it: the same two numbers, passed in by the
  // component, appear in the padding and in the arrows' own offsets.
  const css = read('src/components/media/media.css');
  const layout = rule(css, '.focus__layout');
  if (!/padding:\s*var\(--focus-pad\)\s*calc\(var\(--focus-pad\)\s*\+\s*var\(--focus-gutter\)\)/.test(layout)) {
    throw new Error('.focus__layout does not pad by the gutter it was given');
  }
  for (const side of ['prev', 'next']) {
    const arrow = rule(css, `.focus__nav--${side}`);
    if (!/var\(--focus-gutter\)/.test(arrow)) {
      throw new Error(`.focus__nav--${side} is not positioned inside the gutter`);
    }
  }
  return `${many.gutter}px desktop, ${phone.gutter}px phone, reserved not overlaid`;
});

check('12. Focus Mode escapes the window stacking context', () => {
  // --z-focus outranks --z-menubar on the token scale, and always did outrank
  // the dock — but MediaFocus renders inside a project window, and `.window` has
  // `isolation: isolate`. A z-index set inside a stacking context only competes
  // with its siblings, so the number was never the problem and raising it again
  // would do nothing. The portal is the fix.
  const tsx = read('src/components/media/MediaFocus.tsx');
  if (!/createPortal\(overlay,\s*document\.body\)/.test(tsx)) {
    throw new Error('MediaFocus no longer portals to document.body — the menu bar will show through');
  }

  const tokens = read('src/styles/tokens.css');
  const value = (name) => {
    const found = new RegExp(`--z-${name}:\\s*(\\d+)`).exec(tokens);
    if (!found) throw new Error(`--z-${name} is not defined in tokens.css`);
    return Number(found[1]);
  };
  if (value('focus') <= value('menubar')) {
    throw new Error(`--z-focus (${value('focus')}) does not outrank --z-menubar (${value('menubar')})`);
  }
  // Still an application layer: boot and the cursor stay on top of it.
  if (value('focus') >= value('boot')) throw new Error('--z-focus outranks the startup cover');

  // And nobody reached for a magic number elsewhere to compensate.
  const stray = [];
  for (const file of ['src/components/media/media.css', 'src/components/windows/window.css']) {
    const clean = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, z] of clean.matchAll(/z-index:\s*(\d{3,})/g)) stray.push(`${file}: ${z}`);
  }
  if (stray.length) throw new Error(`raw z-index values outside the token scale — ${stray.join(', ')}`);
  return `portalled, --z-focus ${value('focus')} > --z-menubar ${value('menubar')}`;
});

check('13. a media title is the item\'s own, or there is none', () => {
  const tsx = read('src/components/media/MediaFocus.tsx');
  // The title comes from the item and only from the item.
  if (!/const title = active\.title\?\.trim\(\)/.test(tsx)) {
    throw new Error('the Focus title is no longer read from media.title');
  }
  // The old behaviour: the project's name rendered as every item's heading.
  if (/focus__title[^]*?context[?.]/.test(tsx) || /<h2[^>]*>\{context/.test(tsx)) {
    throw new Error('the project title is being used as the media title again');
  }
  if (/title\s*(\?\?|\|\|)\s*context/.test(tsx) || /context\?\.title\s*(\?\?|\|\|)/.test(tsx)) {
    throw new Error('there is a fallback from media.title to the project title');
  }
  // Optional in the schema, so existing content stays valid and an untouched
  // export gains no keys.
  const schema = read('src/types/content.ts');
  if (!/title: z\.string\(\)\.optional\(\)/.test(schema)) {
    throw new Error('media.title is not an optional string');
  }
  // And it is editable, or it may as well not exist.
  if (!/label="Media title"/.test(read('src/studio/panels/MediaFields.tsx'))) {
    throw new Error('the Studio has no Media title field');
  }
  return 'media.title only, no project-title fallback';
});

check('14. the type scale moves typography and nothing else', () => {
  const tokens = read('src/styles/tokens.css');
  // Comments out, whitespace flattened, so a fallback chain can be asked for as
  // one readable string however the declaration happens to be wrapped.
  const flat = tokens.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  // Every font-size token is scaled...
  const unscaled = [...tokens.matchAll(/--fs-[\w-]+:\s*([^;]+);/g)].filter(
    ([, value]) => !value.includes('var(--type-scale)'),
  );
  if (unscaled.length) throw new Error(`${unscaled.length} --fs-* token(s) ignore --type-scale`);

  // ...and --fs-* is only ever spent on font-size, which is what makes "type
  // only" true rather than merely intended. Spacing, radii and icon sizes are px
  // on their own scales and cannot see this variable.
  const files = readdirSync(join(root, 'src'), { recursive: true })
    .filter((file) => String(file).endsWith('.css'))
    .map((file) => join('src', String(file)));
  const misuse = [];
  for (const file of files) {
    if (file.endsWith('tokens.css')) continue;
    for (const line of read(file).split('\n')) {
      if (!line.includes('--fs-')) continue;
      if (!/^\s*font(-size)?:/.test(line)) misuse.push(`${file}: ${line.trim()}`);
    }
  }
  if (misuse.length) throw new Error(`--fs-* used for something other than font-size — ${misuse[0]}`);

  // The three roles exist, with four numeric controls each, and every default is a
  // value the CSS already used — so configuring nothing changes nothing.
  for (const role of ['display', 'heading', 'body']) {
    for (const axis of ['size', 'weight', 'tracking', 'leading']) {
      if (!new RegExp(`--${axis}-${role}:`).test(tokens)) {
        throw new Error(`--${axis}-${role} is not defined`);
      }
    }
    // Each role resolves its own face first, then the shared face, then native.
    // Three levels, in that order: giving a role its own font is an override, and
    // a role with none must still land on the shared face before the system stack.
    const chain = `--font-${role}: var(--font-custom-${role}, var(--font-custom, var(--font-native-`;
    if (!flat.includes(chain)) {
      throw new Error(`--font-${role} does not fall back role → shared → native`);
    }
  }
  // None of the custom faces may have a default: an empty custom property makes
  // font-family invalid instead of falling back to the system stack, which would
  // cost an unconfigured site its font entirely.
  const names = tokens.split('\n').map((line) => line.trim().split(':')[0].trim());
  for (const face of ['--font-custom', '--font-custom-display', '--font-custom-heading', '--font-custom-body']) {
    if (names.includes(face)) {
      throw new Error(`${face} has a default value; an unconfigured site would lose its font`);
    }
  }
  if (!/--font-native-sans:/.test(tokens) || !/--font-native-display:/.test(tokens)) {
    throw new Error('the native stacks are gone; there is nothing left to fall back to');
  }
  // A role's own font must actually be settable, or the control is decoration.
  if (!/font: FontSpecSchema\.optional\(\)/.test(read('src/types/content.ts'))) {
    throw new Error('TypeRoleSchema has no font of its own');
  }
  return '3 roles × (own face + 4 controls), --fs-* scaled, spacing untouched';
});

check('15. Quick View hands the OS back without a page load', () => {
  const app = read('src/App.tsx');
  // The bug: the hash→state effect depends on `view`, so setView('desktop') re-ran
  // it, it re-read the unchanged #/quick and set the view straight back. The two
  // effects then ping-ponged, which is the stuck state — nothing to do with
  // localhost. A route is now applied exactly once.
  if (!/appliedRoute/.test(app)) throw new Error('the route guard is gone; #/quick will stick again');
  if (!/if \(appliedRoute\.current === route\) return;/.test(app)) {
    throw new Error('the hash→state effect applies the same route more than once');
  }
  // SPA navigation only: no reload, no assignment to location.
  for (const pattern of [/location\.reload\(/, /location\.href\s*=/, /location\.assign\(/]) {
    if (pattern.test(app) || pattern.test(read('src/components/quick-view/QuickView.tsx'))) {
      throw new Error('Quick View forces a browser navigation instead of routing');
    }
  }
  return 'route applied once, view changes survive, no reload';
});

/* ---------------------------------------------------------------- report */

console.log();
for (const note of notes) console.log(note);
rmSync(outdir, { recursive: true, force: true });

if (failures.length) {
  console.log(`\n${failures.length} FAILED: ${failures.join(', ')}\n`);
  process.exit(1);
}
console.log('\nAll checks passed.\n');
