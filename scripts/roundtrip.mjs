/**
 * Content round-trip regression.
 *
 * This exists because the Studio once wrote an old draft over `portfolio.json`
 * and real content was lost. The fix (version-aware draft envelopes) was
 * verified by hand in session 7; leaving it verified by hand meant every later
 * schema change re-opened the question. So the checks are committed here, in a
 * plain Node script with no test runner to install:
 *
 *   node scripts/roundtrip.mjs
 *
 * Four properties, each of which failing means content can be silently damaged:
 *
 *   1. **The live content validates.** Nothing else means anything if it does
 *      not, and a schema change that rejects the real portfolio is the loudest
 *      possible bug.
 *   2. **A no-edit round trip drops nothing.** Parse → export, and compare
 *      against the file. Additions are tolerated and listed (Zod materializing
 *      a `.default()` is legitimate); a *dropped* or *changed* field is a
 *      failure. This is the check that would have caught the data loss.
 *   3. **The export is a fixed point.** Re-import what was exported and it must
 *      come out identical — otherwise repeated Studio sessions drift.
 *   4. **A single-field edit produces exactly one difference.** The guarantee
 *      that saving one change does not quietly rewrite ten other things.
 *
 * The schema is TypeScript, so it is type-checked and bundled on the fly with
 * esbuild (already present as a Vite dependency) rather than duplicated here —
 * a second copy of the rules would be a second thing to get out of sync.
 */
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(root, 'src/content/portfolio.json');

/* ------------------------------------------------------------- utilities */

/** Every leaf path in an object, as dotted strings. */
function paths(value, prefix = '', out = new Map()) {
  if (value === null || typeof value !== 'object') {
    out.set(prefix, value);
    return out;
  }
  if (Array.isArray(value)) {
    if (!value.length) out.set(prefix, '[]');
    value.forEach((item, i) => paths(item, `${prefix}[${i}]`, out));
    return out;
  }
  const keys = Object.keys(value);
  if (!keys.length) out.set(prefix, '{}');
  for (const key of keys) paths(value[key], prefix ? `${prefix}.${key}` : key, out);
  return out;
}

