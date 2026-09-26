/**
 * Shell regressions — every UI bug found by hand, pinned.
 *
 * Exists for the same reason `roundtrip.mjs` exists: each of these was found by
 * hand, and a bug verified by hand is a bug that comes back. Plain Node, no test
 * runner to install, same shape as its neighbour:
 *
 *   node scripts/check-ui.mjs
 *
 * Check 27 is session 15: project cards are packed shortest-column-first into as many columns
 * as the CONTAINER can hold, not laid out in a row-based grid. It is written as a property of
 * the packing rather than of the Work window, because the report was two bugs — "the grid" and
 * "inside a folder" — and a folder is that same window carrying `payload.folderId`. So the
 * check also asserts there is one layout and one packer, shared with the media masonry.
 *
 * Check 26 is session 14: `media.tools`, `media.date` and `media.credit` belong to the item and
 * to Focus Mode; `project.tools` belongs to the project footer; the grid tile shows neither.
 *
 * Checks 20–25 are session 13: the project banner is a field of its own rather
 * than a promoted media item, body media is shown whole instead of cropped into
 * a tile, a local path is normalised to one canonical shape, and — the one with
 * a real root cause — a tap inside a folder on mobile opens a sheet rather than
 * a desktop window nobody can see. Check 25 pins the shape of the fix, not the
 * symptom: one open path, declared by the shell.
 *
 * Checks 16–18 are session 12: desktop icons keep free positioning but gain a
 * protected area, the Quick View counter row is gone, and a search result no
 * longer prints its type. The first is the one with teeth — "add collision" is
 * one keystroke away from "add a grid", and a grid is explicitly not wanted, so
 * the checks assert both halves: a free drop is kept to the pixel, and a
 * colliding one is resolved to somewhere near, not to a cell.
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

const placementBundle = join(outdir, 'desktop-placement.mjs');

await build({
  entryPoints: [join(root, 'src/hooks/desktopPlacement.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: placementBundle,
  logLevel: 'silent',
  alias: { '@': join(root, 'src') },
});

const { SAFE_PAD, collides, isFreeSpot, resolveSpot } = await import(
  pathToFileURL(placementBundle).href
);

/*
 * The local-path rules, imported rather than restated. A second copy of "what
 * counts as a path inside public/" is a second thing to fall out of step with
 * the Studio and the schema, which is the whole reason they live in one module.
 */
const pathsBundle = join(outdir, 'paths.mjs');