/** Sorted-key JSON, so key order is never mistaken for a content difference. */
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
    .join(',')}}`;
}

function diff(before, after) {
  const a = paths(before);
  const b = paths(after);
  const dropped = [];
  const changed = [];
  const added = [];
  for (const [key, value] of a) {
    if (!b.has(key)) dropped.push(key);
    else if (stable(b.get(key)) !== stable(value)) changed.push(`${key}: ${stable(value)} → ${stable(b.get(key))}`);
  }
  for (const key of b.keys()) if (!a.has(key)) added.push(key);
  return { dropped, changed, added };
}

/* ------------------------------------------------ load the real validator */

const outdir = mkdtempSync(join(tmpdir(), 'asaad-roundtrip-'));
const bundle = join(outdir, 'schema.mjs');

await build({
  entryPoints: [join(root, 'src/types/content.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'silent',
  // `@/...` is a Vite alias; esbuild needs to be told about it separately.
  alias: { '@': join(root, 'src') },
});

const { validatePortfolio } = await import(pathToFileURL(bundle).href);

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

const source = JSON.parse(readFileSync(CONTENT, 'utf8'));

console.log('\nContent round-trip regression\n');

let parsed;

check('1. src/content/portfolio.json validates', () => {
  const result = validatePortfolio(source);
  if (!result.ok) {
    throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n        '));
  }
  parsed = result.data;
  return `${parsed.projects.length} projects, ${parsed.projects.reduce((n, p) => n + p.media.length, 0)} media items`;
});

check('2. no-edit round trip drops nothing', () => {
  const { dropped, changed, added } = diff(source, parsed);
  if (dropped.length) throw new Error(`dropped ${dropped.length}: ${dropped.slice(0, 8).join(', ')}`);
  if (changed.length) throw new Error(`changed ${changed.length}: ${changed.slice(0, 8).join('; ')}`);
  return added.length
    ? `${added.length} additive defaults materialized (expected): ${added.slice(0, 4).join(', ')}…`
    : 'byte-identical';
});

check('3. the export is a fixed point under re-import', () => {
  const again = validatePortfolio(JSON.parse(JSON.stringify(parsed)));
  if (!again.ok) throw new Error('re-import rejected its own export');
  if (stable(again.data) !== stable(parsed)) {
    const { dropped, changed, added } = diff(parsed, again.data);
    throw new Error(`drifted — dropped ${dropped.length}, changed ${changed.length}, added ${added.length}`);
  }
  return 'stable';
});

check('4. a single-field edit changes exactly one field', () => {
  const edited = JSON.parse(JSON.stringify(parsed));
  edited.projects[0].title = `${edited.projects[0].title} (edited)`;
  const result = validatePortfolio(edited);
  if (!result.ok) throw new Error('edited content failed validation');
  const { dropped, changed, added } = diff(parsed, result.data);
  if (dropped.length || added.length) throw new Error(`side effects: ${dropped.length} dropped, ${added.length} added`);
  if (changed.length !== 1) throw new Error(`${changed.length} fields changed, expected 1: ${changed.join('; ')}`);
  return changed[0];
});

check('5. demo: true cannot rescue an item with no source', () => {
  const broken = JSON.parse(JSON.stringify(parsed));
  broken.projects[0].media = [{ id: 'x', type: 'video', demo: true }];
  broken.projects[0].heroMediaId = undefined;
  const result = validatePortfolio(broken);
  if (result.ok) throw new Error('an empty video item was accepted because it was marked demo');
  return result.issues[0].message;
});

check('6. a hero pointing at deleted media is reported, not ignored', () => {
  const broken = JSON.parse(JSON.stringify(parsed));
  broken.projects[0].heroMediaId = 'no-such-media';
  const result = validatePortfolio(broken);
  if (result.ok) throw new Error('a dangling heroMediaId was accepted');
  return result.issues.find((i) => i.path.includes('heroMediaId'))?.message ?? result.issues[0].message;
});

check('7. content without any of the new fields still validates', () => {
  const legacy = JSON.parse(JSON.stringify(source));
  for (const project of legacy.projects) {
    delete project.heroMediaId;
    delete project.showHeroInMedia;
    delete project.quickViewOrder;
  }
  for (const media of legacy.projects.flatMap((project) => project.media ?? [])) {
    delete media.title;
    delete media.tools;
    delete media.date;
    delete media.presentation;
  }
  delete legacy.settings?.typography;
  delete legacy.settings?.mobileHome;
  // Weather arrived with its two coordinates; content from before it has neither.
  legacy.desktop.widgets = legacy.desktop.widgets.filter((widget) => widget.type !== 'weather');
  for (const widget of legacy.desktop.widgets) {
    delete widget.latitude;
    delete widget.longitude;
  }
  const result = validatePortfolio(legacy);
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('; '));

  // The other half of backward compatibility: the new fields are accepted, and
  // the OLD two-font typography shape still is too. Nothing needs migrating.
  const modern = JSON.parse(JSON.stringify(source));
  const first = modern.projects.find((project) => project.media?.length)?.media[0];
  if (first) {
    first.title = 'French Toast — Behind the Scenes';
    // Per-item tools: free text, and nothing like the project's array of chips.
    first.tools = 'Adobe Premiere Pro, Adobe After Effects';
    // Per-item date: free text too — "Summer 2025" is a real answer.
    first.date = 'March 2026';
  }
  // Stacked / Slideshow on a gallery or website with two or more images.
  const multi = modern.projects
    .flatMap((project) => project.media ?? [])
    .find((media) => (media.items?.length ?? 0) >= 2 || (media.screenshots?.length ?? 0) >= 2);
  if (multi) multi.presentation = { mode: 'slideshow', autoplay: true, interval: 2000 };
  // Curated Quick View position, independent of folder order.
  modern.projects[0].quickViewOrder = 1;
  modern.settings.typography = {
    // The shared face, then two roles that override it with their own and one
    // that does not — the pairing this system exists to allow.
    font: { family: 'Asaad', file: 'fonts/asaad-font.woff2' },
    display: {
      font: { family: 'Asaad Display', file: 'fonts/asaad-display.woff2' },
      size: 40,
      weight: 600,
      tracking: -0.03,
      leading: 1.05,
    },
    heading: { font: { family: 'Georgia' }, size: 21, weight: 500, tracking: -0.011, leading: 1.2 },
    body: { size: 15, weight: 400, tracking: 0, leading: 1.5 },
    scale: 100,
    // The previous system, side by side with the new one.
    secondary: { family: 'Lato', file: 'Fonts/Lato-Light.ttf' },
  };
  const forwards = validatePortfolio(modern);
  if (!forwards.ok) {
    throw new Error(forwards.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
  }
  return 'backward compatible both ways';
});

check('8. an absent quickViewOrder stays absent through a round trip', () => {
  // Additions are tolerated by check 2; this one must never appear on its own.
  const authored = source.projects.filter((p) => 'quickViewOrder' in p).length;
  const exported = JSON.parse(JSON.stringify(parsed)).projects.filter((p) => 'quickViewOrder' in p).length;
  if (exported !== authored) throw new Error(`${exported} projects export quickViewOrder, ${authored} authored it`);
  return `${authored} authored, ${exported} exported`;
});

check('9. an absent media presentation stays absent through a round trip', () => {
  const count = (data) =>
    data.projects.flatMap((p) => p.media ?? []).filter((m) => 'presentation' in m).length;
  const authored = count(source);
  const exported = count(JSON.parse(JSON.stringify(parsed)));
  if (exported !== authored) throw new Error(`${exported} media export presentation, ${authored} authored it`);
  return `${authored} authored, ${exported} exported`;
});

check('10. an absent settings.mobileHome stays absent through a round trip', () => {
  const authored = 'mobileHome' in source.settings;
  const exported = 'mobileHome' in JSON.parse(JSON.stringify(parsed)).settings;
  if (exported !== authored) throw new Error(`mobileHome authored: ${authored}, exported: ${exported}`);
  return authored ? 'authored and kept' : 'absent and still absent';
});

check('11. mobile home widgets must name a real desktop widget, once', () => {
  const ids = source.desktop?.widgets?.map((w) => w.id) ?? [];
  const valid = JSON.parse(JSON.stringify(source));
  valid.settings.mobileHome = {
    phoneColumns: 3,
    tabletColumns: 5,
    widgets: ids.slice(0, 2).map((widgetId, i) => ({ widgetId, area: i ? 'afterApps' : 'top' })),
  };
  const ok = validatePortfolio(valid);
  if (!ok.ok) throw new Error(ok.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
  if (stable(ok.data.settings.mobileHome) !== stable(valid.settings.mobileHome)) {
    throw new Error('a configured mobileHome did not survive validation unchanged');
  }

  const missing = JSON.parse(JSON.stringify(source));
  missing.settings.mobileHome = { widgets: [{ widgetId: 'no-such-widget' }] };
  const bad = validatePortfolio(missing);
  if (bad.ok) throw new Error('a mobile widget pointing at nothing was accepted');
  const issue = bad.issues.find((i) => i.path === 'settings.mobileHome.widgets.0.widgetId');
  if (!issue) throw new Error(`reported at the wrong path: ${bad.issues.map((i) => i.path).join(', ')}`);

  if (ids.length) {
    const twice = JSON.parse(JSON.stringify(source));
    twice.settings.mobileHome = { widgets: [{ widgetId: ids[0] }, { widgetId: ids[0] }] };
    if (validatePortfolio(twice).ok) throw new Error('the same widget was accepted twice');
  }

  // Widgets used to carry a half / full `span`. There is no size now — every
  // mobile widget is square — and an old draft that still has one is not an
  // error: the key is dropped, the rest of the entry kept.
  if (ids.length) {
    const sized = JSON.parse(JSON.stringify(source));
    sized.settings.mobileHome = { widgets: [{ widgetId: ids[0], span: 'half' }] };
    const dropped = validatePortfolio(sized);
    if (!dropped.ok) throw new Error('an old `span` on a mobile widget is now an error');
    if (stable(dropped.data.settings.mobileHome) !== stable({ widgets: [{ widgetId: ids[0] }] })) {
      throw new Error('an old `span` survived validation');
    }
  }
  return issue.message;
});

check('12. a weather widget needs an authored place', () => {
  const weather = source.desktop?.widgets?.filter((w) => w.type === 'weather') ?? [];
  for (const w of weather) {
    if (typeof w.latitude !== 'number' || typeof w.longitude !== 'number') {
      throw new Error(`${w.id} has no coordinates`);
    }
  }

  const unplaced = JSON.parse(JSON.stringify(source));
  unplaced.desktop.widgets.push({ id: 'w-nowhere', type: 'weather', title: 'Nowhere', zone: 'any' });
  const bad = validatePortfolio(unplaced);
  if (bad.ok) throw new Error('a weather widget without coordinates was accepted');
  const at = `desktop.widgets.${unplaced.desktop.widgets.length - 1}.latitude`;
  const issue = bad.issues.find((i) => i.path === at);
  if (!issue) throw new Error(`reported at the wrong path: ${bad.issues.map((i) => i.path).join(', ')}`);

  const far = JSON.parse(JSON.stringify(source));
  far.desktop.widgets.push({ id: 'w-far', type: 'weather', latitude: 120, longitude: 0, zone: 'any' });
  if (validatePortfolio(far).ok) throw new Error('a latitude of 120 was accepted');

  // The phone's top row, as authored: the clock first, then the weather.
  const order = (source.settings.mobileHome?.widgets ?? []).map(
    (entry) => source.desktop.widgets.find((w) => w.id === entry.widgetId)?.type,
  );
  if (source.settings.mobileHome && order.slice(0, 2).join(',') !== 'clock,weather') {
    throw new Error(`mobile home starts ${order.join(',')}, expected clock,weather`);
  }
  return `${weather.map((w) => w.title ?? w.id).join(', ') || 'none'} authored; ${issue.message}`;
});

/* ---------------------------------------------------------------- report */

console.log();
for (const note of notes) console.log(note);
rmSync(outdir, { recursive: true, force: true });

if (failures.length) {
  console.log(`\n${failures.length} FAILED: ${failures.join(', ')}\n`);
  process.exit(1);
}
console.log('\nAll checks passed. Content is safe to export.\n');