await build({
  entryPoints: [join(root, 'src/lib/paths.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: pathsBundle,
  logLevel: 'silent',
  alias: { '@': join(root, 'src') },
});

const { normalizeLocalPath } = await import(pathToFileURL(pathsBundle).href);

/*
 * The masonry, imported rather than described. Packing and the width → column
 * count rule are pure functions precisely so the layout can be asserted with
 * numbers: "this card went into the shorter column" is a property, not a
 * screenshot.
 */
const masonryBundle = join(outdir, 'masonry.mjs');

await build({
  entryPoints: [join(root, 'src/lib/masonry.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: masonryBundle,
  logLevel: 'silent',
  alias: { '@': join(root, 'src') },
});

const { packColumns, columnsForWidth } = await import(pathToFileURL(masonryBundle).href);

/*
 * The content schema, imported so "old folders stay valid" is asserted by
 * parsing real folders, not by reading the source for `.optional()`.
 */
const schemaBundle = join(outdir, 'content-schema.mjs');

await build({
  entryPoints: [join(root, 'src/types/content.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: schemaBundle,
  logLevel: 'silent',
  alias: { '@': join(root, 'src') },
});

const { FolderSchema, ProjectSchema } = await import(pathToFileURL(schemaBundle).href);

/* The list reorder, imported so a drop from #10 to #02 is asserted with a real array. */
const utilsBundle = join(outdir, 'utils.mjs');

await build({
  entryPoints: [join(root, 'src/lib/utils.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: utilsBundle,
  logLevel: 'silent',
  alias: { '@': join(root, 'src') },
});

const { moveItem, slotIndex } = await import(pathToFileURL(utilsBundle).href);

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
    ['src/components/media/media.css', '.focus__box'],
    ['src/components/windows/apps/apps.css', '.player__box'],
  ];
  for (const [file, selector] of containers) {
    const body = rule(read(file), selector);
    if (!/position:\s*relative/.test(body)) {
      throw new Error(`${selector} in ${file} is missing \`position: relative\``);
    }
  }
  /*
   * `.studio-hero-preview` was the original casualty. It went with the hero it
   * previewed in session 13, so it is checked for ABSENCE instead: a rule with
   * no markup left is exactly the kind of thing that gets copied back into use
   * later, at which point the bug above is reachable again.
   */
  for (const file of ['src/studio/studio.css', 'src/studio/panels/ProjectsPanel.tsx']) {
    if (read(file).includes('studio-hero-preview')) {
      throw new Error(`${file} still carries studio-hero-preview`);
    }
  }
  return `${containers.length} containers positioned, the dead one gone`;
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

/* ------------------------------------------- 5. desktop collision + trims */

check('16. a free drop is kept exactly; nothing snaps to a grid', () => {
  const size = { width: 104, height: 120 };
  const surface = { width: 1440, height: 780 };
  const others = [{ x: 200, y: 200, width: 104, height: 120 }];

  // An arbitrary, deliberately un-round point, far from everything.
  const asked = { x: 733.4, y: 411.7 };
  const kept = resolveSpot(asked, size, others, surface);
  if (kept.x !== asked.x || kept.y !== asked.y) {
    throw new Error(`a free drop was moved: ${JSON.stringify(kept)} — this is grid snapping`);
  }

  // Free even when it is only just free: touching the protected margin is the
  // boundary, and one pixel outside it must still be honoured untouched.
  const beside = { x: 200 + 104 + SAFE_PAD + 1, y: 200 };
  const alsoKept = resolveSpot(beside, size, others, surface);
  if (alsoKept.x !== beside.x || alsoKept.y !== beside.y) {
    throw new Error('a drop just clear of the protected area was moved anyway');
  }
  return 'exact position preserved, including one pixel clear of the margin';
});

check('17. a colliding drop moves to the nearest free spot, not back and not far', () => {
  const size = { width: 104, height: 120 };
  const surface = { width: 1440, height: 780 };
  const neighbour = { x: 600, y: 400, width: 104, height: 120 };

  // Dropped almost on top of a neighbour.
  const asked = { x: 610, y: 405 };
  const out = resolveSpot(asked, size, [neighbour], surface);

  if (!isFreeSpot(out, size, [neighbour])) {
    throw new Error('the resolved spot still overlaps the protected area');
  }
  if (collides({ ...out, ...size }, neighbour)) {
    throw new Error('collides() and resolveSpot() disagree about the same pair');
  }
  // Near the attempted drop, not back where it came from and not in a corner.
  // The worst case is one full footprint plus the margin, plus a ring of slack.
  const moved = Math.hypot(out.x - asked.x, out.y - asked.y);
  const ceiling = Math.max(size.width, size.height) + SAFE_PAD + 24;
  if (moved > ceiling) {
    throw new Error(`resolved ${Math.round(moved)}px away, further than ${ceiling}px`);
  }
  // Inside the surface: a nudge may not park an icon half off the desktop.
  if (
    out.x < size.width / 2 ||
    out.y < size.height / 2 ||
    out.x > surface.width - size.width / 2 ||
    out.y > surface.height - size.height / 2
  ) {
    throw new Error('the resolved spot hangs off the edge of the surface');
  }
  return `nudged ${Math.round(moved)}px, clear and on-surface`;
});

check('18. the desktop keeps free positioning and persistence', () => {
  const hook = read('src/hooks/useDesktopLayout.ts');
  // Percentages into storage, so a layout survives a resize; the existing key.
  if (!/writeStore\(storageKeys\.layout/.test(hook)) {
    throw new Error('drops no longer persist to the desktop layout key');
  }
  // A *saved* position is the visitor's own and is never rewritten — this is
  // what keeps a layout saved before collision existed loading unchanged. It is
  // placed before anything else and skips resolution entirely.
  if (!/const decided = saved\[subject\.id\];/.test(hook)) {
    throw new Error('saved positions are no longer honoured first');
  }
  const memo = hook.slice(hook.indexOf('const positions = useMemo'), hook.indexOf('positionsRef'));
  const placeSaved = memo.indexOf('out[subject.id] = decided;');
  const resolveLoose = memo.indexOf('resolveSpot(');
  if (placeSaved < 0 || resolveLoose < 0 || placeSaved > resolveLoose) {
    throw new Error('saved positions are resolved rather than placed untouched');
  }
  // Authored coordinates get first refusal but are still resolved: no author can
  // pick an x/y that clears its neighbours at every window size.
  if (!/\[\.\.\.authored, \.\.\.seeded\]/.test(hook)) {
    throw new Error('authored positions no longer outrank the seeded scatter');
  }
  // Collision is consulted on drop, not on move: dragging over a neighbour is
  // allowed, and the drop is what has to be legal.
  const move = hook.slice(hook.indexOf('function onMove'), hook.indexOf('function onUp'));
  if (/resolveSpot/.test(move)) throw new Error('the live drag resolves collisions mid-gesture');
  if (!/const accepted = settle\(state\.id, requested, state\.element\)/.test(hook)) {
    throw new Error('the drop no longer goes through collision resolution');
  }
  // No grid anywhere: no cell size, no snap, no round-to-step.
  if (/snapTo|GRID_|CELL_|gridSnap/.test(hook)) throw new Error('a grid crept into the desktop');
  return 'drop-time resolution, saved layouts untouched, no grid';
});

check('19. Quick View has no counter row and search prints no type', () => {
  const qv = read('src/components/quick-view/QuickView.tsx');
  for (const gone of ['qv__stats', 'qv-stat', 'countByDiscipline', 'function Stat(']) {
    if (qv.includes(gone)) throw new Error(`Quick View still carries ${gone}`);
  }
  const css = read('src/components/quick-view/quick-view.css');
  if (/qv-stat|qv__stats/.test(css)) throw new Error('the stat styles outlived the markup');
  // The intro has to close itself off, or it runs into Selected Work.
  if (!/padding-bottom/.test(rule(css, '.qv__intro'))) {
    throw new Error('.qv__intro lost the padding that separates it from the next section');
  }

  const palette = read('src/components/os/CommandPalette.tsx');
  for (const gone of ['KIND_LABEL', 'palette__item-kind']) {
    if (palette.includes(gone)) throw new Error(`the palette still renders ${gone}`);
  }
  if (/palette__item-kind/.test(read('src/components/os/chrome.css'))) {
    throw new Error('the type-column styles outlived the markup');
  }
  // Everything else about the palette stays.
  for (const kept of ['palette__item-title', 'palette__item-sub', 'ArrowDown', 'onKeyDown']) {
    if (!palette.includes(kept)) throw new Error(`removing the type column took ${kept} with it`);
  }
  return 'counters gone, type column gone, titles and keys intact';
});

/* ------------------------------------------ 6. session-13: banner + media */

check('20. the project banner is its own field, not a media item', () => {
  const schema = read('src/types/content.ts');
  if (!/export const BannerSchema/.test(schema)) {
    throw new Error('BannerSchema is gone — the banner is a media item again');
  }
  if (!/type: z\.enum\(\['image', 'video'\]\)/.test(schema)) {
    throw new Error('the banner accepts something other than an image or a video');
  }
  // Optional, never defaulted, or an untouched export gains a key and the
  // round-trip guarantee is over.
  if (!/banner: BannerSchema\.optional\(\)/.test(schema)) {
    throw new Error('project.banner is not an optional field');
  }
  // Local only, enforced rather than merely documented: a URL cannot be trusted
  // to crop to a band, and an embed brings its own chrome.
  if (!/localPathProblem\(banner\.src\)/.test(schema)) {
    throw new Error('a banner src is no longer required to be a local public/ path');
  }

  const banner = read('src/components/windows/apps/ProjectBanner.tsx');
  // Not through the adapter pipeline: that contract is "show the work whole at
  // its own ratio", which is the opposite of what a banner does.
  if (/import[^;]*(MediaRenderer|MediaFrame)/.test(banner) || /<MediaFrame/.test(banner)) {
    throw new Error('the banner renders through the media pipeline again');
  }
  // And it does not edit the media list, because it was never in it.
  if (!/if \(project\.banner\) return project\.media;/.test(banner)) {
    throw new Error('a configured banner still removes an item from the project media');
  }

  // Nothing is drawn when nothing is configured: no empty band.
  const app = read('src/components/windows/apps/ProjectApp.tsx');
  if (!/\{banner && <ProjectBanner banner=\{banner\} \/>\}/.test(app)) {
    throw new Error('the case study renders a banner element unconditionally');
  }
  for (const file of ['src/components/windows/apps/ProjectApp.tsx', 'src/components/windows/apps/apps.css']) {
    if (/case__hero/.test(read(file))) throw new Error(`${file} still has the old hero element`);
  }
  return 'own schema, own local file, absent when unset';
});

check('21. the banner is a fixed band, and a banner video has no chrome', () => {
  const css = read('src/components/windows/apps/apps.css');
  const band = rule(css, '.case__banner');
  // A height the PAGE owns. Every project's banner is the same height at the
  // same window size, so it must not be derived from the source's shape.
  if (!/height:\s*clamp\(190px,\s*30vh,\s*280px\)/.test(band)) {
    throw new Error('.case__banner lost its fixed clamp() band height');
  }
  if (/aspect-ratio/.test(band)) {
    throw new Error('.case__banner takes its height from the source ratio again');
  }
  if (!/overflow:\s*hidden/.test(band)) throw new Error('.case__banner does not clip its media');

  // Cover + centred is what makes "any source shape is accepted" true, and what
  // keeps a letterbox bar off the top of every case study.
  const media = rule(css, '.case__banner-media');
  if (!/object-fit:\s*cover/.test(media)) throw new Error('the banner letterboxes instead of filling');
  if (!/object-position:\s*center/.test(media)) throw new Error('the banner crop is not centred');
  if (!/width:\s*100%/.test(media) || !/height:\s*100%/.test(media)) {
    throw new Error('the banner media does not fill the band');
  }
  // A phone gets its own shallower band, not the desktop one squashed, so the
  // title still clears the fold.
  if (!/height:\s*clamp\(170px/.test(rule(css, '.case[data-compact] .case__banner'))) {
    throw new Error('the compact banner has no band height of its own');
  }

  // Editorial motion, not a player: controls would invite a click on something
  // that is not the work.
  const tsx = read('src/components/windows/apps/ProjectBanner.tsx');
  const open = tsx.indexOf('<video');
  const video = tsx.slice(open, tsx.indexOf('/>', open));
  if (/\bcontrols\b/.test(video)) throw new Error('the banner video has native controls');
  for (const attr of ['autoPlay', 'muted', 'loop', 'playsInline']) {
    if (!new RegExp(`\\b${attr}\\b`).test(video)) {
      throw new Error(`the banner video is missing ${attr}`);
    }
  }
  return 'fixed band, cover, silent looping video with no controls';
});

check('22. body media is shown whole, and bounded by its own shape', () => {
  const css = read('src/components/media/media.css');
  /*
   * The ceiling is on HEIGHT, spent as a max-width through the ratio the frame
   * publishes. That is what lets a 9:16 Reel be complete AND not three screens
   * tall — previously those two were traded against each other, and Focus Mode
   * was the only place the whole item could be seen.
   */
  const portrait = rule(css, ".media-frame[data-shape='portrait'] .media-frame__stage");
  if (!/max-width:\s*calc\(var\(--media-cap\)\s*\*\s*var\(--frame-ratio/.test(portrait)) {
    throw new Error('portrait body media is not bounded through its own ratio');
  }
  if (!/margin-inline:\s*auto/.test(portrait)) throw new Error('bounded portrait media is not centred');
  // Declared on the frame itself, so a container can lower it for its own
  // column rather than every frame on the page arguing about the number.
  if (!/\.media-frame\s*\{[^}]*--media-cap:\s*70vh/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    throw new Error('the body-media height ceiling is gone');
  }
  // Balanced is bounded too. Landscape is width-bound already and is left
  // alone — a rule there could only start cropping it.
  rule(css, ".media-frame[data-shape='balanced'] .media-frame__stage");
  if (/object-fit:\s*cover/.test(css)) {
    throw new Error('media.css crops something; cover belongs to tiles and the banner');
  }

  // No adapter may crop outside `card`, which is the grid's own tile.
  for (const file of readdirSync(join(root, 'src/components/media/adapters'))) {
    const text = read(join('src/components/media/adapters', file));
    for (const found of text.matchAll(/objectFit=(?:\{([^}]*)\}|"([^"]*)")/g)) {
      const expr = (found[1] ?? found[2]).trim();
      if (expr.includes('cover') && !expr.includes("mode === 'card'")) {
        throw new Error(`${file} crops outside card mode: objectFit={${expr}}`);
      }
    }
  }

  // The frame publishes the number, and classifies with Focus Mode's own
  // thresholds so "portrait" cannot come to mean two different things.
  const frame = read('src/components/media/MediaFrame.tsx');
  if (!/'--frame-ratio': resolved/.test(frame)) {
    throw new Error('MediaFrame no longer publishes its resolved ratio to CSS');
  }
  if (!/from '\.\/focusLayout'/.test(frame)) {
    throw new Error('MediaFrame classifies shape with thresholds of its own');
  }
  // A natural image reaches the same rules by measuring itself. Capping the
  // <img> with max-height instead would shrink the box without moving the auto
  // margins, stranding it against the left edge of its column.
  if (!/ratio=\{measured\}/.test(read('src/components/media/adapters/ImageMedia.tsx'))) {
    throw new Error('a natural image no longer reports its measured ratio to the frame');
  }
  return 'height ceiling via --frame-ratio, no cover outside card mode';
});

check('23. a local media path is normalised, and never machine-specific', () => {
  const cases = [
    ['media/gaf/video.mp4', 'media/gaf/video.mp4'],
    ['/public/media/gaf/video.mp4', 'media/gaf/video.mp4'],
    ['public/media/gaf/video.mp4', 'media/gaf/video.mp4'],
    ['E:\\asaad portifolio\\public\\media\\gaf\\video.mp4', 'media/gaf/video.mp4'],
    ['E:/asaad portifolio/public/media/gaf/video.mp4', 'media/gaf/video.mp4'],
    ['  ./media/gaf/video.mp4  ', 'media/gaf/video.mp4'],
    ['media//gaf///video.mp4', 'media/gaf/video.mp4'],
    ['/media/gaf/video.mp4', 'media/gaf/video.mp4'],
  ];
  for (const [input, expected] of cases) {
    const { path, error } = normalizeLocalPath(input);
    if (error) throw new Error(`\`${input}\` was rejected: ${error}`);
    if (path !== expected) throw new Error(`\`${input}\` → ${path}, expected ${expected}`);
  }

  // A file outside public/ cannot ship, and saying so is the whole point: the
  // alternative is a path that works on this machine and nowhere else.
  for (const outside of ['E:\\somewhere\\video.mp4', 'C:/Users/me/Desktop/clip.mp4', 'file:///E:/x.mp4']) {
    const { path, error } = normalizeLocalPath(outside);
    if (!error) throw new Error(`\`${outside}\` was accepted as ${path}`);
    if (!/public\/ folder/.test(error)) throw new Error(`unhelpful message for ${outside}: ${error}`);
  }
  // A URL in the local half is a different mistake and gets a different answer.
  if (!/URL/.test(normalizeLocalPath('https://example.com/a.mp4').error ?? '')) {
    throw new Error('a URL pasted into the local field is not recognised as a URL');
  }
  // An empty field is not a mistake at all.
  if (normalizeLocalPath('').error || normalizeLocalPath(undefined).error) {
    throw new Error('an empty source field reports an error');
  }

  // The Studio reaches these rules rather than inventing a second set, and
  // writes the canonical form back rather than storing what was typed.
  const field = read('src/studio/panels/SourceField.tsx');
  if (!/normalizeLocalPath/.test(field)) throw new Error('SourceField has path rules of its own');
  if (!/onBlur=\{commit\}/.test(field)) throw new Error('nothing writes the normalised path back');
  // And the shipped content contains no machine path at all.
  if (/"[A-Za-z]:\\\\|"file:\/\//.test(read('src/content/portfolio.json'))) {
    throw new Error('portfolio.json contains a machine-specific path');
  }
  return `${cases.length} shapes normalised, outside-public rejected`;
});

check('24. the Studio offers Local and URL, with no fake file picker', () => {
  const field = read('src/studio/panels/SourceField.tsx');
  if (!/Local file/.test(field) || !/\bURL\b/.test(field)) {
    throw new Error('the local/URL choice is gone');
  }
  /*
   * A browser will not tell a page where a chosen file lives — it reports
   * `C:\fakepath\name.jpg` on purpose. A picker here could therefore only
   * pretend to work, so there must not be one.
   */
  if (/type="file"/.test(field)) {
    throw new Error('a file input crept in; it cannot report a real local path');
  }
  // The mode is UI state. Switching it to look at the other half and switching
  // back must not touch, and above all must not clear, the stored source.
  if (/setMode\([^)]*\)[^;]*;\s*onChange/.test(field)) {
    throw new Error('switching source mode edits the value');
  }

  // Existence is checked against the real server, and a miss is advisory.
  const probe = read('src/studio/useAssetProbe.ts');
  if (!/method: 'HEAD'/.test(probe)) throw new Error('the asset probe no longer asks the server');
  if (!/text\/html/.test(probe)) {
    throw new Error("the probe trusts the dev server's SPA fallback and will call every path found");
  }
  if (!/catch/.test(probe)) throw new Error('a failed probe can throw into the editor');

  // Both halves are wired to the media types that have two, and only those.
  const media = read('src/studio/panels/MediaFields.tsx');
  for (const local of ["case 'video':", "case 'image':"]) {
    const body = media.slice(media.indexOf(local), media.indexOf('case ', media.indexOf(local) + 8));
    if (!/SourceField/.test(body)) throw new Error(`${local} has no local/URL source field`);
  }
  // An inherently remote type keeps one plain URL box: a "local file" half for
  // YouTube would be a lie.
  const remote = media.slice(media.indexOf("case 'youtube':"), media.indexOf("case 'image':"));
  if (/SourceField/.test(remote)) {
    throw new Error('a URL-only media type was given a local-file option');
  }
  // The banner has the opposite constraint and says so. Its fields live in
  // BannerSource (shared with the folder intro), so follow it there.
  if (!/<BannerSource banner=\{banner\}/.test(read('src/studio/panels/ProjectsPanel.tsx')) ||
      !/export function BannerSource[\s\S]*?<SourceField\s+localOnly/.test(read('src/studio/panels/SourceField.tsx'))) {
    throw new Error('the banner source field is no longer local-only');
  }
  return 'two explicit modes, no picker, probe advisory';
});

check('25. opening anything on mobile makes a sheet, never a desktop window', () => {
  /*
   * THE session-13 bug. MobileShell opened a folder as a sheet containing
   * `ProjectsApp`; a tile inside it called `useOpenTarget().openProject`, which
   * called `openWindow` — a DESKTOP window, with nothing on mobile to draw it.
   * The tap looked dead, and the window appeared later, on resize. A standalone
   * project worked only because that one call site bypassed the hook entirely:
   * two paths, one wrong, and no way to tell which from inside the app.
   */
  const hook = read('src/hooks/useOpenTarget.ts');
  if (!/const surface = useOpenSurface\(\);/.test(hook)) {
    throw new Error('useOpenTarget no longer asks the shell how to open things');
  }
  if (!/if \(surface\) surface\(spec\);/.test(hook)) {
    throw new Error('the surface is not consulted before a window is opened');
  }
  // Exactly one call to openWindow in the whole hook, and it is the one inside
  // `present()`. A second is a call site deciding for itself again.
  const direct = [...hook.matchAll(/openWindow\(/g)].length;
  if (direct !== 1) {
    throw new Error(`useOpenTarget calls openWindow ${direct} times; only present() may`);
  }
  if (!/const present = \(spec: OpenSpec\) => \{\s*if \(surface\) surface\(spec\);\s*else openWindow\(spec\);/.test(hook)) {
    throw new Error('the one openWindow call is not the fallback inside present()');
  }

  const surface = read('src/components/mobile/MobileSurface.tsx');
  if (!/OpenSurfaceContext\.Provider value=\{push\}/.test(surface)) {
    throw new Error('MobileSurface does not provide an open surface');
  }
  // Sheets stack, so a project opened from inside a folder can go back to it.
  if (!/useState<Sheet\[\]>/.test(surface)) throw new Error('mobile sheets are a single slot again');

  /*
   * The surface wraps the WHOLE shell, not the home screen. Covering only part
   * of the tree is how this bug survives a fix: the command palette and the
   * `#/project/<id>` deep link both sit above the home screen and would go on
   * opening windows nobody can see. `ShellBody` is the marker that the provider
   * is on the outside.
   */
  const app = read('src/App.tsx');
  if (!/<MobileSurface enabled=\{compact\}>\s*<ShellBody/.test(app)) {
    throw new Error('the open surface no longer wraps the entire shell');
  }
  if (app.indexOf('<MobileSurface') > app.indexOf('function ShellBody')) {
    throw new Error('ShellBody is not rendered inside the surface');
  }

  // No component may reach past the surface to the window store. The palette is
  // the one that did: it is reachable from the mobile top bar.
  for (const file of [
    'src/components/mobile/MobileShell.tsx',
    'src/components/os/CommandPalette.tsx',
  ]) {
    if (/openWindow\(/.test(read(file))) {
      throw new Error(`${file} opens a desktop window directly, bypassing the surface`);
    }
  }
  // The home screen's own cards go through the hook like everyone else's.
  const shell = read('src/components/mobile/MobileShell.tsx');
  if (!/useOpenTarget\(\)/.test(shell)) {
    throw new Error('MobileShell opens its own cards without the shared hook');
  }
  for (const handler of ['openProject(project.id)', 'openFolder(folder.id)', 'openNote(note.id)']) {
    if (!shell.includes(handler)) throw new Error(`a mobile card bypasses the hook: ${handler}`);
  }
  return 'one open path, wrapping the whole shell, sheets stack';
});

/* -------------------------------------------------- 26. tools, at two levels */

check('26. tools, date and credit are the item\'s, and Focus Mode\'s alone', () => {
  /*
   * Focus Mode printed `project.tools` — the tool list for the entire case study
   * — beside every media item, so a photograph in a project that also contained
   * a 3D render advertised Blender as one of its tools. Two separate fields now:
   * `project.tools` (project-wide, the footer) and `media.tools` (per item,
   * Focus Mode only). The checks below pin BOTH halves, because dropping the
   * fallback without adding the field would just delete the information, and
   * adding the field while leaving the fallback in would hide the bug rather
   * than fix it.
   */
  const schema = read('src/types/content.ts');
  // Optional, so existing content stays valid and an untouched export gains no key.
  if (!/tools: z\.string\(\)\.optional\(\)/.test(schema)) {
    throw new Error('media.tools is not an optional string on the media item');
  }
  // The project-level field is unchanged: still a list, still defaulted.
  if (!/tools: z\.array\(z\.string\(\)\)\.default\(\[\]\)/.test(schema)) {
    throw new Error('project.tools is no longer an array of strings with a default');
  }

  const focus = read('src/components/media/MediaFocus.tsx');
  if (!/const tools = active\.tools\?\.trim\(\)/.test(focus)) {
    throw new Error('Focus Mode no longer reads tools from the media item');
  }
  // No fallback to the project, in any of the shapes one could be written in.
  if (/context\?\.tools/.test(focus) || /tools\s*(\?\?|\|\|)\s*(context|project)/.test(focus)) {
    throw new Error('Focus Mode falls back to project.tools again');
  }
  // The row is absent when the field is empty — never an empty label.
  if (!/\{tools && \(/.test(focus)) {
    throw new Error('an empty media.tools no longer hides the Tools row');
  }

  /*
   * The type is the enforcement. Not passing `tools` is a decision one call site
   * makes; removing it from `FocusContext` is a decision every future call site
   * inherits.
   */
  const contextBlock = /export interface FocusContext \{([^}]*)\}/.exec(focus);
  if (!contextBlock) throw new Error('FocusContext is no longer a plain interface');
  if (/\btools\b/.test(contextBlock[1])) {
    throw new Error('FocusContext can carry project tools into Focus Mode again');
  }

  const project = read('src/components/windows/apps/ProjectApp.tsx');
  if (/tools: project\.tools/.test(project)) {
    throw new Error('ProjectApp passes project.tools to the media gallery again');
  }
  // ...and the footer still prints them. This is the half that is easy to lose.
  if (!/project\.tools\.map\(\(tool\)/.test(project)) {
    throw new Error('the project footer no longer renders project.tools');
  }
  if (!/project\.credits\.map\(\(credit\)/.test(project)) {
    throw new Error('the project footer no longer renders project.credits');
  }

  /*
   * The normal grid shows the item's title and caption — nothing else. Tools,
   * date and the item's credit all belong to Focus Mode; project credits belong
   * to the footer. `MediaFrame` is checked by ABSENCE OF THE PROP rather than by
   * what it renders: not passing a credit is a decision nine adapters each make
   * separately, while not having a credit to pass is a decision made once.
   */
  const frame = read('src/components/media/MediaFrame.tsx');
  const frameCode = frame.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const field of ['tools', 'credit', 'date']) {
    if (new RegExp(`\\b${field}\\b`).test(frameCode)) {
      throw new Error(`MediaFrame knows about \`${field}\`; the grid is title + caption`);
    }
  }
  // ...and no adapter is handing it one anyway.
  const adapterDir = 'src/components/media/adapters';
  for (const file of readdirSync(join(root, adapterDir)).filter((f) => f.endsWith('.tsx'))) {
    const code = read(join(adapterDir, file)).replace(/\/\*[\s\S]*?\*\//g, '');
    if (/credit=\{/.test(code) || /tools=\{/.test(code) || /date=\{/.test(code)) {
      throw new Error(`${file} passes a credit, tools or date into the grid frame`);
    }
  }
  const gallery = read('src/components/media/MediaGallery.tsx');
  if (/\.tools/.test(gallery.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
    throw new Error('the masonry reads a tools field; the grid is title + caption');
  }
  if (/credits/.test(gallery.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    throw new Error('project credits have leaked into the media grid');
  }

  /*
   * Credit and date are kept as fields and shown in Focus Mode only — the
   * counterpart to the checks above. Losing the row is as much a regression as
   * printing it on the tile.
   */
  if (!/const date = active\.date\?\.trim\(\)/.test(focus)) {
    throw new Error('Focus Mode does not read media.date');
  }
  if (!/\{date && \(/.test(focus) || !/\{credit && \(/.test(focus)) {
    throw new Error('an empty date or credit no longer hides its own row');
  }
  if (!/focus__fact-label mono">Credit/.test(focus)) {
    throw new Error('Focus Mode no longer shows the item credit');
  }
  if (!/date: z\.string\(\)\.optional\(\)/.test(schema)) {
    throw new Error('media.date is not an optional string');
  }
  if (!/label="Date"[\s\S]{0,500}patch\(\{ date:/.test(read('src/studio/panels/MediaFields.tsx'))) {
    throw new Error('the Studio media editor has no Date field');
  }

  // Editable per item, or the field may as well not exist. And no media Credits:
  // there is one project-level Credits section and that is deliberate.
  const fields = read('src/studio/panels/MediaFields.tsx');
  if (!/label="Tools"[\s\S]{0,500}patch\(\{ tools:/.test(fields)) {
    throw new Error('the Studio media editor has no per-item Tools field');
  }
  if (/label="Credits"/.test(fields)) {
    throw new Error('a media-level Credits field was added; credits are project-level');
  }

  return 'media.tools/date/credit in Focus Mode, project.tools in the footer, neither in the grid';
});

/* ------------------------------------------- 27. project cards are packed */

check('27. every project collection is packed, never laid out in rows', () => {
  /*
   * The Work grid was `grid-template-columns: repeat(12, 1fr)` with a per-tile
   * span. Grid is row-based: every card in a row is as tall as the tallest, so
   * a 16:9 card beside a 4:5 one held a band of white open underneath itself
   * until the row ended — and since each project keeps its own ratio, that was
   * most rows. The report described it as two bugs, "the grid" and "inside a
   * folder", but a folder is this same window carrying `payload.folderId`; there
   * was only ever one layout, and it was wrong in one place.
   *
   * So the checks pin the property, not the pixels: packing is shortest-column
   * first, the column count comes from the CONTAINER (the window is resizable —
   * the viewport knows nothing), and there is exactly one implementation of it
   * in the repo for the media grid and the Work grid to share.
   */
  const items = [
    { id: 'a', h: 3 },
    { id: 'b', h: 1 },
    { id: 'c', h: 1 },
    { id: 'd', h: 1 },
    { id: 'e', h: 1 },
  ];
  const height = (item) => item.h;
  const ids = (columns) => columns.map((column) => column.map((item) => item.id).join(''));

  /*
   * The whole point, in one assertion: `a` is three tall, so `b`, `c` and `d`
   * all stack in the other column instead of waiting for a row to end. A
   * row-based layout would have produced ab / cd / e.
   */
  const two = ids(packColumns(items, 2, height));
  if (two.join('|') !== 'ae|bcd') {
    throw new Error(`two columns are not packed shortest-first: ${two.join(' | ')}`);
  }
  // Same algorithm at three columns — no hardcoded two anywhere.
  const six = [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), h: 1 }));
  if (ids(packColumns(six, 3, height)).join('|') !== '14|25|36') {
    throw new Error('three columns are not filled shortest-first in source order');
  }
  // One column is the content order, untouched — no masonry where none is needed.
  if (ids(packColumns(six, 1, height)).join('|') !== '123456') {
    throw new Error('a single column does not preserve the original order');
  }
  // Nothing is sorted by height and the caller's array is not reordered.
  const frozen = Object.freeze(items.slice());
  packColumns(frozen, 3, height);
  if (frozen.map((item) => item.id).join('') !== 'abcde') {
    throw new Error('packColumns mutated the collection it was given');
  }

  /* Width → columns: 1 / 2 / 3, at the container's content width. */
  const steps = [700, 1150];
  for (const [width, expected] of [
    [320, 1],
    [699, 1],
    [700, 2],
    [1149, 2],
    [1150, 3],
    [2400, 3],
  ]) {
    if (columnsForWidth(width, steps) !== expected) {
      throw new Error(`${width}px gives ${columnsForWidth(width, steps)} columns, not ${expected}`);
    }
  }

  const work = read('src/components/windows/apps/ProjectsApp.tsx');
  if (!/const COLUMN_STEPS = \[700, 1150\] as const;/.test(work)) {
    throw new Error('the Work grid no longer offers 1 / 2 / 3 columns');
  }
  if (!/useColumnCount\(host, COLUMN_STEPS\)/.test(work) || !/packColumns\(projects, columns/.test(work)) {
    throw new Error('the Work grid does not pack projects into container-sized columns');
  }
  // One grid component, used for the filtered list — which is what All work, a
  // brand tab and an opened folder each are. A second renderer here is the bug.
  if ([...work.matchAll(/className="work__grid"/g)].length !== 1) {
    throw new Error('there is more than one project-card layout in ProjectsApp');
  }
  if (!/<ProjectGrid projects=\{projects\} onOpen=\{onOpen\} \/>/.test(work)) {
    throw new Error('the projects list is not rendered through the shared ProjectGrid');
  }
  // The window is WorkView fed the published portfolio; the Studio preview is WorkView fed a draft.
  if (!/<WorkView\s+portfolio=\{portfolio\}[\s\S]*?onOpen=\{openProject\}/.test(work)) {
    throw new Error('ProjectsApp no longer renders the shared WorkView');
  }
  // The folder view is this window with a payload, not a layout of its own.
  if (!/useState<string \| null>\(win\.payload\.folderId \?\? null\)/.test(work)) {
    throw new Error('an opened folder no longer reuses the Work window filter');
  }
  for (const file of ['src/components/mobile/MobileShell.tsx', 'src/hooks/useOpenTarget.ts']) {
    if (/work__grid|work__col/.test(read(file))) {
      throw new Error(`${file} draws its own project grid`);
    }
  }

  const css = read('src/components/windows/apps/work.css');
  if (/grid-template-columns|grid-column/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    throw new Error('the Work grid is a row-based CSS grid again');
  }
  // Equal columns, or the packing degenerates back into rows.
  if (!/flex: 1 1 0;/.test(rule(css, '.work__col'))) {
    throw new Error('.work__col columns are not equal width');
  }
  if (!/flex-direction: column;/.test(rule(css, '.work__col'))) {
    throw new Error('.work__col no longer stacks its cards');
  }

  /*
   * One implementation, shared. The media grid had this bug first and was fixed
   * in place; a second copy of the loop is how the two layouts drift apart.
   */
  const packers = ['src/components/media/MediaGallery.tsx', 'src/components/windows/apps/ProjectsApp.tsx']
    .filter((file) => /heights\[shortest\]/.test(read(file)));
  if (packers.length) {
    throw new Error(`the packing loop is duplicated in ${packers.join(', ')}`);
  }
  if (!/packColumns\(items, count/.test(read('src/components/media/MediaGallery.tsx'))) {
    throw new Error('the media masonry no longer uses the shared packing');
  }

  // Measured, not guessed from the screen: two windows side by side disagree.
  const hook = read('src/hooks/useColumnCount.ts');
  if (!/new ResizeObserver\(/.test(hook)) throw new Error('column count is not observed');
  const hookCode = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (/innerWidth/.test(hookCode)) throw new Error('column count reads the viewport again');

  return 'one packer: projects and media, 1/2/3 columns by container width';
});

/* ------------------------------------------------ 28. Studio media cards */

check('28. Studio media cards start collapsed, and that state is never content', () => {
  const list = read('src/studio/panels/MediaList.tsx');
  const panel = read('src/studio/panels/ProjectsPanel.tsx');
  const parts = read('src/studio/panels/parts.tsx');

  // Collapsed by default: the open set starts empty, and only an open card draws its editor.
  if (!/const folds = useFolds\(\);/.test(list) || !/useState<Set<K>>\(\(\) => new Set\(\)\)/.test(parts)) {
    throw new Error('media cards no longer start collapsed');
  }
  if (!/<Collapsible[\s\S]*?open=\{folds\.isOpen\(item\.id\)\}[\s\S]*?\{children\(item, patchAt\(index\)\)\}\s*<\/Collapsible>/.test(list) ||
      !/\{expanded && \(\s*<div className="studio-rep__body"/.test(parts)) {
    throw new Error('the editor is not gated on the card being open');
  }
  if (!/aria-expanded=\{expanded\}/.test(parts)) throw new Error('the card toggle has no aria-expanded');
  for (const label of ['> List', '> Grid']) {
    if (!list.includes(label)) throw new Error(`the "${label.replace('> ', '')}" control is missing`);
  }
  if (!/<FoldBar[\s\S]*?bulk=\{view === 'list'\}/.test(list) || !parts.includes('Expand all') || !parts.includes('Collapse all')) {
    throw new Error('the media list lost Expand all / Collapse all');
  }
  if (!/readStore<View>\(storageKeys\.studioMediaView, 'list'\)/.test(list)) {
    throw new Error('List is not the default view');
  }

  // The expanded card is still the full existing editor, and state resets per project.
  if (!/<MediaList\s+key=\{project\.id\}/.test(panel)) {
    throw new Error('MediaList is not keyed by project, so open cards would leak between projects');
  }
  if (!/<MediaFields item=\{item\} patch=\{patchMedia\} \/>/.test(panel)) {
    throw new Error('an expanded card no longer renders MediaFields');
  }

  // UI state stays out of the content model.
  const schema = read('src/types/content.ts');
  if (/expanded|collapsed|mediaView/i.test(schema)) {
    throw new Error('Studio UI state has leaked into the content schema');
  }
  return 'media cards: collapsed by default, per-item toggle, List/Grid preference outside content';
});

/* ------------------------------------- 29. project folds + draft preview */

check('29. project sections fold, and Preview draws the draft with the live renderers', () => {
  const panel = read('src/studio/panels/ProjectsPanel.tsx');
  const parts = read('src/studio/panels/parts.tsx');
  const preview = read('src/studio/panels/ProjectPreview.tsx');

  /* Sections: collapsible, collapsed by default, body only mounted while open. */
  if (!/const folds = useFolds<Fold>\(\);/.test(panel)) {
    throw new Error('project sections no longer start collapsed');
  }
  const folds = panel.match(/const FOLDS = \[([^\]]+)\] as const/)?.[1] ?? '';
  for (const id of ['identity', 'tile', 'case', 'media', 'banner', 'links', 'credits']) {
    if (!folds.includes(`'${id}'`)) throw new Error(`"${id}" is not a collapsible section`);
    if (!panel.includes(`{...fold('${id}')}`)) throw new Error(`the "${id}" section is not wired to its fold`);
  }
  if (!/<FoldBar folds=\{folds\} ids=\{FOLDS\}>/.test(panel) ||
      !/folds\.set\(ids\)\}>\s*Expand all[\s\S]*?folds\.set\(\[\]\)\}>\s*Collapse all/.test(parts)) {
    throw new Error('project-level Expand all / Collapse all are missing');
  }
  if (!/if \(onToggle\) \{\s*return \(\s*<Collapsible title=\{title\}[^>]*open=\{open\} onToggle=\{onToggle\}>/.test(parts) ||
      !/aria-expanded=\{expanded\}/.test(parts) || !/\{expanded && \(\s*<div className="studio-rep__body"/.test(parts)) {
    throw new Error('a folded Section is not a real toggle, or renders its body while closed');
  }

  /* Media: nested — the section folds, and the cards inside still fold on their own. */
  if (!/\{\.\.\.fold\('media'\)\}\s*>[\s\S]*?<MediaList\s+key=\{project\.id\}/.test(panel)) {
    throw new Error('the Media section no longer contains the independently collapsible MediaList');
  }

  /* Preview: the draft, the real renderers, mounted only while open. */
  if (!/\{previewing && \(\s*<ProjectPreview\s+draft=\{draft\}/.test(panel)) {
    throw new Error('Preview is not fed the Studio draft, or stays mounted while closed');
  }
  if (!/import \{ CaseStudyBody \} from '@\/components\/windows\/apps\/ProjectApp'/.test(preview) ||
      !/<CaseStudyBody project=\{shown\} \/>/.test(preview)) {
    throw new Error('Project preview does not reuse the live case-study renderer');
  }
  if (!/import \{ WorkView \} from '@\/components\/windows\/apps\/ProjectsApp'/.test(preview) ||
      !/<WorkView\s+portfolio=\{draft\}/.test(preview)) {
    throw new Error('Folder preview does not reuse the live Work view');
  }
  // No second layout: the preview must not draw case or grid markup of its own.
  if (/className="(case|work|tile|media-masonry)[_"]/.test(preview)) {
    throw new Error('the preview draws its own copy of a live layout');
  }
  // Isolated: no published state, no windows, no routing, no export.
  const code = preview.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (/usePortfolio|useOpenTarget|useOs|openWindow|location\.hash|studioDraft|download/.test(code)) {
    throw new Error('the preview reaches into published state, windows, the hash or export');
  }
  // The shared renderers themselves take data as props.
  const work = read('src/components/windows/apps/ProjectsApp.tsx');
  const workView = work.slice(work.indexOf('export function WorkView'));
  if (/usePortfolio|useOpenTarget/.test(workView.slice(0, workView.indexOf('function tileRatio')))) {
    throw new Error('WorkView reads global state, so it cannot render a draft');
  }
  const caseBody = read('src/components/windows/apps/ProjectApp.tsx');
  const body = caseBody.slice(caseBody.indexOf('export function CaseStudyBody'));
  if (/usePortfolio|useOpenTarget|useOs/.test(body)) {
    throw new Error('CaseStudyBody reads global state, so it cannot render a draft');
  }

  /* Widths: three container widths, a preference outside content. */
  for (const w of ['desktop', 'narrow', 'mobile']) {
    if (!preview.includes(`value: '${w}'`)) throw new Error(`the ${w} preview width is missing`);
    if (w !== 'desktop' && !rule(read('src/studio/studio.css'), `.studio-preview__stage[data-width='${w}']`)) {
      throw new Error(`the ${w} preview width has no container rule`);
    }
  }

  /* None of it is content. */
  const schema = read('src/types/content.ts');
  if (/sectionCollapsed|folds|previewMode|previewWidth|previewing/i.test(schema)) {
    throw new Error('Studio fold or preview state has leaked into the content schema');
  }
  return 'sections folded by default, nested media cards, preview = CaseStudyBody + WorkView on the draft';
});

/* ------------------------------------------- 30. thumbnail normalisation */

check('30. the project thumbnail is cleaned by the shared path helper', () => {
  const panel = read('src/studio/panels/ProjectsPanel.tsx');
  const schema = read('src/types/content.ts');

  // The Studio field is SourceField — the one that runs normalizeLocalPath on blur.
  if (!/<SourceField\s+label="Thumbnail"\s+value=\{project\.thumbnail\}/.test(panel)) {
    throw new Error('the Thumbnail field is not the shared SourceField');
  }
  if (/<Text\s+label="Thumbnail"/.test(panel)) {
    throw new Error('a plain text Thumbnail field is back, which skips path cleanup');
  }
  // No second implementation anywhere in the Studio or the schema.
  for (const file of ['src/studio/panels/ProjectsPanel.tsx', 'src/studio/panels/FoldersPanel.tsx', 'src/types/content.ts']) {
    if (/\.replace\([^)\n]*(\\\\|public)/.test(read(file))) {
      throw new Error(`${file} does its own path cleanup instead of using lib/paths`);
    }
  }
  if (!/thumbnail:\s*z[\s\S]{0,200}?localPathProblem\(value\)/.test(schema)) {
    throw new Error('the schema no longer checks a local thumbnail with localPathProblem');
  }

  // What "Copy as path" produces is what gets stored.
  const cases = [
    ['"E:\\asaad portifolio\\public\\media\\gaf\\Thumbnails\\steeve cover.jpg"', 'media/gaf/Thumbnails/steeve cover.jpg'],
    ['/public/media/gaf/thumb.png', 'media/gaf/thumb.png'],
    ['\\media\\gaf\\thumb.png', 'media/gaf/thumb.png'],
  ];
  for (const [input, want] of cases) {
    const { path } = normalizeLocalPath(input);
    if (path !== want) throw new Error(`${input} normalised to ${path}, not ${want}`);
  }
  if (!normalizeLocalPath('C:\\Users\\me\\Desktop\\thumb.jpg').error) {
    throw new Error('an absolute path outside public/ is accepted as a thumbnail');
  }
  if (!ProjectSchema.shape.thumbnail.safeParse('https://example.com/t.jpg').success ||
      ProjectSchema.shape.thumbnail.safeParse('C:/Users/me/thumb.jpg').success) {
    throw new Error('the thumbnail schema rejects a URL or accepts a machine path');
  }
  return 'thumbnail: SourceField → normalizeLocalPath; schema → localPathProblem';
});

/* --------------------------------------------------------- 31. folder intro */

check('31. the folder intro is optional, and old folders are untouched', () => {
  // Every folder in the live and the backup content parses as-is, with no keys added.
  for (const file of ['src/content/portfolio.json', 'backup/portfolio.TRUTH.json']) {
    let folders;
    try {
      folders = JSON.parse(read(file)).folders ?? [];
    } catch {
      continue; // the backup is optional
    }
    for (const folder of folders) {
      const parsed = FolderSchema.safeParse(folder);
      if (!parsed.success) throw new Error(`${file}: folder "${folder.id}" no longer validates`);
      // Key order is Zod's, not the file's, so compare with sorted keys.
      const sorted = (value) => JSON.stringify(value, (_, v) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
          : v);
      if (sorted(parsed.data) !== sorted(folder)) {
        throw new Error(`${file}: parsing folder "${folder.id}" changed it (a default leaked in)`);
      }
    }
  }
  const bare = FolderSchema.safeParse({ id: 'plain', name: 'Plain' });
  if (!bare.success || 'introTitle' in bare.data || 'description' in bare.data || 'banner' in bare.data) {
    throw new Error('a folder without an intro fails, or gains intro keys');
  }
  const full = FolderSchema.safeParse({
    id: 'gaf',
    name: 'GAF',
    introTitle: 'Gulf Advertising',
    description: 'Line one\nLine two',
    banner: { type: 'video', src: 'media/gaf/banner.mp4' },
  });
  if (!full.success) throw new Error('a folder with a full intro does not validate');
  if (FolderSchema.safeParse({ id: 'x', name: 'X', banner: { type: 'image', src: 'https://a.b/c.jpg' } }).success) {
    throw new Error('a folder banner accepts a URL; it must be local like a project banner');
  }

  // Studio: a collapsible section in the folder editor, sharing the banner editor.
  const panel = read('src/studio/panels/FoldersPanel.tsx');
  if (!/<Section\s+title="Folder intro"[\s\S]*?open=\{open\}[\s\S]*?onToggle=/.test(panel)) {
    throw new Error('the folder editor has no collapsible "Folder intro" section');
  }
  if (!/<BannerSource banner=\{folder\.banner\}/.test(panel)) {
    throw new Error('the folder banner is not edited with the shared BannerSource');
  }
  const source = read('src/studio/panels/SourceField.tsx');
  if (!/export function BannerSource[\s\S]*?<SourceField\s+localOnly/.test(source)) {
    throw new Error('BannerSource no longer uses the local-only SourceField');
  }
  if (!/<BannerSource banner=\{banner\}/.test(read('src/studio/panels/ProjectsPanel.tsx'))) {
    throw new Error('the project banner no longer shares BannerSource with folders');
  }
  return 'introTitle / description / banner optional; every existing folder round-trips unchanged';
});

check('32. the folder intro renders before the masonry, with the project banner', () => {
  const work = read('src/components/windows/apps/ProjectsApp.tsx');
  const view = work.slice(work.indexOf('export function WorkView'), work.indexOf('function hasIntro'));

  // Order inside the scroller: intro, then the one grid.
  const scroll = view.slice(view.indexOf('<div className="work__scroll">'));
  const intro = scroll.indexOf('{intro && <FolderIntro');
  const grid = scroll.indexOf('<ProjectGrid');
  if (intro < 0 || grid < 0 || intro > grid) throw new Error('the folder intro is not rendered before the masonry');
  if (!/const intro = open && hasIntro\(open\) \? open : undefined/.test(view)) {
    throw new Error('the intro is not skipped for a folder with no intro fields');
  }

  const fn = work.slice(work.indexOf('function FolderIntro'), work.indexOf('function tileRatio'));
  // Banner → title → description, in the case study's own classes.
  const order = ['<ProjectBanner banner={folder.banner} />', '<h1 className="case__title">', 'className="case__intro"'];
  let at = -1;
  for (const piece of order) {
    const next = fn.indexOf(piece);
    if (next < 0 || next < at) throw new Error(`the folder intro is missing or misorders ${piece}`);
    at = next;
  }
  if (!/folder\.introTitle\?\.trim\(\) \|\| folder\.name/.test(fn)) {
    throw new Error('the intro title does not fall back to the folder name');
  }
  // The banner is the project banner: local image/video, silent looping video, cover.
  if (!/import \{ ProjectBanner \} from '\.\/ProjectBanner'/.test(work)) {
    throw new Error('the folder banner is not the shared ProjectBanner');
  }
  const banner = read('src/components/windows/apps/ProjectBanner.tsx');
  for (const attr of ['autoPlay', 'muted', 'loop', 'playsInline']) {
    if (!banner.includes(attr)) throw new Error(`the shared banner video lost ${attr}`);
  }
  if (/\bcontrols\b(?!\s*=\s*\{false\})/.test(banner.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
    throw new Error('the shared banner video shows controls');
  }
  if (!/import '\.\/apps\.css'/.test(work)) {
    throw new Error('the Work view does not load the banner and header styles it borrows');
  }
  const css = read('src/components/windows/apps/work.css');
  // A hairline divider, with room above it, separates the intro from the cards.
  const divider = rule(css, '.work__intro::after');
  if (!/background:\s*var\(--c-hairline\)/.test(divider) || !/margin:\s*var\(--s-8\)/.test(divider)) {
    throw new Error('the folder intro has no spaced hairline divider before the cards');
  }
  // The description is secondary, and styled only inside the folder intro.
  if (!/color:\s*var\(--c-mute\)/.test(rule(css, '.work__intro .case__intro'))) {
    throw new Error('the folder description is no longer muted');
  }
  if (!/font-size:\s*var\(--fs-lg\)/.test(rule(read('src/components/windows/apps/apps.css'), '.case__intro'))) {
    throw new Error('the project-page intro typography changed');
  }
  // Still one masonry.
  if ((work.match(/className="work__grid"/g) ?? []).length !== 1) {
    throw new Error('the folder intro introduced a second grid');
  }
  return 'banner → title → description → masonry; ProjectBanner + case__title reused';
});

/* --------------------------------------------------- 33. bannerless inset */

check('33. a project without a banner gets a top inset, and only then', () => {
  const app = read('src/components/windows/apps/ProjectApp.tsx');
  if (!/data-bannerless=\{banner \? undefined : true\}/.test(app)) {
    throw new Error('the case study no longer marks a bannerless project');
  }
  const css = read('src/components/windows/apps/apps.css');
  const desktop = rule(css, '.case[data-bannerless]');
  if (!/padding-top:\s*var\(--s-8\)/.test(desktop)) {
    throw new Error('a bannerless project has no ~32px top inset');
  }
  const narrow = css.slice(css.indexOf('@media (max-width: 640px)'));
  if (!/\.case\[data-bannerless\]\s*\{\s*padding-top:\s*var\(--s-5\)/.test(narrow)) {
    throw new Error('a bannerless project has no ~20px narrow top inset');
  }
  // With a banner: nothing added above or below it.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/padding-top/.test(rule(css, '.case')) || /\.case\[data-banner\]|\.case:has\(\s*\.case__banner/.test(clean)) {
    throw new Error('a project with a banner also gets the top inset');
  }
  if (!/margin:\s*0 0 var\(--s-8\)/.test(rule(css, '.case__banner'))) {
    throw new Error('the banner\'s own spacing changed');
  }
  return 'bannerless: 32px desktop / 20px narrow; banner projects unchanged';
});

/* ------------------------------------------------------- 34. maximise */

check('34. a maximised window reaches the bottom, under the dock, and scrolls clear of it', () => {
  const win = read('src/components/windows/Window.tsx');
  const os = read('src/state/os.ts');

  // Geometry: from under the menu bar to the viewport's bottom edge.
  if (!/if \(!win\.maximized\) return;[\s\S]{0,200}?height: viewport\.height - top \}/.test(win)) {
    throw new Error('Window.tsx no longer sizes a maximised window to the bottom edge');
  }
  const toggleAt = os.indexOf('toggleMaximize: (id, viewport) =>');
  const toggle = os.slice(toggleAt, os.indexOf('setBox:', toggleAt));
  if (!/y: topSafeArea\(\)/.test(toggle) || !/height: viewport\.height - topSafeArea\(\),/.test(toggle)) {
    throw new Error('toggleMaximize no longer starts under the menu bar and ends at the bottom edge');
  }
  // Restore is untouched: the saved box comes back verbatim.
  if (!/if \(w\.maximized && w\.restore\) \{\s*return \{ \.\.\.w, \.\.\.w\.restore, maximized: false, restore: undefined, z \};/.test(toggle) ||
      !/restore: \{ x: w\.x, y: w\.y, width: w\.width, height: w\.height \}/.test(toggle)) {
    throw new Error('restoring a maximised window no longer returns its saved box');
  }
  // Tidy is not maximise and keeps its dock gap.
  if (!/tidy[\s\S]*?- 84/.test(os)) throw new Error('tidy lost its dock gap');

  // Stacking: the dock sits above every window and below Focus Mode.
  const tokens = read('src/styles/tokens.css');
  const z = (name) => Number(new RegExp(`--z-${name}:\\s*(\\d+)`).exec(tokens)?.[1]);
  if (!(z('dock') > z('windows') && z('dock') < z('focus'))) {
    throw new Error('the dock is not between the windows and Focus Mode on the z scale');
  }
  if (!/z-index:\s*var\(--z-dock\)/.test(rule(read('src/components/os/chrome.css'), '.dock'))) {
    throw new Error('the dock no longer uses --z-dock');
  }

  // Clearance: tied to the dock height, maximised only.
  if (!/className=\{cx\([\s\S]*?win\.maximized && 'window--maximized'/.test(win)) {
    throw new Error('a maximised window is not marked for its clearance rule');
  }
  const css = read('src/components/windows/window.css');
  if (!/--window-clear:\s*calc\(var\(--dock-h\)/.test(rule(css, '.window--maximized'))) {
    throw new Error('the scroll clearance is not derived from --dock-h');
  }
  if (!/height:\s*var\(--window-clear\)/.test(rule(css, '.window--maximized .window__body::after'))) {
    throw new Error('the window body has no bottom spacer when maximised');
  }
  if (/--window-clear|::after/.test(rule(css, '.window__body'))) {
    throw new Error('restored windows picked up the maximised clearance');
  }
  const work = read('src/components/windows/apps/work.css');
  if (!/height:\s*var\(--window-clear\)/.test(rule(work, '.window--maximized .work__scroll::after'))) {
    throw new Error('the Work scroller has no bottom spacer when maximised');
  }
  return 'maximised: menubar → bottom edge; dock overlays; spacer = --dock-h + 16px';
});

/* ------------------------------------------- 35. media drag to reorder */

check('35. Studio media reorders by a grip, in List and Grid, through one move', () => {
  const list = read('src/studio/panels/MediaList.tsx');

  // A drop is one move from any index to any slot, not repeated single steps.
  const ids = Array.from({ length: 10 }, (_, i) => `m${i + 1}`);
  const drop = (from, slot) => moveItem(ids, from, slotIndex(from, slot)).join(',');
  const cases = [
    [9, 1, 'm1,m10,m2,m3,m4,m5,m6,m7,m8,m9'], // #10 between #01 and #02
    [9, 0, 'm10,m1,m2,m3,m4,m5,m6,m7,m8,m9'], // to the start
    [0, 10, 'm2,m3,m4,m5,m6,m7,m8,m9,m10,m1'], // to the end
    [1, 5, 'm1,m3,m4,m5,m2,m6,m7,m8,m9,m10'], // forward, before #06
  ];
  for (const [from, slot, want] of cases) {
    const got = drop(from, slot);
    if (got !== want) throw new Error(`drop ${from} → slot ${slot} gave ${got}, want ${want}`);
  }
  if (drop(4, 4) !== ids.join(',') || drop(4, 5) !== ids.join(',')) {
    throw new Error('dropping an item beside itself moved it');
  }

  // One grip, rendered in both views; the cards themselves are not draggable.
  if (!/aria-label="Drag to reorder media"/.test(list) || !/title="Drag to reorder media"/.test(list)) {
    throw new Error('the drag grip lost its label');
  }
  if (!/lead=\{grip\(index\)\}/.test(list) ||
      !/studio-media-card__head">\s*\{lead\}/.test(read('src/studio/panels/parts.tsx'))) {
    throw new Error('List rows have no drag grip');
  }
  if (!/studio-media-tile__tools">\s*\{grip\(index\)\}/.test(list)) {
    throw new Error('Grid tiles have no drag grip');
  }
  if ((list.match(/\bdraggable\b/g) ?? []).length !== 1) {
    throw new Error('something other than the grip is draggable');
  }

  // Arrows and drops share the one reorder over the same `items` array.
  if (!/label="Move up"[\s\S]{0,80}?move\(index, index - 1\)/.test(list) ||
      !/label="Move down"[\s\S]{0,120}?move\(index, index \+ 1\)/.test(list)) {
    throw new Error('the arrow controls no longer use the shared move');
  }
  if (!/move\(dragFrom, slotIndex\(dragFrom,/.test(list)) throw new Error('a drop bypasses the shared move');
  if ((list.match(/moveItem\(/g) ?? []).length !== 1) {
    throw new Error('MediaList reorders the array in more than one place');
  }

  // Drag state is Studio state only.
  const schema = read('src/types/content.ts');
  if (/dragIndex|dragFrom|dropTarget|sortOrder|dragging/i.test(schema)) {
    throw new Error('drag state has leaked into the content schema');
  }
  return 'media drag: grip-only, List + Grid, #10 → #02 in one move, arrows share the move';
});

check('36. the visitor-facing OS uses only the Heading and Body faces', () => {
  // `.mono` is the shared label class behind every stray code-face label.
  const global = read('src/styles/global.css');
  const mono = global.match(/\n\.mono \{[^}]*\}/)?.[0] ?? '';
  if (!/font-family: var\(--font-body\)/.test(mono)) {
    throw new Error('.mono is no longer set in the BODY role');
  }
  const visitor = [
    'src/styles/global.css',
    'src/components/ui/ui.css',
    'src/components/ui/poster.css',
    'src/components/quick-view/quick-view.css',
    'src/components/windows/apps/apps.css',
    'src/components/windows/apps/work.css',
    'src/components/windows/window.css',
    'src/components/media/media.css',
    'src/components/os/chrome.css',
  ];
  for (const file of visitor) {
    if (/font-family:\s*var\(--font-mono\)/.test(read(file))) {
      throw new Error(`${file} still sets the mono face`);
    }
  }
  // The Studio keeps mono on purpose, but its draft preview must match the site.
  const studio = read('src/studio/studio.css');
  if (!/\.studio \.mono,[\s\S]{0,60}?font-family: var\(--font-mono\)/.test(studio)) {
    throw new Error('the Studio lost its scoped mono');
  }
  if (!/\.studio-preview__stage \.mono \{[^}]*--font-body/.test(studio)) {
    throw new Error('the Studio preview would draw labels in mono');
  }
  return 'visitor .mono → Body; no --font-mono outside the Studio; preview matches the site';
});

check('37. app content does not repeat the window title', () => {
  const registry = read('src/components/windows/registry.tsx');
  const labels = [...registry.matchAll(/label: '([^']+)'/g)].map((m) => m[1].toLowerCase());
  const repeats = new Set([...labels, 'curriculum vitae']);
  const apps = ['AboutApp', 'ContactApp', 'CvApp', 'ExperienceApp', 'SkillsApp', 'NoteApp', 'ProjectsApp'];
  for (const app of apps) {
    const source = read(`src/components/windows/apps/${app}.tsx`);
    for (const [, text] of source.matchAll(/<Meta>([^<{]+)<\/Meta>/g)) {
      if (repeats.has(text.trim().toLowerCase())) {
        throw new Error(`${app} repeats its window title as "${text.trim()}"`);
      }
    }
  }
  // Meaningful headings stay: CV sections, project footer labels, skill groups.
  if (!/cv__heading">\{section\.heading\}/.test(read('src/components/windows/apps/CvApp.tsx'))) {
    throw new Error('CV section headings are gone');
  }
  const project = read('src/components/windows/apps/ProjectApp.tsx');
  for (const label of ['What I did', 'Tools', 'Tags', 'Credits']) {
    if (!project.includes(`<Meta>${label}</Meta>`)) throw new Error(`project label "${label}" is gone`);
  }
  if (!/skill-group__title">\{group\.title\}/.test(read('src/components/windows/apps/SkillsApp.tsx'))) {
    throw new Error('skill group headings are gone');
  }
  return 'no app eyebrow equals a registry label; section headings kept';
});

check('38. a text file opens straight onto its text', () => {
  const note = read('src/components/windows/apps/NoteApp.tsx');
  if (/note__head|lines<|split\('\\n'\)\.length|\{note\.title\}/.test(note)) {
    throw new Error('the note still renders a filename header or a line count');
  }
  if (!/<pre className="note__body">\{note\.body\}<\/pre>/.test(note)) {
    throw new Error('the note body is no longer rendered as written');
  }
  const css = read('src/components/windows/apps/apps.css');
  const body = css.match(/\n\.note__body \{[^}]*\}/)?.[0] ?? '';
  if (!/var\(--font-body\)/.test(body) || !/white-space: pre-wrap/.test(body)) {
    throw new Error('the note body lost the Body face or its line breaks');
  }
  return 'no filename header, no line count, Body face, pre-wrap kept';
});

check('39. an empty folder shows nothing, and Quick View says Check project', () => {
  const work = read('src/components/windows/apps/ProjectsApp.tsx');
  if (/Nothing here yet|Portfolio Studio|portfolio\.json|<Empty/.test(work)) {
    throw new Error('the Work window still has developer copy for an empty folder');
  }
  if (!/projects\.length > 0 && <ProjectGrid/.test(work)) {
    throw new Error('the grid is no longer gated on having projects');
  }
  const qv = read('src/components/quick-view/QuickView.tsx');
  if (!/Check project <ArrowUpRight/.test(qv) || /Read case study/i.test(qv)) {
    throw new Error('the Quick View project CTA is not "Check project"');
  }
  return 'empty folder: intro only; Quick View CTA reads Check project';
});

check('40. Studio folder cards start collapsed, and that state is never content', () => {
  const panel = read('src/studio/panels/FoldersPanel.tsx');
  if (!/const folds = useFolds\(\);/.test(panel)) {
    throw new Error('folder cards do not start collapsed');
  }
  if (!/fold=\{\{ folds, id: \(folder\) => folder\.id \}\}/.test(panel)) {
    throw new Error('folder open state is not keyed by folder id');
  }
  if (!/<FoldBar\s+folds=\{folds\}\s+ids=\{draft\.folders\.map\(\(folder\) => folder\.id\)\}/.test(panel)) {
    throw new Error('Expand all / Collapse all are missing');
  }
  for (const field of ['label="Name"', 'label="Caption"', 'label="Discipline"', 'label="Order"',
    '<IconFields', '<FolderIntroFields', '<Advanced', '<IdField']) {
    if (!panel.includes(field)) throw new Error(`the folder editor lost ${field}`);
  }
  const parts = read('src/studio/panels/parts.tsx');
  if (!/\{expanded && \(\s*<div className="studio-rep__body"/.test(parts)) {
    throw new Error('the Repeater body is not gated on the fold');
  }
  if (!/fold \? \(\s*<Collapsible[\s\S]*?\) : \(\s*<section className="studio-rep__item"[\s\S]*?<div className="studio-rep__body">\{children\(item, patchAt\(index\), index\)\}<\/div>/.test(parts)) {
    throw new Error('lists without a fold are no longer always open');
  }
  const schema = read('src/types/content.ts');
  if (/expanded|collapsed|isOpen/i.test(schema)) {
    throw new Error('folder accordion state has leaked into the content schema');
  }
  return 'folders: collapsed by default, keyed by id, Expand/Collapse all, editor intact, UI-only';
});

check('41. every Studio collapse draws through one shared primitive, and stays UI-only', () => {
  const parts = read('src/studio/panels/parts.tsx');

  // One primitive, one open-state hook, one bulk bar.
  for (const name of ['export function Collapsible(', 'export function useFolds<', 'export function FoldBar<']) {
    if (!parts.includes(name)) throw new Error(`parts.tsx no longer exports ${name.replace(/^export function |[(<]$/g, '')}`);
  }
  if (!/useState<Set<K>>\(\(\) => new Set\(\)\)/.test(parts)) throw new Error('useFolds does not start collapsed');
  if (!/defaultOpen = false/.test(parts)) throw new Error('an uncontrolled Collapsible does not start collapsed');

  // Grip and actions sit beside the toggle button, never inside it, so they cannot toggle.
  const card = parts.slice(parts.indexOf('export function Collapsible('), parts.indexOf('export function Section('));
  const button = card.match(/<button[\s\S]*?<\/button>/)?.[0] ?? '';
  if (!/aria-controls=\{bodyId\}/.test(button)) throw new Error('the card head is not a real disclosure button');
  if (/\{actions\}|\{lead\}/.test(button)) throw new Error('an action or the grip sits inside the toggle button');
  if (!/\{lead\}\s*<button[\s\S]*?<\/button>\s*<div className="studio-rep__tools">\s*\{actions\}/.test(card)) {
    throw new Error('actions are no longer siblings of the toggle');
  }

  // Competing implementations are gone: nothing else in the Studio draws a disclosure.
  const panels = ['ProjectsPanel', 'MediaList', 'FoldersPanel', 'ExperiencePanel', 'SkillsPanel',
    'ProfilePanel', 'AppearancePanel', 'DesktopPanel', 'MediaFields', 'ExportPanel'];
  for (const name of panels) {
    const src = read(`src/studio/panels/${name}.tsx`);
    if (/aria-expanded|useState<Set</.test(src)) throw new Error(`${name} keeps its own collapse state or toggle`);
  }

  // Collections: each card list folds by stable id and has its own Expand/Collapse all.
  const lists = {
    FoldersPanel: /fold=\{\{ folds, id: \(folder\) => folder\.id \}\}/,
    ExperiencePanel: /fold=\{\{ folds, id: \(item\) => item\.id \}\}/,
    SkillsPanel: /fold=\{\{ folds, id: \(group\) => group\.id \}\}/,
    MediaList: /<Collapsible[\s\S]*?open=\{folds\.isOpen\(item\.id\)\}/,
  };
  for (const [name, wired] of Object.entries(lists)) {
    const src = read(`src/studio/panels/${name}.tsx`);
    if (!wired.test(src)) throw new Error(`${name} items do not fold through the shared primitive`);
    if (!/const folds = useFolds\(\);/.test(src) || !/<FoldBar/.test(src)) {
      throw new Error(`${name} has no own Expand all / Collapse all`);
    }
  }

  // Tabs of sections: every section folds, and the tab has its own Expand/Collapse all.
  for (const name of ['ProfilePanel', 'AppearancePanel', 'DesktopPanel']) {
    const src = read(`src/studio/panels/${name}.tsx`);
    const ids = src.match(/const FOLDS = \[([^\]]+)\] as const/)?.[1]?.match(/'[^']+'/g) ?? [];
    const sections = (src.match(/<Section\b/g) ?? []).length;
    if (!ids.length || ids.length !== sections) throw new Error(`${name}: ${sections} sections but ${ids.length} folds`);
    for (const id of ids) {
      if (!src.includes(`{...folds.props(${id}, summary.${id.slice(1, -1)})}`)) {
        throw new Error(`${name}: the ${id} section is not folded`);
      }
    }
    if (!/const folds = useFolds<Fold>\(\);/.test(src) || !/<FoldBar folds=\{folds\} ids=\{FOLDS\} \/>/.test(src)) {
      throw new Error(`${name} has no tab-level Expand all / Collapse all`);
    }
  }
  const projects = read('src/studio/panels/ProjectsPanel.tsx');
  if (!/const fold = \(id: Fold\) => folds\.props\(id, summaries\?\.\[id\]\);/.test(projects)) {
    throw new Error('the project editor sections no longer fold through useFolds');
  }

  // UI state only: not in the schema, the draft store or the export.
  if (/\bfolds\b|useFolds|isOpen|defaultOpen/.test(read('src/types/content.ts'))) {
    throw new Error('fold state has leaked into the content schema');
  }
  for (const file of ['src/studio/useDraft.ts', 'src/studio/panels/ExportPanel.tsx', 'src/lib/storage.ts']) {
    if (/useFolds|\bfolds\b/.test(read(file))) throw new Error(`${file} touches fold state`);
  }
  return 'Collapsible + useFolds + FoldBar in parts.tsx; 8 editors migrated, actions outside the toggle, UI-only';
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
