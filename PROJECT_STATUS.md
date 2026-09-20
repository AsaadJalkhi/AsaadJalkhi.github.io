# ASAAD.OS — Project Status

> **Read this file first.** It is the single source of truth for what is built, what is
> missing, and what was decided. It exists so a new session can pick up the work without
> reading every file in the repo.
>
> **Last updated:** 2026-09-20 · **Session 12** (desktop collision / Quick View + search trims)

---

<!-- CHECKPOINT:START -->

## CURRENT SESSION CHECKPOINT

Session 12 · 2026-09-20 · **desktop icon collision · Quick View counters removed · search type
labels removed.** Three small, scoped UI changes. Nothing unrelated was redesigned: the widgets,
the dock, the window system and the drag architecture are untouched.

**Requested:**

- keep free-positioned desktop icons — explicitly **no grid**
- give every icon a small protected bounding area, and place new icons around them
- a random position that collides resolves to a nearby free spot
- icons stay freely draggable; they may pass over each other *while* dragging
- on drop: keep the exact position if valid, else move to the nearest valid spot
- keep the existing desktop-boundary behaviour and the existing localStorage persistence
- existing saved layouts must keep working
- remove the Quick View statistics row (Projects / Marketing / Creative / Digital)
- remove the "App" / type labels beside search results

**Completed:**

- **Free positioning plus protected space, and no grid anywhere.** New pure module
  `src/hooks/desktopPlacement.ts`: `collides`, `isFreeSpot`, `resolveSpot`, and a `SAFE_PAD` of
  10px. It works in **pixels**, not percentages, because a percentage is a different distance
  horizontally than vertically and "the nearest free spot" has to mean nearest *on screen*.
  `useDesktopLayout` converts at the boundary. There is no cell size, no snap and no rounding
  step — asserted by check 18, which fails on `snapTo|GRID_|CELL_|gridSnap`.
- **Resolution is an outward ring search.** If the requested spot is free it is returned
  **unchanged, to the pixel**. Otherwise: rings of growing radius (12px apart) around the
  requested point, 16 candidates each, rotated half a step per ring so successive rings do not
  retry the same directions; the first free candidate wins, which makes it the nearest free spot
  to within one ring. Candidates are clamped to sit wholly on the surface, so a nudge never parks
  an icon half off the desktop. If nothing is free within 80 rings the requested spot is returned
  as-is — an overlapping icon beats a vanished one.
- **Collision is consulted on drop, never during the drag.** `onMove` is unchanged and still
  wraps; the icon may pass freely over its neighbours while the pointer is down. `onUp` runs the
  requested point through `settle()`, which measures the dragged element's real box, builds
  obstacles from every *other* item's current position, resolves, and saves the accepted point to
  the existing `storageKeys.layout`. A refresh keeps icons where they were dropped.
- **Three tiers, and the difference is who decided.** `saved` (the visitor dragged it) is placed
  first and **never** rewritten at any viewport — that is what keeps a layout saved before
  collision existed loading exactly as it was left, pre-existing overlaps included. `authored`
  (an `x`/`y` in `portfolio.json`) gets *first refusal* on its spot but is resolved like anything
  else. `generated` (the seeded scatter) is fitted around both and around itself, so a newly added
  shortcut avoids everything already on the desktop.
- **The authored tier was changed on evidence, not taste.** A headless replay of the real
  placement pass over the real content found `w-clock` × `w-reaction` overlapping at 1280×720:
  they are authored 21% apart, which is 130px on a 618px-tall surface, and their combined
  half-heights plus the margin is 137px. Pinning authored coordinates would have preserved that
  bug forever, because no author can pick an x/y that clears its neighbours at *every* window
  size. Resolving them fixes it, and the default 1440×900 composition is unchanged because there
  they do not collide.
- **Footprints are measured, not guessed.** `data-layout-id` on `.dicon` and `.widget`;
  `useDesktopLayout` reads every real box in a layout effect and on resize. A widget is roughly
  twice an icon's area and a note widget's height depends on its text, so a nominal box would have
  let icons sit on a widget's lower half. `FALLBACK_SIZE` (one `.dicon`) covers only the first
  paint, before anything has been laid out.
- **Measurement stands down during a drag.** A drag re-renders on every `pointermove`, and
  re-reading ~15 boxes per frame is a forced reflow per frame for measurements that cannot have
  changed — moving an icon does not resize it. `syncGeometry` returns early while `dragState` is
  set.
- **Quick View counter row deleted.** The `<dl className="qv__stats">` block, the `Stat`
  component, the `countByDiscipline` call and import, the now-unused `projects` destructure, and
  the four `.qv__stats` / `.qv-stat*` rules. **Not replaced with anything.** `.qv__intro` already
  owned its own `padding-bottom` and bottom border, so the intro flows straight into Selected
  Work with no layout patch needed.
- **Search type labels deleted.** The `KIND_LABEL` map, the `.palette__item-kind` span, its CSS
  rule and its entry in the 560px media query. `entry.kind` still drives matching and ranking in
  `lib/search.ts` — it is simply never printed. Titles, descriptions, ↑↓ navigation, Enter/open,
  scrolling, matching and the system commands are all untouched and pinned by check 19.

**In progress:** nothing.

**Still to do:** the desktop collision behaviour has been verified by numbers, not by hand — a
headless replay of the real placement pass at five viewport sizes plus four `check:ui` assertions.
Nobody has yet dragged an icon onto another one in a real browser; browser automation is still
unavailable in this environment. That is the one manual QA item this pass adds.

**Last successful build:** `npm run build` clean (1873 modules, 3.31s); `npm run lint` (`tsc -b`)
clean; `npm run check:content` 7/7; `npm run check:ui` **19/19**.

**Files changed:**

- `src/hooks/desktopPlacement.ts` — **new.** Pure collision geometry: `SAFE_PAD`, `collides`,
  `isFreeSpot`, `resolveSpot`. No DOM, no React, no storage, so the rules are assertable.
- `src/hooks/useDesktopLayout.ts` — measured footprints, the surface in pixels, the three-tier
  placement pass, `settle()` on drop, drag-time measurement guard
- `src/components/os/DesktopIcon.tsx` — `data-layout-id`, a docblock note on why it is load-bearing
- `src/components/os/DesktopWidget.tsx` — `data-layout-id`
- `src/components/quick-view/QuickView.tsx` — counter row, `Stat`, `countByDiscipline` removed
- `src/components/quick-view/quick-view.css` — `.qv__stats`, `.qv-stat*` removed
- `src/components/os/CommandPalette.tsx` — `KIND_LABEL` and the type span removed
- `src/components/os/chrome.css` — `.palette__item-kind` and its media-query entry removed
- `scripts/check-ui.mjs` — loads the placement module; checks 16–19
- `PROJECT_STATUS.md`, `ARCHITECTURE.md`

**Next exact step:** none. Drag one icon onto another in a real browser and confirm it steps
aside rather than snapping to a grid.

<!-- CHECKPOINT:END -->

---

## Previous checkpoint — Session 11

Session 11 · 2026-09-19 · **Focus Mode finalisation · media titles · typography roles · Quick View
routing.** A targeted refinement pass. No completed system was rebuilt.

**Requested:**

- finalize Focus Mode behaviour, Instagram embed left exactly as the official embed
- Focus Mode must cover the ASAAD.OS top bar too — above the entire OS
- add an optional per-media title
- remove the project-title fallback inside Focus Mode
- stop the Focus arrows overlapping content (reserved space, not a bigger z-index)
- add a simplified custom typography system — no font manager, no external font service
- Display / Heading / Body roles, four controls each
- follow-up, same session: a font per role, not one font for the whole site
- a global typography scale that scales typography and nothing else
- fix Quick View → Explore OS navigation

**Completed:**

- **Both bugs were diagnosed from the code before a single change was written.**
  - *Focus Mode under the menu bar:* `.focus` was `position: fixed` at `var(--z-sheet)` (1000),
    which does outrank `--z-menubar` (950) **on the token scale** — but `MediaFocus` renders inside
    the project window, and `window.css:34` gives `.window` `isolation: isolate`. That creates a
    stacking context, so `.focus`'s z-index was only ever compared against its siblings *inside*
    the window, and the whole window sits at `--z-windows` (100 + a per-window offset), below the
    menu bar. The token was never wrong; the overlay was trapped. Fixed by portalling to
    `document.body`, not by raising a number. `isolation: isolate` stays — it fixes the
    backdrop-filter corner artefact.
  - *Quick View → Explore OS:* `App.tsx`'s hash→state effect carries `view` in its dependency array
    (it needs it for the `view === 'boot'` guard). "Explore the OS" calls `setView('desktop')`, that
    re-runs the effect, the effect re-reads the still-unchanged `#/quick`, sees `head === 'quick'`
    and calls `setView('quickview')` again. The state→hash effect then rewrites the hash and the two
    ping-pong. That is the stuck state, and it has nothing to do with localhost.
- **Focus Mode is the top application layer.** New `--z-focus: 1150` token, between `--z-palette`
  (1100) and `--z-boot` (1200), plus `createPortal(overlay, document.body)` in `MediaFocus`. Above
  the menu bar, the dock, every window, the widgets, the desktop icons and the command palette; only
  the startup cover and the custom cursor outrank it. No raw z-index values were added anywhere.
- **Nav arrows live in reserved gutters, not on top of the content.** `focusPlan()` subtracts
  `NAV_GUTTER` (64px, 44px under 720px wide) from the available width at each edge and returns it in
  the plan; `.focus__layout` pads by the identical amount via `--focus-gutter`. The layout is
  `[gutter][information][media][gutter]` portrait and `[gutter][content][gutter]` landscape. Zero
  gutter when there is only one item. Close button fixed top-right. Esc / ← / → unchanged.
- **`media.title`** — optional, on `MediaItemSchema`, shown in Focus Mode and in `MediaFrame`
  captions, editable in the Studio media editor, carried through import/export by virtue of being a
  normal schema field.
- **No project-title fallback.** `.focus__title` renders `media.title` and nothing else. Project,
  company and year survive only as a quiet `.focus__context` line at the bottom of the facts column,
  and project context alone no longer earns an information panel.
- **Typography: three roles, a typeface each, one global scale.** A shared font covers every role;
  `display.font` / `heading.font` / `body.font` each override it. Resolved by a three-level token
  chain — role face → shared face → native stack — so the hook writes both levels and the cascade
  decides. See §5 for the decisions.
- **Quick View fixed** with an `appliedRoute` ref in `App.tsx`: a route is applied exactly once, so a
  view change is no longer overwritten by a stale hash read. SPA navigation, no reload.

**In progress:** nothing.

**Still to do:** the manual QA listed at the end of §6 — real browsers, real Instagram embed, real
phone.

**Last successful build:** `npm run build` clean (1872 modules, 3.45s); `npm run lint` (`tsc -b`)
clean; `npm run check:content` 7/7; `npm run check:ui` 15/15 — all four re-run after the per-role
font change.

**Files changed:**

- `src/App.tsx` — `appliedRoute` guard
- `src/styles/tokens.css` — `--z-focus`, `--font-native-*`, the `--font-custom*` fallback chain,
  `--type-scale`, the three role blocks, `--fs-*` scaled
- `src/styles/global.css` — `body` takes the BODY role
- `src/components/media/MediaFocus.tsx` — portal, gutters, `media.title`, no fallback
- `src/components/media/focusLayout.ts` — `NAV_GUTTER`, `hasNav`, `plan.gutter`
- `src/components/media/media.css` — `--z-focus`, gutter padding, arrow offsets, `.focus__title`,
  `.focus__context`, `.media-frame__title`
- `src/components/media/MediaFrame.tsx` + all 8 adapters — `title` prop threaded through
- `src/components/ui/ui.css`, `src/components/windows/apps/apps.css` — role anchors
- `src/types/content.ts` — `media.title`, `TypeRoleSchema` (own `font` + four controls), extended
  `TypographySettingsSchema`
- `src/hooks/useTypography.ts` — rewritten for shared + per-role faces, roles and scale; each
  distinct file loaded once
- `src/studio/panels/AppearancePanel.tsx`, `studio.css` — the new Typography section
- `src/studio/panels/MediaFields.tsx`, `ProjectsPanel.tsx` — the Media title field and its label
- `scripts/check-ui.mjs` (+5 checks), `scripts/roundtrip.mjs` (check 7 extended)
- `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `CONTENT_GUIDE.md`, `README.md`

**Next exact step:** none — run the manual QA in §6.

---

## Previous checkpoint — Session 10

> Session 10 · 2026-09-18 · **stability / focus / desktop-icon pass.** Three areas only.
> No unrelated redesign. Larger pending feature pass explicitly **not** started.

**Requested:**
- fix broken `#/studio` route/render
- rebuild Focus Mode
- make Focus Mode adaptive to portrait / landscape / square media
- clean desktop icon styling
- fix native PNG dragging

**Completed:**
- **`#/studio` regression diagnosed — exact runtime cause found, not guessed.**
  `ProjectsPanel`'s hero preview (added session 9) renders
  `<MediaRenderer mode="card">`. For an `image`, card mode returns a **bare**
  `<SmartImage className="media-fill">`, and `.media-fill` is
  `position: absolute; inset: 0`. Its container `.studio-hero-preview` had
  `aspect-ratio` + `overflow: hidden` but **no `position: relative`**, so the
  absolutely-positioned child resolved its containing block against the next
  positioned ancestor — `.studio { position: fixed; inset: 0 }` — and stretched
  across the whole viewport, painting over the entire Studio UI. `overflow:
  hidden` does not clip a descendant whose containing block is an *ancestor* of
  the clipper, which is why the hidden overflow did not save it.
  The image it drew is the generated `Poster`: `media/gaf/gaf-hero.jpg` does not
  exist in `public/`, so `SmartImage` falls back to poster art on `onError` —
  hence "a giant portfolio-generated visual filling the screen".
  **Routing was never broken.** Proved with a render harness (below).

- **Studio fixed** — `position: relative` on `.studio-hero-preview`, with a comment
  recording why `overflow: hidden` did not save it. Grepped: `mode="card"` has
  exactly one caller, and every other `.media-fill` user sits in a `position:
  relative` stage, so this container was the only one missing it.
- **Focus Mode rebuilt — presentation only.** Adapters, the `useInView`
  load/play lifecycle, the Instagram official-embed behaviour, the
  YouTube/Vimeo/native-video integrations and the external-link rules are all
  untouched.
  - New `media/focusLayout.ts`: pure, no DOM. `focusLayout(ratio)` →
    `portrait` (< 0.95) · `balanced` (0.95–1.5) · `landscape` (≥ 1.5), and
    `focusPlan(ratio, viewport, …)` returns the exact pixel box plus whether the
    information sits beside the media or under it. Ratio comes from the existing
    `useMediaRatio` (manual aspect → measured intrinsic → type fallback).
  - Portrait/balanced on ≥ 1024px: information left (~31%, clamped 260–420px),
    media right using the full height. Landscape: **never** side-by-side — media
    large on top, editorial information row underneath, writing left / tools,
    credit, year and external action right. Under 1024px everything stacks,
    media then information.
  - The caption now lives **inside** the information region in every layout;
    `pre-wrap`, `overflow-wrap: anywhere`, `word-break: normal`, `max-width:
    60ch`. The information region scrolls when long — the media never does.
  - No detached dark card. Full-screen scrim + blur, then the composition inside
    it. Arrows and close are absolute against `.focus` at `z-index: 3`, so they
    take no part in media flow and a tall caption cannot displace them. `.focus`
    stays on the token scale at `--z-sheet` (above dock and menubar) — no ad-hoc
    z-index was introduced.
- Project context (title / company / year / tools) threaded
  `ProjectApp → MediaGallery → MediaFocus` as an optional `FocusContext` of
  **existing** fields. Empty sections are not rendered.

- **Desktop icons: every plate removed.** `.dicon__glyph` was a 60×56 raised tile
  — gradient, inset highlight, ring, shadow, `overflow: hidden`, a folder-shaped
  `border-radius` — holding a 24px glyph, while custom artwork next to it was
  drawn bare at 72px. A desktop showing both read as two different kinds of
  object. Now one visual language: mark + label. Glyph box is 72px to match
  `.dicon__art`, the lucide glyph is 40px, and there is no background,
  `box-shadow` or `border-radius` left on it. The monogram fallback is letters,
  not letters in a coloured square: `icon.tint` is applied as the **text colour**
  on the parent instead of as a background, so the field keeps meaning without a
  plate. Badges re-anchored to the mark rather than to the (now larger) box.
  Studio's `IconPreview` updated to match, or the preview would be lying.
- **Native PNG drag fixed.** Pressing in the middle of an icon image started
  Chrome's own image drag: a ghost of the PNG followed the cursor over the
  widgets and windows, the pointer stream to `useDesktopLayout` was cut, and the
  shortcut stayed put — dragging only worked from the label or the padding.
  Fixed on the element that caused it: `draggable={false}` + `onDragStart`
  preventDefault in `DesktopIcon.tsx`, and `pointer-events: none`,
  `-webkit-user-drag: none`, `user-select: none` on `.dicon__img`, plus
  `user-select: none` on `.dicon` itself for the label. The `<button>` wrapper
  now receives every press, which is where the drag and the click already lived.
  **`useDesktopLayout` was not touched** — pointer capture, `DRAG_THRESHOLD_PX`,
  `didDrag` and wrap-around are all intact.
- **Targeted regression script added.** `scripts/check-ui.mjs`
  (`npm run check:ui`), same shape as the existing `roundtrip.mjs` — plain Node,
  no test runner installed. 10 checks, all passing: the `#/studio` route and its
  lazy import; `position: relative` on every `card`/`focus` media container;
  `focusLayout()` classification across 8 ratios; landscape never side-by-side and
  a phone always stacked; aspect preserved and nothing overflowing across 3
  viewports × 6 ratios; `.focus` on the token z-scale and outranking the dock;
  caption wrap + no nested media scroller; icon image inert; the desktop drag
  gesture still present; and no plate on any icon.

**In progress:**
- nothing

**Still to do:**
- manual visual QA in a real browser (listed at the end of this session's report)

**Harness (browser automation is unavailable in this environment):**
`esbuild`-bundled SSR render of the real app against the real `portfolio.json`.
Proved: `#/studio` → `routeParts` head `studio` → early return → `PinGate`
renders (`class="pin"`), **no desktop, no menubar, no window chrome, no OS
shell**; and with the unlock present, `StudioApp` renders `studio__nav` and all
panels with no throw and no `studio-broken` boundary card. Routing and React are
correct; the failure was purely a CSS containing-block escape.

**Last successful build:** this session — `npm run lint` clean · `npm run build`
green, 1872 modules, 9.02s (Studio still a separate 66.33 kB chunk, so it is
still lazy) · `npm run check:content` 7/7 PASS, `portfolio.json` byte-identical ·
`npm run check:ui` 10/10 PASS.

**Files changed:**
- `src/studio/studio.css` — `position: relative` on `.studio-hero-preview` (the
  fix); unplated `.studio-icon-preview__mono`
- `src/components/media/focusLayout.ts` — **new**, pure layout decisions
- `src/components/media/MediaFocus.tsx` — rewritten (presentation only)
- `src/components/media/media.css` — focus section replaced
- `src/components/media/MediaGallery.tsx` — passes `FocusContext` through
- `src/components/windows/apps/ProjectApp.tsx` — supplies `FocusContext`
- `src/components/os/DesktopIcon.tsx` — inert image, unplated fallback
- `src/components/os/os.css` — plate removed, drag/select guards
- `src/studio/panels/parts.tsx` — `IconPreview` matches the desktop
- `scripts/check-ui.mjs` — **new**; `package.json` — `check:ui` script
- `ARCHITECTURE.md`, `CONTENT_GUIDE.md`, `README.md`, `PROJECT_STATUS.md`

**Not touched:** `src/content/portfolio.json` (round-trip confirms it is
byte-identical) and `backup/`. The temporary `.harness/` directory has been
deleted.

**Next exact step:** manual browser QA. Nothing is blocked on code.

---

## Previous checkpoint — Session 9

> Session 9 · 2026-09-18 · **content-presentation / media / Studio UX pass.**
> Not a redesign — no approved visual decision was revisited. **Code complete.**
> `npm run lint` clean · `npm run build` green · `npm run check:content` 7/7.
> **Nothing has been seen on screen. Human visual QA is the remaining step.**

**Completed:**

- **Image ⇄ Gallery is one continuous thing.** Gallery is no longer a type you can pick —
  picking it was a dead end that demanded images you had no way to add. You add an Image and
  press **"+ Add another image"**; the picture you already chose becomes image one. Each row
  has its own source, alt, caption, shape, reorder, duplicate and remove. Drop back to one
  image and it folds into a plain Image again.
- **Exactly one "Auto", and it is real.** `media/aspect.ts` is now the single definition:
  manual wins, otherwise the media's actual `naturalWidth/naturalHeight`,
  `videoWidth/videoHeight`, or measured cover; `FALLBACK_RATIO` only where the shape is
  genuinely unknowable. The duplicate `<option>` (an empty placeholder *and* a literal
  `'auto'`, both reading "auto") is gone. Auto is stored as the **absent** field; `'auto'`
  still parses for backward compatibility.
- **Real masonry.** `MediaGallery` packs shortest-column-first from estimated heights
  instead of CSS-grid rows, which is what caused the blank holes. `featured` breaks out
  full-width and restarts the packing beneath it. Media and caption travel as one block.
- **Focus Mode rewritten.** A media-sized box on a dark scrim above windows and dock — not a
  white panel. 90vw × 72dvh (80 without a caption), portrait capped at 460px. Close top-right;
  arrows viewport-fixed and vertically centred as siblings of the stage, so they no longer
  drift with each item. Esc / ← / →. Caption block under the media, at the media's width,
  wrapping, with credit and "View original post ↗".
- **Captions are editorial copy.** Textarea in the Studio, `pre-wrap` +
  `overflow-wrap: anywhere` in render, `max-width: 68ch`, never horizontal overflow. Caption,
  Alt and Credit stay three distinct fields.
- **Websites stopped being iframes.** `WebsiteMedia` renders URL → "Visit Website ↗" plus
  author-supplied `screenshots[]`, in 0 / 1 / many shapes. This fixes the live broken embed
  (`m-0ez3g67`, designersandus.com). `iframe: true` is deprecated and inert for websites,
  retained in the schema so old content validates.
- **Explicit project hero.** `project.heroMediaId` + `showHeroInMedia`, a PROJECT HERO
  section in the Studio with a preview and a real **None**. Hero renders at its own ratio
  (the `aspect-ratio: 16/9` cage on `.case__hero` is gone) and is not repeated below.
  Deleting the hero media clears the reference; a dangling one is a named validation error.
- **Google Drive video.** New `drive` type: six share-URL shapes parsed to a file id, lazy
  `/preview` iframe, cover, Focus Mode, "Open in Google Drive ↗", and the helper line *"The
  Drive file must be shared so anyone with the link can view it."* Autoplay is **not** claimed.
- **Typography.** `settings.typography.primary/.secondary`, each `{ family?, file? }`.
  `useTypography` loads only what is configured via the `FontFace` API and writes
  `--font-sans`/`--font-display` and `--font-editorial`/`--font-serif`. woff2/woff/ttf/otf.
  **No Google Fonts, no font service.** Failure falls back silently.
- **Icons.** `icon.imageLight` / `imageDark` with legacy `image` compat. Custom artwork is
  drawn **bare** at 72px, `contain`, no plate, no tint, nothing clipping it. "Fallback tint"
  is out of normal icon editing; the Studio shows Light PNG / Dark PNG / Fallback monogram
  with light+dark previews side by side. The duplicate raw "Icon tint" field in
  `ProjectsPanel` is gone — projects now use the shared `IconFields`.
- **Generative retired.** Out of the Studio picker and out of the user-facing guide; still in
  `mediaTypes`, still rendering, still editable for the 4 live items that use it. Removing
  the enum value would fail validation on every file containing one.
- **Regression harness committed.** `scripts/roundtrip.mjs` (`npm run check:content`) — it
  was verified by hand in session 7, which meant every schema change re-opened the question.
  7 checks: content validates · no-edit round trip drops nothing (**byte-identical**) ·
  export is a fixed point · single-field edit = exactly 1 diff · `demo: true` cannot rescue
  an empty item · dangling `heroMediaId` is reported · content without any new field still
  validates.

**Deliberate content migration (documented, as required):**
`src/content/portfolio.json` gained one key per project — `heroMediaId`, set to whatever the
old implicit rule (`media.find(featured) ?? media[0]`) would have chosen. Nothing moved on
screen; the hero is simply now explicit rather than guessed. 10 projects, 10 keys, no other
change. `backup/portfolio.TRUTH.json` **was not touched** (mtime unchanged, 2026-09-16).

**Latent bug found and fixed on the way:** there were **no base `.smart-image` CSS rules
anywhere** — only `.tile__media .smart-image` in `work.css`. So `<img class="smart-image__img">`
inside a media frame had nothing but `display:block; max-width:100%` from `global.css`, never
filled its box, and its `objectFit` was inert. This sat underneath most of the reported
image-presentation complaints.

**Behaviour changes worth knowing:**
- `featured` on a media item now means **only** "full-width row in the body". It no longer
  implies "hero".
- `MediaFrame`'s `fill` prop was **redefined** to mean "content sizes it" (it used to mean
  `height: 100%`). Verified by grep that nothing else relied on the old meaning.
- Desktop icons: `.dicon` widened 92px → 104px, artwork 72px bare, fallback tile 48×44 → 60×56
  so the two read as one row.

**Still to do — human visual QA only:**
- Gallery creation flow end-to-end in the Studio, and the Image→Gallery→Image fold-back.
- Masonry with real mixed-ratio content; confirm no holes at 1 and 2 columns.
- Focus Mode on a portrait Reel, a Drive video and a website screenshot set.
- Both desktop themes with the real `GAF2.png` / `Blender.png` — the logos are now unplated.
- Typography: **`public/fonts/` does not exist and no font file was invented.** Nothing is
  configured, so the system stack is in use. Needs real files to be exercised — one shared face, and
  a second on a single role to confirm the override and that the other roles keep the shared one.
- Drive playback against a real shared file.

**Last successful run:**
```
npm run lint      → tsc -b, clean
npm run build     → ✓ 1871 modules transformed, built in 3.35s
npm run check:content → 7/7 PASS ("byte-identical", "stable")
```

---

## Previous checkpoint — Session 8

> Session 8 · 2026-09-18 · **targeted bug fix: the Studio "Desktop & dock" tab went white.**
> Nothing else touched. **Complete** — lint clean, build green, DesktopPanel verified in a
> real client render.

**The bug:** clicking *Desktop & dock* in `#/studio` blanked the panel to white. Every other
tab was fine.

**Exact cause — a render throw above every error boundary, with no boundary to stop it.**
`DesktopPanel` is the only panel that builds dropdowns out of *other* collections, and it did
so in four `.map()` calls at the very top of the component body:

```ts
const folderOptions  = draft.folders.map(…);
const projectOptions = draft.projects.map(…);
const noteOptions    = draft.notes.map(…);
const alertOptions   = draft.alerts.map(…);
```

Those run **before the first `<Section>`**, so they sit outside anything that could contain
them. If any one of those four collections is not an array on the live draft, the `.map()`
throws, and — because the Studio had **no error boundary anywhere** — React unmounted the
entire root. `#root` was left empty and the page fell back to the body background: the white
screen. The error existed only in the browser console.

The reason a draft can be that shape at all: **panels render the live draft *before* it is
validated**, deliberately (you cannot fix a value you cannot see). `api.validation` only
*reports*; it never gates the render. So the schema's `.default([])` guarantees do not
protect the panel body.

**Proven, not guessed.** `src/content/portfolio.json` is *not* the trigger — it renders
cleanly. Five independent harnesses against the real validated content all passed:
SSR `renderToString`, a client `createRoot` under `StrictMode`, the full `StudioApp` with a
real click on the *Desktop & dock* tab, a fuzz driving every select / text field / delete in
the panel, and the broken-icon path (`<img>` 404 → `onError` → `ImageOff`). The failure only
reproduced when a collection was handed a non-array — which is why it depends on draft state
in the browser rather than on the shipped file.

**Fix — containment plus the one unguarded path, no data hidden:**
- `panels/parts.tsx`: new `StudioBoundary` (class component). `Section` now wraps its own
  children in one, so a bad value in *Widgets* cannot blank out *Dock links*. It renders a
  calm card naming what failed and the message, and `console.error`s the component stack.
  That log only fires on a real failure — it is not debug noise.
- `StudioApp.tsx`: the active panel is wrapped in the same boundary, `key={tab}`, so work
  a panel does above its sections can no longer white out the app, and switching tabs
  re-attempts the render instead of latching the error.
- `DesktopPanel.tsx`: the four option lists go through a local `list()` helper
  (`Array.isArray(v) ? v : []`). This **hides nothing** — they are lists of *choices*, and an
  absent collection genuinely offers no choices. The items themselves are still edited in
  their own sections, which report their own problems through their own boundary.
- `Repeater`'s **Duplicate** no longer clones the id. It was producing two rows sharing one
  id, which is invalid content, makes every reference to that id ambiguous, and put duplicate
  values into every dropdown built from that list. A copy now gets `uniqueSlug(…, `${id}-copy`)`.
- `Choice` keys options by `value + index`. The fuzz caught ~60 real
  "two children with the same key" warnings once ids collided; React states that duplicate
  keys may duplicate or omit children, which is not a state to leave a `<select>` in. Now 0.

**Verification (DesktopPanel, real `portfolio.json`, client render under `StrictMode`):**

| Check | Result |
| --- | --- |
| Baseline: all 6 sections render, 32 editable rows | ✅ no errors, not blank |
| Each of the 6 sections sabotaged in turn | ✅ 6/6 contained — the other 5 stay editable, never blank |
| Photoshop / After Effects / Blender / VS Code shortcuts | ✅ present and editable |
| Icon preview + monogram/tint fallback + `ImageOff` on 404 | ✅ works, re-tests on retype |
| Clock + Reaction widgets, dock links, alerts + buttons, auto-open | ✅ all editable |
| Duplicate ids present in alerts + shortcuts | ✅ renders clean, 0 key warnings |
| Fuzz: every select option, every field cleared, every row deleted | ✅ no crash |

`npm run lint` (`tsc -b`) clean · `npm run build` green, 1867 modules, 3.14s. Studio chunk
59.24 kB (gzip 18.42) + 16.03 kB CSS.

**`src/content/portfolio.json` was NOT modified** — still 36,068 bytes and byte-for-byte
identical to `backup/portfolio.TRUTH.json`. No content error was found; there was nothing to
report.

**Honest caveat:** the *originating* bad value in the browser's saved draft was never seen —
it lives in localStorage on Asaad's machine, and the shipped content does not reproduce it.
The white screen is fixed for every cause, and any remaining cause now names itself on screen
instead of hiding in the console. If it recurs, the card will say which section and why.

---

> Session 7 · 2026-09-17 · **data-integrity / Studio / media / window-usability pass.**
> Not a redesign. **Complete** — lint clean, build green, regression suite passing.

**Requested in this session:**
- Studio stale-draft / data-loss protection
- lossless Studio export
- Studio must expose all current desktop / theme / widget / app content
- custom desktop/app icon controls
- top-edge-only window constraint
- unified video / embed playback
- automatic media loading
- media focus-mode sizing fix
- thumbnail / cover behaviour
- type-specific media validation

**Completed:**

*Data integrity*
- **Root cause of the content loss found and proven, not guessed.** The schema was
  exonerated first: running `backup/portfolio.TRUTH.json` through `validatePortfolio()` and
  deep-diffing produced **23 differences, all ADDED, zero DROPPED** — `responsibilities: []`
  ×10, `rotate: 0` ×12, `primary: false` ×1, i.e. Zod materializing `.default()` values.
  Additive and harmless. With the schema cleared, the cause is `useDraft.ts`, which restored
  **any** localStorage draft that merely *validated*. An old draft validates perfectly — it
  is just old. A draft predating the wallpapers/widgets/creative-app shortcuts replaced the
  newer canonical content on open, and the next export wrote that stale state to disk.
- `src/studio/useDraft.ts` rewritten around a version-aware envelope
  `{ baseSignature, savedAt, draft }`. `baseSignature` is an FNV-1a `fingerprint()` over a
  `stableStringify()` that sorts object keys at every depth but **deliberately preserves
  array order**, because array order is real content here (it is desktop order).
  Legacy bare-portfolio saves get `baseSignature: ''` and are stale by definition.
  Unreadable drafts are removed rather than re-parsed forever.
- Three-case recovery screen in `StudioApp.tsx` (`StaleDraftRecovery`). **The safe default
  is "Load current portfolio"** — the destructive option is never the primary button. Third
  action downloads the old draft as `portfolio.old-studio-draft.json`, so nothing is
  discarded without a copy. Plus a sidebar `Reload from portfolio.json` with a two-step
  confirm.

*Regression testing (brief §3) — all passing*
- Truth file validates; truth file and `src/content/portfolio.json` are **byte-for-byte
  identical** (verified, not assumed).
- **No-edit round trip:** zero fields dropped or altered; only the 23 documented default
  materializations added.
- **Export is a fixed point** — re-importing the export changes nothing.
- **Single-edit round trip:** editing exactly one field (`profile.headline`) produces
  **exactly one** diff and nothing else.
- Field-by-field survival of wallpapers, boot, socials, aboutPage, contact, desktop items +
  icons, widgets, dockLinks, autoOpen, alerts, folders, projects, media, tiles, case
  studies, experience, skills, notes.
- Media validation is type-specific and **`demo` is not an escape hatch** — `demo: true`
  does not rescue an empty Instagram or video item. A thumbnail alone does not rescue a
  YouTube item. An Instagram permalink **alone** validates.
- Studio form and validator cannot drift: both call the same `mediaProblem()`.

*Window usability*
- `src/lib/chrome.ts` (new): `menubarHeight()` reads `--menubar-h` via `getComputedStyle`
  (SSR-guarded), `topSafeArea()` = menubar + 8. No magic numbers left on any window path.
- Top edge only is constrained, via **controlled positioning** —
  `rnd.current.updatePosition()` inside `onDrag`. `bounds` cannot express a one-sided limit
  (it walls all four, which was the original bug) and returning `false` from `onDrag` aborts
  the gesture instead of sliding along the limit.
- **Left, right and bottom remain completely unbounded.** No `bounds` prop was re-added.
- `state/os.ts` spawn clamp, maximise geometry and Tidy all use `topSafeArea()`.

*Media*
- `hooks/useInView.ts` (new): two observers — `near` (rootMargin 300px, **latched**, the
  load signal) and `visible` (threshold 0.35, **live**, the play/pause signal). Fails
  **open** if `IntersectionObserver` is absent.
- **Every "Load embed" / play facade is gone.** Video, YouTube, Vimeo and Instagram all
  initialise themselves on approach.
- `VideoMedia`: `muted loop playsInline controls`, proximity-driven `preload`, `#t=0.001`
  fragment so iOS/Safari paint a first frame, `play()` always `.catch()`-ed,
  `prefers-reduced-motion` respected.
- `EmbedMedia`: YouTube/Vimeo muted autoplay; YouTube `loop=1` paired with
  `playlist=<id>` (inert without it); `youtube-nocookie`.
- `InstagramMedia`: auto-init on `near`, give-up raised to 6s, then cover +
  "View original post". **Instagram is not scraped, no private API is used, and autoplay
  success is never faked.**
- `MediaFocus.tsx` (new lightbox): the box is computed from the item's aspect **before**
  anything renders, as CSS `min()` expressions (no resize listener). Capped 90vw × 86dvh;
  portrait additionally capped 520px wide. This replaced
  `.lightbox__panel { width: min(1000px,100%); max-height: 80vh; overflow: auto }`, the one
  rule responsible for the white canvas, the stretched portrait content and the nested
  scrollbar. `.media-instagram` `overflow: auto` → `hidden` killed the giant scrollable
  viewer.
- **Artwork is no longer a link.** The `<button>` wrapping each tile is gone — it nested
  `<video>`/`<iframe>` inside a button, swallowed clicks meant for the player's own
  controls, and let a stray click leave the site. Focus Mode is entered via the explicit
  `FocusAffordance` button.
- `mode` is now a three-value contract: `'card'` | `'full'` | `'focus'`, where `focus` means
  the container owns the frame, caption and ratio.
- `MediaApp` (the Media window) fixed: it was rendering `mode="full"`, so it drew the
  caption in the frame **and** again in its own bar, and forced every item into the frame's
  16:9 default — a 9:16 Reel came out letterboxed inside a widescreen box. It now renders
  `mode="focus"` into a `.player__box` shaped by the item's own aspect and bounded by the
  window, keeps caption/counter/Sample badge in its bar, and keys the adapter so stepping
  cannot leave the previous item playing behind the new one.

*Studio content coverage & editing*
- `DesktopPanel` renamed to "Desktop apps & shortcuts"; confirmed it already exposes items
  (no kind filtering), widgets, dockLinks, alerts + buttons, and autoOpen.
- `IconFields` + `IconPreview` in `panels/parts.tsx`: live preview that re-tests on src
  change, monogram + tint fallback, `ImageOff` marker, and collapses an all-empty icon to
  `undefined`. Used by both `DesktopPanel` and `FoldersPanel`.
- `panels/MediaFields.tsx` (new): **type first**, then only the two or three fields that
  type actually uses. A `Requirement` line driven by `mediaProblem()` states what is missing
  and turns into "Ready to export." An `Advanced` drawer keeps raw `src`/`url`/`thumbnail`/
  `credit` reachable so nothing in the schema is unreachable.
- `types/content.ts`: media `.refine` → `.superRefine` delegating to a new exported
  `mediaProblem()`, with per-type messages. Long comment records that **`demo` is a
  labelling flag only and must never be a validation escape hatch**.
- **No fake uploader was built.** `LOCAL_PATH_HINT` tells people to put the file in
  `public/` themselves; the Studio never claims it can write binary files into the repo.

**In progress:** nothing.

**Still to do (carried, not regressions):**
- Human QA on screen — see *Next exact step*.
- Content work: replace the 9 demo projects, change the Studio PIN, add folder logos,
  produce a PNG `og:image`.

**Last successful build:** `npm run lint` (`tsc -b`) clean · `npm run build` green,
1867 modules transformed, built in 3.23s. Only the pre-existing, harmless Rollup
comment-annotation warnings from `zod`. Gzip: react 69.05 kB, index 65.82 kB, motion
27.53 kB, windowing 12.51 kB, index.css 14.25 kB, StudioApp 17.80 kB JS + 2.97 kB CSS.

**Truth-file status: UNTOUCHED.** `backup/portfolio.TRUTH.json` was read for comparison only
— never written, renamed, or used as the working content file. `src/content/portfolio.json`
was **not modified this session**; both remain 36,068 bytes and byte-for-byte identical.

**Files changed:**
- New: `lib/chrome.ts`, `hooks/useInView.ts`, `components/media/MediaFocus.tsx`,
  `components/media/FocusAffordance.tsx`, `studio/panels/MediaFields.tsx`.
- Rewritten: `studio/useDraft.ts`, `components/media/MediaGallery.tsx`,
  `components/media/adapters/{VideoMedia,EmbedMedia,InstagramMedia}.tsx`.
- Edited: `studio/StudioApp.tsx`, `studio/panels/{parts,DesktopPanel,FoldersPanel,
  ProjectsPanel}.tsx`, `studio/studio.css`, `components/windows/Window.tsx`,
  `components/windows/apps/MediaApp.tsx`, `components/windows/apps/apps.css`,
  `components/media/{MediaFrame,media.css}`, `components/media/types.ts`,
  `types/content.ts`, `state/os.ts`.
- Unchanged on purpose: `src/content/portfolio.json`, `backup/portfolio.TRUTH.json`,
  `lib/paths.ts` (already correct — external URLs pass through untouched).
- Docs: `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `CONTENT_GUIDE.md`, `README.md`.

**Next exact step:**
- **Human QA on screen** — `npm run dev`, then:
  1. Drag a window up into the menubar: it should stop just below it and still slide
     sideways. Drag off the left, right and bottom edges: it should leave freely.
  2. Open a case study with video and Instagram media: it should play by itself, muted, with
     no button to press. Click the player's scrubber — it must not open the lightbox.
  3. Open Focus Mode on a 9:16 Reel: tall and narrow, no white canvas, no inner scrollbar.
  4. Open `#/studio`, edit one field, export, and diff against `src/content/portfolio.json`
     — only that field should differ.
- Then the content work listed above.


---

## 1. What this is

A portfolio for **Asaad Jalkhi** (marketing / creative / digital, Dubai) presented through a
believable personal computer interface — **ASAAD.OS**.

The governing rule, set by the client in session 4 and binding on everything after it:

> **PORTFOLIO FIRST. OPERATING SYSTEM SECOND. The work is the hero.**
> The OS is only the navigation and personality layer.

Two entry points:

| Mode | For | Route |
| --- | --- | --- |
| **Desktop** | everyone — the Work window opens immediately and dominates | `#/` |
| **Quick View** | recruiters — conventional, readable, 60-second scan | `#/quick` |

Stack: **React 19 + TypeScript + Vite 7**, Zustand (shell state), Zod (content validation),
GSAP, react-rnd, lucide-react. Static build, deployed to GitHub Pages by Actions.
**No backend, no secrets, no analytics.**

Companion docs: [`README.md`](README.md) (run/build/deploy) ·
[`ARCHITECTURE.md`](ARCHITECTURE.md) (how the code works) ·
[`CONTENT_GUIDE.md`](CONTENT_GUIDE.md) (how to add your real work).

---

## 2. Health check

Last verified **2026-09-20, end of session 12**.

| Check | Command | Status |
| --- | --- | --- |
| Type check | `npm run lint` | ✅ clean |
| Production build | `npm run build` | ✅ green — 1873 modules, 3.31s |
| Content validates against Zod | `npm run check:content` | ✅ 7/7 — 10 projects, 25 media items |
| Studio export → import round trip | `npm run check:content` | ✅ byte-identical on no edit, stable under re-import |
| Shell regressions | `npm run check:ui` | ✅ **19/19** — adds desktop collision (a free drop kept exactly, a colliding one nudged clear, no grid) and the Quick View / search trims |
| Routes served | `npm run preview` → `/`, `/#/quick`, `/#/studio` | ✅ 200, Studio chunk emitted |
| Backward compatibility | `npm run check:content` check 7 | ✅ both ways — content with no `media.title`/`typography` validates, and the new fields alongside legacy `secondary` validate |
| Wallpapers ship | `ls dist/wallpapers/` | ✅ both `.jpg` files emitted |
| Studio code-split | `ls dist/assets/` | ✅ own `StudioApp-*.js` / `.css` chunk |
| Docs | — | ✅ all four current |
| Studio panels render | SSR smoke (§6, session 3) | ✅ 8/8 mount against real content |
| Studio clicked in a browser | `npm run dev` → `#/studio` | ⚠️ **still not done** |
| Redesign seen on screen | `npm run dev` → `http://localhost:5173/` | ⚠️ **still not done** — no browser automation in this environment |
| Desktop collision | `npm run check:ui` 16–18 + a headless replay of the real placement pass | ✅ no overlapping pair at 1024×768, 1280×720, 1440×900, 1920×1080 or 2560×1400; a new shortcut still finds room against a fully clustered saved layout |
| An icon dropped onto another icon | `npm run dev`, drag one onto another | ⚠️ **not done by hand** — verified by numbers only |

Bundle, gzipped: `react` 69.1 kB · `index` 64.5 kB · `motion` 27.5 kB · `windowing` 12.5 kB ·
CSS 13.8 kB · `StudioApp` 15.1 kB JS + 2.4 kB CSS (lazy — visitors never download it).
Raw: `index.html` 2.85 kB, `index.css` 73.3 kB, `index.js` 216.7 kB, `react.js` 221.9 kB.

Content as validated: **10 projects** (5 featured, 9 flagged `demo`), 6 folders,
**7 experience entries (all real, from the CV)**, 3 skill groups, 4 notes,
**12 desktop items**, **2 widgets** (clock + reaction), **3 dock links** (no URLs of their
own — resolved from `profile`), **4 system alerts**,
2 auto-opened windows, 20 media items, **0 invented metrics**, `profile.cv.file` =
`cv/Asaad_CV.pdf`, `settings.theme.default` = `light`, `settings.studioPin` set.

The only build warnings are pre-existing Rollup comment-annotation notices from
`node_modules/zod`. They are harmless and not ours.

**Honest caveat:** still verified by the compiler and by schema validation only. Nobody has
looked at the refinement pass on screen. A human needs to open `http://localhost:5173/`,
switch the theme, drag an icon off each edge, click all four creative-app alerts, and open
`#/studio` and get through the PIN.

---

## 3. What exists

### Shell / OS (`src/components/os/`)
| File | Does |
| --- | --- |
| `BootSequence.tsx` | Wordmark only, ~900ms; skipped under reduced-motion. No fake boot log. |
| `Desktop.tsx` | Wallpaper + icon grid + window layer + dock + menu bar. **No hero splash plate** |
| `DesktopIcon.tsx` | Draggable icon; double-click or Enter opens its target |
| `Dock.tsx` | Floating glass pill; shows running apps |
| `MenuBar.tsx` | Wordmark + **Work / About / CV / Contact** nav; Search (⌘K), Quick View, clock |
| `CommandPalette.tsx` | ⌘/Ctrl+K fuzzy search over projects, folders, apps, notes, skills |
| `CustomCursor.tsx` | Off by default (`settings.customCursor: false`) |
| `Wallpaper.tsx` | Three quiet layers — base, light, vignette |

### Window system (`src/components/windows/`)
`Window.tsx` (opaque body, glass title bar, controls fade in on focus) · `WindowLayer.tsx` ·
`registry.tsx` (**the app registry — add an app with one entry**).
Apps: Work, Project, Note, Media, Browser, About, CV, Contact, Skills, Experience,
Studio (lazy-loaded).

### The Work window — `apps/ProjectsApp.tsx` + `apps/work.css`
**The most important screen.** An irregular editorial 12-column grid; each project's size and
shape come from its own `tile: { span, aspect }` so the composition is art-directed, not
uniform. Tile = image, then title, then `Company · Year`, then role — no cards, no
descriptions, no badges. Reflows via **CSS container queries** (900px / 560px), so it responds
to the *window*, not the viewport.

### The project stage — `apps/ProjectApp.tsx`
Opens in a large centred window (`stageBox()` in `useOpenTarget.ts`), not a popup.
Order: **hero media → title → company·year → role → short intro → facts → media, media,
media.** Challenge/Approach/Execution/Results render **only when those fields exist**.
Exports `CaseStudyBody`, which Quick View reuses.

### Content (`src/content/portfolio.json` + `src/types/content.ts`)
Zod-validated at load; invalid JSON renders a readable error screen, never a blank page.
Profile, contact details, CV and all 7 experience entries are **real**. The 10 projects are
sample compositions flagged `demo: true` with prose prefixed *"Sample placeholder text."* —
except `web-asaad-os`, which is this site and genuinely real.

### Media (`src/components/media/`)
`MediaRenderer.tsx` dispatches on `media.type`:
`image · gallery · video · youtube · vimeo · instagram · website · pdf · embed · generative`.
Instagram accepts `instagramUrl` **or** `url` and always falls back to the thumbnail plus
"View original post". `SmartImage` falls back to a generated `Poster` when a file is missing
— **this is why the empty `public/media/` folder does not break anything.**

### Quick View (`src/components/quick-view/QuickView.tsx`)
Recruiter mode: intro, selected work, experience, capabilities, about, contact, CV.

### Mobile (`src/components/mobile/MobileShell.tsx`)
No dragging. Apps as cards, projects as full-screen sheets.

### Studio (`src/studio/`)
`#/studio`. Edits a validated draft and **exports JSON** — it deliberately cannot publish
(that would require a GitHub token in client-side code). Projects and media both support
add / edit / duplicate / delete / move up / move down.

### Deployment
`.github/workflows/deploy.yml` — typecheck → build → SPA fallback → `.nojekyll` → Pages.
`vite.config.ts` uses `base: './'`, so the build works at a user page, a project
subdirectory, or a custom domain **with no edits**.

---

## 4. Known gaps

Priority order. Update the status column as these are done.

| # | Gap | Impact | Status |
| --- | --- | --- | --- |
| 1 | Six Studio panels + `studio.css` missing | build failed | ✅ done (session 2) |
| 2 | `@types/node` not installed | build failed | ✅ done (session 2) |
| 3 | Empty `react` manual chunk | 431 kB main chunk | ✅ done (session 2) |
| 4 | **Studio never opened in a browser** | unknown runtime bugs | 🟡 partial — all 8 render; interaction unverified |
| 5 | Demo media files absent from `public/media/` | cosmetic only — falls back to generated `Poster` art | ⬜ open |
| 6 | No real CV PDF | CV download 404'd | ✅ done (session 4) — `public/cv/Asaad_CV.pdf`, 183,601 bytes |
| 7 | `og:image` is an SVG | most social platforms won't render SVG — needs a 1200×630 PNG | ⬜ open |
| 8 | Placeholder URLs | must change before going live | ✅ done (session 6) — real email, LinkedIn and Instagram; `profile.socials` is the single source and the dock derives from it |
| 9 | Project content is demo | replace with real work | 🟡 profile, contact, CV and experience are real; 9/10 projects still sample |
| 10 | No automated tests | manual QA only | ⬜ accepted |
| 11 | **Redesign never seen on screen** | visual bugs invisible to the compiler | ⬜ open — human QA needed |
| 12 | `MobileShell.tsx` + `mobile.css` still on the old visual language | mobile looks like the pre-redesign site | ✅ done (session 5) — tokens + theme toggle |
| 13 | `quick-view.css` (615 lines) not yet aligned to the new language | Quick View drifts from the desktop design | ✅ done (session 5) — accent wash + scrim now token-driven |
| 14 | Studio cannot edit `tile` or `instagramUrl` | new fields must be hand-edited in JSON | ✅ done (session 5) |
| 15 | **No wallpaper images** | both themes fall back to their built-in gradient | ✅ done (session 6) — `public/wallpapers/light-theme-wallpaper.jpg` + `dark-theme-wallpaper.jpg`, wired and cross-fading |
| 16 | About copy is a first draft | written from the CV and skills, not dictated by Asaad | 🟡 needs his own pass — `profile.aboutPage` in Studio → Profile & CV |
| 17 | Folder icons have no images | company logos would land better than the generic folder | ⬜ open — drop PNGs in `public/icons/` and set `folder.icon.image` |
| 18 | Studio PIN is `2468` | a privacy gate, not security — it ships in the bundle | 🟡 change it in Studio → Appearance |
| 19 | Reaction widget never played on a real touchscreen | pointer handling is right in principle; the feel isn't verified | ⬜ open — needs a phone |
| 20 | Off-screen windows have no on-screen affordance | a window dragged off the left, right or bottom is recoverable (Tidy, dock, Reset desktop) but nothing *hints* that it is out there | ⬜ accepted — deliberate; the ask was an infinite workspace, not edge indicators. The top edge is the one exception and is now clamped (#24) |
| 21 | Studio draft could silently overwrite newer content | **caused real data loss** — an old draft restored over the canonical `portfolio.json`, and the next export wrote it to disk | ✅ fixed (session 7) — version-aware draft envelope + recovery screen; regression-tested against the truth file |
| 22 | Media required a click to play | "Load embed" facades read as broken on a phone and put a click between a person and the work | ✅ fixed (session 7) — unified `useInView` load/play lifecycle, no facades anywhere |
| 23 | Focus Mode was unusable for portrait media | oversized white canvas, stretched Reels, nested scrollbar | ✅ fixed (session 7) — `MediaFocus` sizes the box from the item's aspect before rendering |
| 24 | A window dragged under the menubar was unrecoverable by hand | its title bar — the only grab handle — went with it | ✅ fixed (session 7) — top edge only is clamped via controlled positioning; left/right/bottom stay free |
| 25 | Instagram embeds still fail for reasons outside the site | private accounts, ad blockers, rate limits | ⬜ accepted — best-effort embed, then an honest cover + "View original post". Not scraped, not faked |
| 26 | Studio cannot write binary media into `public/` | files must be added to the repo by hand | ⬜ accepted — a browser cannot write to the repo; the Studio says so rather than pretending |
| 27 | **The Studio had no error boundary at all** | one throw in any panel unmounted the React root and left a white page, with the cause only in the console — this is what blanked *Desktop & dock* | ✅ fixed (session 8) — `StudioBoundary` per section and per panel; 6/6 sabotaged sections contained |
| 28 | Repeater's **Duplicate** cloned the id | two rows sharing one id: invalid content, ambiguous references, duplicate `<option>` values | ✅ fixed (session 8) — the copy gets `<id>-copy`, uniquified |
| 29 | **No base `.smart-image` CSS existed** | images inside media frames never filled their box and `objectFit` was inert — the hidden cause under most "the images look wrong" reports | ✅ fixed (session 9) — scoped rules in `media.css` for `.media-fill` and `.smart-image--natural` |
| 30 | Gallery was a type you could pick but not create | the Studio demanded at least one image and gave you no way to add one | ✅ fixed (session 9) — Image → "Add another image", preserving the first picture |
| 31 | Two identical "Auto" entries in the aspect dropdown, neither of which measured anything | Reels stretched, squares letterboxed, and the two options were indistinguishable because they were the same | ✅ fixed (session 9) — `media/aspect.ts`, one Auto, real intrinsic ratios |
| 32 | The case-study hero was guessed from `featured` / list order | one flag doing two jobs; reordering media silently changed the top of the page | ✅ fixed (session 9) — explicit `heroMediaId`, with **None** as a real answer |
| 33 | Websites were embedded in an iframe | the live designersandus.com item rendered as a blank rectangle — as nearly every real site will | ✅ fixed (session 9) — URL + author screenshots + "Visit Website ↗"; `iframe` is inert for websites |
| 34 | Custom desktop icons were shrunk onto a raised tile and tinted | a carefully made transparent PNG came out as a smudge on somebody else's button | ✅ fixed (session 9) — artwork drawn bare at 72px; the tile is now only the monogram/glyph fallback |
| 35 | Round-trip safety was verified by hand each session | every schema change re-opened a question that had already been answered | ✅ fixed (session 9) — `npm run check:content` (`scripts/roundtrip.mjs`), 7 checks |
| 36 | **No custom font file has been chosen** | the typography roles ship at their built-in defaults, which is a legitimate finished state, but the custom-font path is exercised only by the legacy `secondary` (Lato) | 🟡 partial (session 11) — the system is in place and one file is enough to start: drop a `.woff2` in `public/fonts/` and set it as the shared font in Studio → Appearance → Typography. A role can then be given a face of its own without touching the others |
| 37 | **Session 9 has not been seen on screen** | gallery flow, masonry, Focus Mode, bare icons and Drive playback are all unverified visually | ⬜ open — human QA needed (session 10 adds to this, not replaces it) |
| 38 | **`#/studio` rendered a giant poster over the whole editor** | the portfolio was uneditable; the route looked broken when it never was | ✅ fixed (session 10) — `.studio-hero-preview` was missing `position: relative`, so the hero picker's `position: absolute; inset: 0` image escaped to `.studio` (`fixed; inset: 0`). Asserted in `check:ui` |
| 39 | One Focus Mode layout was forced onto every shape of media | a 16:9 player came out small inside an enormous dark rectangle; Reels and posts got the same box | ✅ fixed (session 10) — `media/focusLayout.ts`: portrait / balanced / landscape from the resolved ratio, side-by-side or stacked from the viewport |
| 40 | The Focus caption hung outside the composition | it sat under the media, drifted beneath the dock, and pushed the arrows around | ✅ fixed (session 10) — the caption lives inside the information region in every layout; that region scrolls, the media never does |
| 41 | Generic desktop icons were still drawn on raised tiles | gap 34 unplated the *artwork* only, so a desktop showing both read as two different systems | ✅ fixed (session 10) — folders, documents, PDFs, notes and monograms are marks at the same 72px footprint; `tint` colours the letters |
| 42 | A desktop shortcut would not drag from the middle of its PNG | Chrome started a native image drag instead — a ghost over the widgets, and the icon stayed put | ✅ fixed (session 10) — the image is inert (`draggable={false}`, `pointer-events: none`); the `.dicon` button owns the gesture |
| 43 | **Session 10 has not been seen on screen** | the Studio fix, all three Focus layouts and the icon/drag changes are verified by script and by reasoning, not by eye | ⬜ open — human QA needed |
| 44 | **Focus Mode was covered by the menu bar** | the overlay claimed to be modal and was not: the menu bar sat on top of it, and the obvious fix (a bigger number) could not work | ✅ fixed (session 11) — `.window` has `isolation: isolate`, so the overlay's z-index never left the window. `MediaFocus` portals to `document.body` at the new `--z-focus` (1150). Asserted in `check:ui` |
| 45 | The Focus arrows sat on top of the title and caption | they covered the words they were meant to navigate, and on an Instagram or YouTube iframe they were unreachable | ✅ fixed (session 11) — `focusPlan()` reserves a gutter at each edge and `.focus__layout` pads by the same amount; the arrows centre inside their own empty lane. Space, not z-index |
| 46 | Every media item showed the **project's** title as its own | ten images in one project read as ten copies of the same thing, and a photograph's real name had nowhere to live | ✅ fixed (session 11) — optional `media.title`, no fallback. No title means no title; project · company · year survive as one quiet context line |
| 47 | Typography could only be swapped, never tuned | two fonts at the same `font-size` render visibly different sizes, and there was no way to correct for it | ✅ fixed (session 11) — one custom file, Display / Heading / Body roles with size · weight · letter spacing · line height each, plus a global type scale that touches type only |
| 48 | **Quick View → Explore OS was a dead end** | the one route a visitor is invited to take back to the desktop did nothing; it looked like a local-dev artefact and was not | ✅ fixed (session 11) — `App.tsx` applied the hash on every `view` change, so `setView('desktop')` was immediately overwritten by a re-read of the unchanged `#/quick`. An `appliedRoute` ref applies a route once |
| 49 | **Session 11 has not been seen on screen** | the portal, the gutters, the media titles and every typography default are verified by script and by reasoning, not by eye | ⬜ open — human QA needed (see the checkpoint) |

---

## 5. Decisions already made — do not re-litigate

- **Portfolio first, OS second.** If a change makes the OS more impressive but the work less
  visible, it is wrong.
- **The Work grid is art-directed by data.** Tile size/shape comes from `project.tile`, not
  from a uniform card component. Do not make every project the same rectangle.
- **Projects open as a large stage**, hero media first — never a small popup.
- **Colour comes from the project imagery.** The chrome stays black / off-black / white /
  warm white / grey with subtle transparency. The old orange-and-neon HUD palette is gone
  and is not coming back.
- **Monospace is never the dominant font.** No uppercase mono pills, no fake technical
  jargon, no decorative code text.
- **No long boot animation.** A wordmark, briefly.
- **Hash routing**, not history routing. GitHub Pages 404s on refresh otherwise.
- **`base: './'`** in Vite. Do not hardcode a repo name.
- **The Studio cannot publish.** Export-a-file is the deliberate design, not a limitation to
  "fix" with a GitHub token in the browser.
- **JSON, not TS**, for content — editable without touching React.
- **No percentage skill bars**, and no invented percentage metrics anywhere.
- **Demo content is flagged `demo: true`** and labelled in the UI. Never present an invented
  number as a real achievement. Never invent CV details.
- **Light is the default theme**, dark is a choice. `settings.theme.default` decides what a
  first-time visitor sees; `allowToggle` decides whether they may change it. Theme changes
  **cross-fade** — both wallpaper layers stay mounted and swap opacity. Never hard-cut.
- **The accent is a soft light blue** (`--c-accent`), not orange. It marks active states,
  focus rings and selection only. The chrome stays neutral; colour comes from the work.
- **Desktop positions are generated, not authored.** A seeded scatter places every icon and
  widget (same layout every visit, but not grid-locked); dragging overrides it and persists;
  icons wrap around the edges rather than hitting a wall. `x`/`y` in the content file is an
  advanced override, and the Studio never asks anyone to type coordinates.
- **Windows drag off-screen, and that is the point** (session 6). `<Rnd>` has no `bounds`,
  and geometry is only clamped while a window is *maximised*. The desktop is an unbounded
  workspace: a window can sit half or wholly past any edge and stay there. Windows do **not**
  wrap to the opposite side — that is icon behaviour, not window behaviour. The clamping that
  remains is on **spawn** only, so a newly opened window is always visible. Recovery is Tidy
  (⌃T), maximise/restore, the dock entry, and Reset desktop. Re-adding `bounds="parent"` or
  an unconditional clamp effect re-creates the "viewport is a wall" bug.
- **The Studio PIN is a privacy gate, not authentication.** This is a static site: the PIN is
  in the bundle. Do not "improve" it with a backend or real auth — if content must be
  protected, edit `portfolio.json` locally and deploy a build without the editor.
- **The Studio is reachable only by URL** (session 6). `#/studio` always works and renders
  full-screen behind the PIN gate; the Studio appears nowhere in the portfolio UI — no dock
  icon, no desktop icon, no menu-bar item, no Quick View link, no command-palette result, no
  search result. It is not in `registry.tsx` or `APP_IDS` at all, so it cannot leak back in.
  **There is no `settings.showStudio` any more** and there should not be one: the flag's only
  remaining effect would have been to break `#/studio`, which is the opposite of the intent
  (hidden from visitors, reachable by address). Old content files carrying the key still
  validate, because `z.object()` strips unknown keys.
- **About has no counters.** It is where a person speaks, not where the site reports on
  itself. The stat cards were removed deliberately and are not coming back.
- **The dock is for things worth launching.** Contact lives in the menu bar. The creative-app
  icons on the right are jokes that open an alert — they are not, and will not become, real
  launchers.
- **No Next.js, no backend, no analytics, no feature creep** (3D worlds, AI assistants, fake
  terminals, weather widgets, music players, calendars, auth or CMS).
- **One game, and only one** (session 6; this supersedes the blanket ban on games that stood
  in this section through session 5). The
  `reaction` widget — press start, wait for blue, press again, read the milliseconds — was
  requested explicitly and is deliberately scoped: no levels, no sound, no leaderboard, no
  network, no extra dependencies, no animation beyond a colour change, and it never leaves
  its own card. **Do not remove it in a future cleanup pass, and do not let it grow.** Any
  *second* game is still out of scope.
- **The startup animation is a product start-up, not a boot screen** (session 6). A wordmark
  that settles, a hairline that fills once, ~900ms, then a cross-fade onto a desktop that has
  already mounted underneath. No terminal text, no boot logs, no percentages — none of it
  would be true, because the app is already loaded by the time it appears. Skipped entirely
  under `prefers-reduced-motion`, and any key or click ends it early.
- **Media plays by itself; artwork is never a link** (session 7). No "Load embed" button, no
  play facade: media loads as it approaches the viewport and plays muted and inline when it
  is on screen. The tile is not a button — wrapping one nested `<video>` and cross-origin
  `<iframe>`s inside a `<button>`, swallowed clicks meant for the player's own controls, and
  let a stray click leave the site. Focus Mode is entered through an explicit affordance.
  Do not reintroduce a facade, and do not make the artwork clickable-to-navigate.

- **`demo` means one thing and is never a validation escape hatch** (session 7). It means
  *this project or media is fictional placeholder content*, and it renders a visible
  "Sample" badge. It has never let an incomplete item pass validation and must not be made
  to. If something is missing, `mediaProblem()` names the field. The Studio and the schema
  call the same function precisely so the two can never drift.

- **The Studio never claims to write files it cannot write** (session 7). It is a browser
  app on a static site: it cannot put binary media into `public/` or commit to the repo. It
  tells people where to put the file instead. Do not build an uploader that pretends
  otherwise.

- **Instagram is embedded, never scraped** (session 7). Official `embed.js`, best effort,
  6s timeout, then an honest cover plus "View original post". No private APIs, no raw-video
  extraction, and autoplay success is never faked.

- **Three window edges are free, one is held** (session 7). Left, right and bottom stay
  completely unbounded — that is the infinite workspace, and it is settled. The top is
  clamped because a window dragged under the menubar takes its title bar, the only grab
  handle, with it. The clamp is done with controlled positioning (`updatePosition` in
  `onDrag`), **not** the `bounds` prop, which walls all four sides and was the original bug.
  Do not restore `bounds`. Do not add `win.y` to the mount clamp's dependency array.

- **A saved Studio draft must prove its provenance** (session 7). Drafts carry
  `{ baseSignature, savedAt, draft }`. "It validates" is not evidence that a draft is
  current — that assumption is what lost content. When the signature doesn't match, the
  Studio asks; the safe option is the default, and the old draft can always be downloaded
  first. Never make the destructive choice the primary button.

- **The Studio renders the draft before validating it, so it must never render without a
  boundary** (session 8). Showing the live draft unvalidated is deliberate — you cannot fix a
  value you cannot see, and `api.validation` reports rather than gates. The consequence is
  that a panel can be handed a shape the schema would reject, and before session 8 that threw,
  unmounted the React root and left a white page with the cause only in the console. Every
  `Section` and every panel is now wrapped in `StudioBoundary`. **Do not remove those, and do
  not "simplify" a panel by assuming a schema default is present at render time** — the
  default is applied by validation, which has not necessarily run on what you are drawing.
  A failure should name itself on screen; it should never be a blank page.

- **There is exactly one "Auto", and it measures the media** (session 9). Auto is the
  *absent* `aspect` field, and it means the media's real intrinsic ratio — `naturalWidth /
  naturalHeight`, `videoWidth / videoHeight`, or the cover image where the embed is opaque.
  `media/aspect.ts` is the only place that decides this. The string `'auto'` is still
  accepted for backward compatibility and `isAuto()` treats it identically, but nothing
  writes it. Do not reintroduce a second way to say automatic, and do not let "auto" quietly
  mean 16:9 again — that is what stretched every Reel.

- **Containers do not decide sizes before asking the content** (session 9). The hero, Focus
  Mode and the media layout all size themselves *from* the media. `MediaFrame`'s `fill` means
  "content sizes it". Do not put a fixed `aspect-ratio` back on `.case__hero`, do not give
  Focus Mode a panel with the media poured into it, and do not replace the masonry packing
  with CSS-grid rows — each of those produced the blank bands and holes that were reported.

- **Websites are linked and screenshotted, never framed** (session 9). Nearly every real site
  refuses to be embedded, and the ones that don't show up as somebody else's cookie banner
  inside the portfolio. A website item is a "Visit Website ↗" link plus the author's own
  screenshots. `iframe: true` survives in the schema so old content validates and is inert
  for websites. Do not "fix" this by trying the iframe again.

- **Google Drive playback is Google's, and we say so** (session 9). Drive video is their
  cross-origin player in an iframe: autoplay is **not** guaranteed, it cannot be started from
  outside, and the file must be shared so anyone with the link can view it. A Drive share URL
  is not a video file and is never used as a `<video src>`. Do not write copy that promises
  autoplay, and do not add a cover that pretends to be a play button.

- **Three separate concepts, three separate controls** (session 9). The **Work grid tile**
  (`project.tile`) is the card; the **project hero** (`project.heroMediaId`) is the one item
  at the top of the case study, with **None** as a real answer; **project media** is the body
  below the writing, where `featured` means only "full-width row". Do not re-infer the hero
  from `featured` or from list order — that conflation is what made reordering media silently
  change the top of the page.

- **Custom icon artwork is drawn bare** (session 9). 72px, `object-fit: contain`, no plate
  behind it, no tint over it, nothing clipping it: a transparent PNG must look on the desktop
  exactly like it looks in the file. The raised tile is the *fallback* container for
  monograms and generic glyphs, and `icon.tint` colours only that. Do not put artwork back on
  the tile, and do not return "Fallback tint" to normal icon editing.

- **Fonts are files you own** (session 9). `settings.typography` is two fonts — primary and
  secondary — loaded from `public/` via the `FontFace` API. **No Google Fonts and no font
  service**, so the site renders the same offline and in five years. Nothing configured means
  the native system stack, which is a legitimate final answer and part of why this reads as
  an OS. Do not add a third or fourth font role, and do not add a CDN.

- **`generative` is deprecated but not deleted** (session 9). It is gone from the Studio
  picker and the user-facing guide, and still in `mediaTypes` with a working adapter. Four
  live items use it; removing the enum value would fail validation on every file containing
  one. Do not delete it in a cleanup pass.

- **Round-trip safety is a committed check, not a memory** (session 9). `npm run
  check:content` runs `scripts/roundtrip.mjs`. Run it after **any** schema change. New fields
  stay `.optional()` rather than `.default()` so an untouched export gains no keys — that is
  what keeps the no-edit round trip byte-identical.

- **Focus Mode is the top application layer, and it gets there by portalling** (session 11).
  `--z-focus: 1150` sits between the command palette and the boot cover, and `MediaFocus`
  renders through `createPortal(overlay, document.body)`. The portal is not a style choice: any
  overlay rendered inside `.window` is trapped by its `isolation: isolate`, so a z-index set
  there competes with that window's children and nothing else. **If the menu bar ever shows
  through Focus Mode again, the portal is what broke — do not reach for a bigger number, and do
  not remove `isolation: isolate`, which is what fixes the backdrop-filter corner artefact.**

- **The Focus arrows are given space, not priority** (session 11). `focusPlan()` reserves a
  gutter at each edge and the layout pads by the same amount, so the arrows sit in their own
  empty lane. Raising their z-index was tried in principle and rejected: it puts the arrow in
  front of the text instead of behind it, which is the same collision with better manners. On a
  cross-origin iframe it does not even do that.

- **A media item's title is its own, or it has none** (session 11). `media.title` is optional and
  **never** falls back to `project.title`. Ten images in one project are not ten items called
  the same thing, and a project name rendered as an item's heading is a lie about what you are
  looking at. Project · company · year remain available as one quiet context line, and project
  context alone does not earn an information panel.

- **Three roles. A typeface each. One scale.** (session 11) `settings.typography.font` is the
  *shared* face — one file in `public/fonts/`, used by DISPLAY / HEADING / BODY alike — and any
  role may override it with a `font` of its own, which is what pairs a display face with a
  different text face. Precedence is the CSS cascade, not logic in the hook: the loader writes
  both `--font-custom` and `--font-custom-<role>`, and the tokens read
  `var(--font-custom-<role>, var(--font-custom, <native stack>))`. Rejected on purpose: ZIP
  upload, font-family folder scanning, per-weight file slots, multi-file family management,
  automatic weight-file mapping. Those add up to a font manager, and a portfolio does not need
  one; a variable font supplies the weights and a static one is handled by the browser. One file
  per role is a typographic choice, four files per role is inventory. **No Google Fonts, no font
  CDN, no external service** — ever. Configure nothing and the site looks exactly as it did:
  every role default is the value the CSS already used, and none of the `--font-custom*`
  properties is declared in CSS, so `var()` falls through to the native stack. Declaring them
  empty would be worse than useless — an empty custom property makes `font-family` invalid at
  computed-value time instead of falling back, which costs the page its font.

- **Typography is three global roles, not a per-component panel** (session 11). Buttons, menus,
  individual captions and single projects do not get their own font settings. Component-level
  exceptions stay in CSS where they were already necessary — `.media-frame__title` is the
  heading role at `× 0.72` because a full-size heading inside a two-column masonry caption
  shouts over the work.

- **The global type scale scales type and nothing else** (session 11). It multiplies every
  `--fs-*` token and every role size. It cannot move spacing, radii, icons, the dock, windows or
  button geometry, because those are px values on their own scales — and `check:ui` asserts that
  `--fs-*` is only ever spent on `font-size`, which is what makes that guarantee true rather than
  merely intended.

- **A hash is a navigation event, not a lock on the view** (session 11). `App.tsx` applies each
  route exactly once, via an `appliedRoute` ref. Before that, the hash→state effect depended on
  `view`, so any `setView` re-ran it, the effect re-read the unchanged hash, and it put the old
  view straight back — which is why "Explore the OS" did nothing from `#/quick`. Deep links,
  refreshes and Back/Forward all still work, and navigation stays SPA: **no reload.**
---



### The desktop has collision, and deliberately no grid

Icons are **freely positioned**, and that is the whole point of the surface — it is meant to read
as somebody's real desktop, hand-arranged, not as a launcher. Session 12 added a protected area
around every item so two of them cannot sit on top of each other. It did **not** add a grid, and
the next pass must not "finish the job" by adding one:

- A drop that is legal is stored **exactly as dropped**, to the pixel. Nothing is rounded to a
  step, snapped to a cell, or aligned to a neighbour. `check:ui` 16 asserts this with a
  deliberately un-round coordinate, and 18 fails the build on the mere presence of
  `snapTo|GRID_|CELL_|gridSnap` in the hook.
- A drop that lands inside somebody else's protected area moves to the **nearest free spot
  relative to the attempted drop** — not back to where it started, and not to a tidy slot. It
  should feel like the neighbour made room.
- Collision is checked **on drop only**. Dragging an icon across the desktop passes freely over
  everything; forbidding that would make the gesture feel like it was fighting back.

And one ordering rule that is easy to get backwards: a **saved** position (the visitor dragged it)
is never rewritten, at any viewport, even when it overlaps — that is what makes a layout saved
before this feature existed still load exactly as it was left. An **authored** position (`x`/`y` in
`portfolio.json`) is only a preference and *is* resolved, because no author can pick coordinates
that clear their neighbours at every window size. The two widgets shipped 21% apart genuinely
overlapped at 1280×720 before this pass.

## 6. Session log

### Session 11 · 2026-09-19 · Focus Mode, media titles, typography, Quick View

A targeted refinement pass. Nothing already finished was rebuilt, and the Instagram embed was left
exactly as Instagram ships it — header, account name, "Original audio", "View profile" and all.
Those are the embed's own controls; removing them means scraping, and this site does not scrape.

**Focus Mode now sits above the entire OS.** Two independent things were wrong in the same place.
The token scale was fine (`--z-sheet` 1000 already outranked `--z-menubar` 950) but `.window` has
`isolation: isolate`, so the overlay's z-index never left the window it was rendered in. The fix is
`createPortal(overlay, document.body)` plus an honest `--z-focus: 1150` token. The aspect-aware
layout from session 10 was kept and refined, not redesigned: portrait puts information left and
media right, landscape stacks media above information, balanced decides by viewport width, and a
phone gets one column with the media first.

**The navigation arrows were moved out of the content, not on top of it.** `focusPlan()` now
reserves 64px (44px under 720px wide) at each edge and returns it in the plan; `.focus__layout`
spends exactly that as horizontal padding. The arrows centre themselves inside their own lane, so
they cannot cover a title, a caption or an iframe — and when there is only one item the gutter is
zero and the media gets the width back.

**Media items have their own titles.** `media.title` is optional, editable in the Studio, rendered
in Focus Mode and in the frame caption, and it never falls back to the project title. The
information hierarchy is title → caption → tools → credit → external action, with no empty
headings; project · company · year is one quiet line at the bottom.

**Typography became a system instead of a swap.** Three roles — DISPLAY / HEADING / BODY — each with
its own typeface plus size, weight, letter spacing and line height, over one global scale. A shared
font covers all three, and any role can override it with a face of its own, resolved by a three-level
token chain rather than precedence logic in the hook. Every default is the value the stylesheet
already used, so an unconfigured site renders identically — verified by the fact that the role tokens
resolve to the same `--fs-*`, weights and tracking the anchors had hard-coded.

**Quick View → Explore OS was a genuine routing bug, not a localhost artefact.** `App.tsx` applied
the hash on every `view` change; `setView('desktop')` re-ran the effect, the effect re-read the
unchanged `#/quick`, and it set the view back. An `appliedRoute` ref applies a route once.

`npm run lint` clean · `npm run build` clean · `check:content` 7/7 · `check:ui` 15/15 (five new).

**Still needs eyes:** Focus Mode over a real Instagram embed in portrait, a 16:9 YouTube item, an
item with no title at all, a real font file in `public/fonts/` as the shared face plus a second one on
one role only (the other two must keep the shared face), the type scale at 85% and
120%, a deliberately wrong font path, all three Quick View entry paths, and a phone.

### Session 10 · 2026-09-18 · stability, Focus Mode, desktop icons

Three areas, deliberately narrow. The larger pending feature pass was **not** started, and no
unrelated area was redesigned.

**The Studio regression was never a routing bug.** `#/studio` showed a giant generated poster
covering the editor, which looks exactly like a broken route, so the first job was to refuse to
guess. Static reading exonerated `App.tsx`, `useHashRoute`, `StudioApp` and `PinGate`; a
brace-balance check exonerated the stylesheets; and an esbuild-bundled SSR harness rendering the
real app against the real content proved the route positively — `#/studio` produced `PinGate`
with no desktop, no menu bar and no window chrome, and with the unlock present `StudioApp`
rendered every panel without throwing. That left CSS, and the cause was one missing word.
Session 9's hero picker renders `<MediaRenderer mode="card">`, card mode hands back a **bare**
`<SmartImage className="media-fill">`, and `.media-fill` is `position: absolute; inset: 0`.
`.studio-hero-preview` had `aspect-ratio` and `overflow: hidden` but no `position: relative`,
so the image resolved its containing block against `.studio` (`position: fixed; inset: 0`) and
covered the viewport. `overflow: hidden` does not rescue that: a clipper only clips descendants
whose containing block is inside it. The image itself was the `Poster` fallback, because
`media/gaf/gaf-hero.jpg` does not exist in `public/` — which is also why SSR never showed it,
the fallback being an `onError` path. One-line fix, plus a comment stating the mode contract:
**a container that renders `card` or `focus` media owes it a containing block.**

**Focus Mode's problem was one layout doing three jobs.** A 9:16 Reel and a 16:9 player have
nothing in common, and the box that suits the first makes the second small inside an enormous
dark rectangle. The decision is now pure and lives in `media/focusLayout.ts` — resolved ratio
plus real viewport in, arrangement and exact pixel box out — so it is assertable with numbers
instead of a browser. Portrait goes side-by-side, landscape never does, balanced follows the
viewport width, and anything under 1024px stacks. Only the presentation changed: the adapters,
the load/play lifecycle, the Instagram embed behaviour and the external-link rules are
untouched. The caption moved *inside* the information region, which is what fixed it hanging
beneath the dock.

**Both icon problems came from treating decoration as structure.** Session 9 unplated custom
artwork but left the generic glyphs on raised tiles, so a desktop showing both read as two
different systems; and the `<img>` was left natively draggable, so pressing in the middle of a
PNG started Chrome's own image drag — a ghost over the widgets, the pointer stream to
`useDesktopLayout` cut, and the shortcut motionless. The fixes are symmetrical: everything is a
mark at the same footprint, and the image is inert so the button owns the gesture. The drag
logic itself was not touched.

`scripts/check-ui.mjs` (`npm run check:ui`) pins all three, in the same plain-Node style as the
existing round-trip script rather than by installing a test runner.

### Session 9 · 2026-09-18 · content presentation, media, Studio UX

A targeted pass driven by hands-on testing with real content — **not** a redesign, and no
approved visual decision was revisited. Full detail is in the checkpoint at the top of this
file; the short version is that most of the reported problems turned out to be one of three
underlying causes rather than sixteen separate bugs.

**Cause one: nothing owned "automatic".** Aspect ratio had two identical "auto" entries in
one dropdown (an empty placeholder *and* a literal `'auto'` value), and neither actually
measured anything — "auto" fell through to a fixed 16:9. So a portrait Reel was stretched, a
square was letterboxed, and the person editing could not tell the two options apart because
there was nothing to tell apart. `media/aspect.ts` now holds the single definition, and Auto
means the media's real dimensions.

**Cause two: containers decided sizes before the content was consulted.** `.case__hero` was
a hard `aspect-ratio: 16/9`; Focus Mode was a fixed panel with the media poured into it;
`MediaGallery` was a CSS-grid of rows. All three produce the same class of symptom — blank
bands, holes, stretched media — and all three were inverted to let the content size the box.
Underneath them sat a genuine latent bug: **there were no base `.smart-image` CSS rules at
all**, so images in media frames never filled their boxes and `objectFit` was inert.

**Cause three: one flag doing several jobs.** `featured` meant both "hero" and "full-width
row"; the first media item was implicitly the hero; `gallery` was a type you could pick but
not create. Each of these is now a separate, named thing — `heroMediaId`, `showHeroInMedia`,
`featured`, and Image→"Add another image".

Also: `drive` media, typography from local font files (no Google Fonts), theme-aware icons
drawn bare, `generative` retired from the Studio, and the session-7 round-trip verification
committed as `scripts/roundtrip.mjs` so it stops being something each session re-derives.

**`src/content/portfolio.json` was modified, deliberately:** one `heroMediaId` per project,
set to whatever the old implicit rule would have picked, so nothing moved on screen.
`backup/portfolio.TRUTH.json` was not touched.

**Not done, honestly:** nothing in this session has been seen on screen. `public/fonts/` does
not exist and no font file was invented, so the typography feature ships unexercised.

### Session 7 · 2026-09-17 · data integrity, Studio, media, window usability

A targeted pass, explicitly **not** a redesign — no visual decisions were revisited.

**The data loss was diagnosed, not assumed.** The brief flagged a stale draft as *likely*
but told me not to take it on faith, so the schema was ruled out first: the truth file
through `validatePortfolio()` produced 23 differences, **all additive, none dropped** — Zod
materializing `.default()` values. That cleared the schema and left `useDraft.ts`, which
restored any draft that merely *validated*. An old draft validates perfectly; it is just
old. Drafts are now version-aware envelopes with a three-case recovery screen whose safe
option is the default.

Verified with a regression suite rather than by inspection: no-edit round trip drops zero
fields, the export is a fixed point under re-import, and a single-field edit produces
exactly one diff. `demo: true` was confirmed unable to rescue an empty video or Instagram
item.

Media was unified: one `useInView` lifecycle (latched `near` to load, live `visible` to
play), every facade removed, Focus Mode rebuilt to size its box from the item's aspect
*before* rendering — the old `max-height: 80vh; overflow: auto` panel was the single cause
of the white canvas, the stretched Reels and the nested scrollbar. The Media window had the
same class of bug (duplicate caption, forced 16:9 around portrait) and was fixed the same
way. The tile-wrapping `<button>` was removed, so artwork can no longer navigate away.

The window top edge is clamped via controlled positioning; the other three edges were left
completely free, as required.

`src/content/portfolio.json` was not modified. `backup/portfolio.TRUTH.json` was read for
comparison only and remains untouched; the two are byte-for-byte identical.

**Not done, honestly:** `public/icons/blender.png` does not exist — `public/icons/` contains
only `app-icon.svg`, `favicon.svg` and `og-image.svg`. No Blender icon path was applied and
none was invented. Nothing in this session has been seen on screen; human QA is the next
step.


### Session 1 — 2026-09-14 (cut off)
Built the whole application from the original brief: design tokens, window manager, desktop
shell, boot sequence, command palette, 10 window apps, media adapters, Quick View, mobile
shell, content schema + demo content, deploy workflow, SEO head.
**Cut off while building the Studio.** No docs were written.

### Session 2 — 2026-09-14
Audited the repo and **fixed the broken build**: wrote the six missing Studio panels plus
`parts.tsx` and `studio.css`; installed `@types/node`; added `APP_IDS` to `state/os.ts`;
fixed `Repeater`'s generic with `NoInfer<T>` (cause of all 8 type errors); fixed
`manualChunks` (431 kB → 221 kB main chunk); created `public/icons/`; wrote all four docs.

### Session 3 — 2026-09-14
`npm run dev` served every module 200. Browser automation was unavailable, so on-screen QA
stayed a human step. Substituted an SSR render test: all six panels + `ExportPanel` +
`StudioApp` mounted with `react-dom/server`. **8/8 rendered.**
Worth knowing: desktop entries live at **`desktop.items`**, not `desktop.icons`.

### Session 4 — 2026-09-14 — visual redesign
The client rejected the previous look ("a fictional AI-generated operating system concept")
and issued a final creative direction: portfolio first, work as hero, believable premium OS
chrome, no design questions. Architecture, content system, window manager, Studio, Quick View
and deployment were all kept. What changed:

- **`ProjectsApp.tsx` rewritten** as the irregular editorial Work grid, plus new
  `apps/work.css` (12 columns, container queries). Added `tile: { span, aspect }` to
  `ProjectSchema` to drive it.
- **`ProjectApp.tsx` rewritten** hero-media-first; `useOpenTarget.ts` gained `stageBox()` so
  projects open large and centred.
- **Full rewrites:** `tokens.css` (names kept, values replaced — neutral palette, system
  sans, no neon), `window.css`, `os.css`, `chrome.css` (dock is now a floating pill),
  `MenuBar.tsx` (Work/About/CV/Contact nav), `Desktop.tsx` (**hero splash plate deleted**),
  `Wallpaper.tsx`, `BootSequence.tsx`, `Poster.tsx` + `poster.css`.
- **De-badged** `.tag` and `.demo-badge`; `.mono` no longer uppercases; grain opacity
  0.24 → 0.05.
- **`portfolio.json` rewritten:** real name, Dubai, real email and phone, real CV path,
  **7 real experience entries from the CV**, `metrics: []` everywhere (all invented
  percentages deleted), sample prose explicitly labelled, `tile` on all 10 projects,
  15 desktop icons → 8 in a tidy grid, 3 auto-opens → 2 (Work dominant + one small note),
  `seo.url` omitted to kill the `example.com` placeholder.
- **`Asaad_CV.pdf` detected and wired** — copied to `public/cv/Asaad_CV.pdf`.
- **`instagramUrl`** added to `MediaItemSchema`; `InstagramMedia.tsx` now prefers it and
  offers "View original post" when the embed fails.
- **Dead code removed:** ~265 orphaned lines of explorer/file-row CSS from `apps.css`
  (proved dead by grep across all `.tsx` first — the only hit was a comment).
- **Verified:** `npm run build` green (1855 modules, 9.73s) and the rewritten
  `portfolio.json` validates against `PortfolioSchema` via a throwaway Vite SSR script
  (not committed — recreate it with `createServer` + `ssrLoadModule('/src/types/content.ts')`
  if you need it again).

**Left undone:** mobile shell and Quick View CSS still use the old visual language (gaps
#12, #13); nothing has been looked at on screen (gap #11); the Studio has no field for the
new `tile` / `instagramUrl` keys (gap #14).

### Session 5 — 2026-09-16 — refinement pass
Client brief: more premium and Apple-inspired in finish, calmer, slightly more personal.
Architecture, Studio, content system and window manager all kept. What changed:

- **Theme system.** `settings.theme` (`default`, `allowToggle`, `wallpaperLight`,
  `wallpaperDark`). New `hooks/useTheme.ts` writes `<html data-theme>`; `tokens.css` rewritten
  with a full light palette as `:root` and dark under `[data-theme='dark']`. Accent moved from
  orange to a soft light blue. `Wallpaper.tsx` keeps both layers mounted and cross-fades them.
- **Window corner artifact fixed.** Root cause: `backdrop-filter` creates its own backdrop
  root, which is *not* clipped by a rounded ancestor's `overflow: hidden`. Fix is three-part
  and documented in the header of `window.css` — round the react-rnd wrapper (`.window-rnd`),
  `isolation: isolate` on `.window`, and round the bar and body themselves.
- **Living desktop.** New `hooks/useDesktopLayout.ts` owns every icon and widget position:
  seeded scatter → authored `x`/`y` override → dragged position from localStorage, with
  wrap-around at the edges and a click/drag threshold so dropping never opens.
- **New desktop furniture.** `DesktopWidget.tsx` (clock + note, no network), `AlertApp.tsx`
  plus a root-level `alerts` array (Photoshop / After Effects / Blender / VS Code jokes),
  `desktop.dockLinks` for Email / LinkedIn / Instagram opening in a new tab, and
  `DesktopTarget` variants `external` and `alert`. Custom icon images/monograms via
  `IconSchema` on folders, projects and desktop items.
- **About rewritten** on a new `profile.aboutPage` (lede, statement, paragraphs, portrait,
  images, lists, footnote). **The stat cards are gone.** Contact rewritten on
  `profile.contact` — fixes the duplicated "Open to open to…" line.
- **Studio kept whole and made clearer.** Nav grouped (Your work / About you / The desktop /
  Publish); new `AppearancePanel`; new `PinGate` (sessionStorage, casual privacy gate, loudly
  commented as *not* security); `Advanced` drawers hide ids and coordinates; ids auto-generate
  from titles; new controls for `project.tile`, `media.instagramUrl`, About and Contact copy,
  widgets, dock links and alerts. Import / export / validation / reset all untouched.
- **Chrome polish.** ⌘K badge removed from Search (the shortcut still works), Contact removed
  from the dock, dock is soft glass, menu-bar theme toggle added — and a matching one on
  mobile. Quick View and mobile retinted to the shared tokens.
- **Verified:** `npm run lint` clean, `npm run build` green (1861 modules, 8.57s), content
  validates, Studio export→import round trip re-validates, `npm run preview` serves `/`,
  `/#/quick` and `/#/studio`.

**Left undone:** no wallpapers yet (gap #15); About copy needs Asaad's own pass (#16); folder
logos (#17); the PIN is the placeholder `2468` (#18); LinkedIn/Instagram URLs are still
placeholders (#8); nothing has been looked at on screen (#11).

### Session 6 — 2026-09-16
Targeted refinement pass, not a redesign. Six asks, all delivered.

- **Wallpapers wired.** The two supplied images were renamed
  `public/wallpapers/light-theme-wallpaper.jpg` and `dark-theme-wallpaper.jpg` — the originals
  had spaces and a typo ("light them wallpaper"), and a space in an asset path is a reliable
  way to break a production build. `settings.theme.wallpaperLight` / `wallpaperDark` point at
  them; `Wallpaper.tsx` was already correct, so the two-layer opacity cross-fade is untouched.
  Both files verified present in `dist/wallpapers/`. Light is still the default.
- **Windows drag off-screen.** `bounds="parent"` removed from `<Rnd>`, and the effect beside
  it now clamps geometry only while a window is maximised. Those two together were the wall:
  even without `bounds`, the effect had `win.x, win.y` in its dependency array and yanked a
  dragged window back on the next render. Spawn clamping in `openWindow()` is untouched, so
  new windows still appear on-screen. No wrap-around. Details in §5.
- **Reaction widget.** New `ReactionWidget.tsx`, `'reaction'` added to `WidgetSchema`,
  rendered by `DesktopWidget`, styled in `os.css`, best score in `localStorage`, selectable in
  Studio → Desktop & dock → Widgets. `pointerdown` rather than `click` so mouse/touch/pen
  share a path and the visitor's own finger-release isn't scored; `stopPropagation()` because
  the card beneath it is draggable. Replaced the `note` widget in the shipped content.
  **This is the one sanctioned exception to "no games" — see §5 before deleting it.**
- **Studio is URL-only and full-screen.** Removed from `registry.tsx`, `APP_IDS` and
  `defaultBox` in `state/os.ts`, `lib/search.ts`, and the dock — there is no `studio` app left
  for anything to reference. `App.tsx` lazy-loads `StudioApp` and returns it *instead of* the
  shell when the route head is `studio`, above every hook so the early return is legal; OS
  hotkeys stand down there, and so does the state→hash effect. `.studio` / `.pin` are
  `position: fixed; inset: 0` at `100dvh`. `settings.showStudio` deleted from the schema and
  its toggle removed from ProfilePanel; old content files carrying it still validate.
- **Real social links.** `profile.email` and `profile.socials` are now the single source of
  truth (`mailto:asaadjalkhi01@gmail.com`, `linkedin.com/in/asaad-jalkhi01`,
  `instagram.com/eng.asaadjalkhi/`). `DockLinkSchema.url` became optional and `dockLinkUrl()`
  in `lib/contentStore.ts` resolves each dock shortcut from the profile, so there is no second
  copy to drift. `openExternal()` now sends `mailto:`/`tel:` to the current tab instead of
  `window.open`, which was stranding an empty tab behind the mail client.
- **Startup animation.** `BootSequence.tsx` rewritten: wordmark settling on opacity + a 1.5%
  scale, a 108px hairline filling once across the whole budget, ~900ms, ending in a 200ms
  cross-fade — and the shell now mounts *underneath* the cover rather than after it, so the
  fade lands on a desktop that has already settled instead of flashing the page background.
  No terminal text, no logs, no percentage. Skipped under `prefers-reduced-motion`; any key or
  pointer press ends it early.
- **Verified:** `npm run lint` clean; `npm run build` green from a cleaned `dist`
  (1862 modules, 2.98s); content validates; a legacy file carrying `settings.showStudio` and
  an explicit dock `url` still validates (key stripped, url honoured); all three social URLs
  resolve through `dockLinkUrl()`; both wallpapers emitted to `dist/`; Studio still splits into
  its own chunk; no Studio reference survives anywhere in the visitor-facing UI.

**Left undone:** nothing in this pass has been seen on screen (#11) — there is still no
browser automation in this environment, so dragging a window off each edge, playing the
reaction widget on a touchscreen (#19), watching the startup animation and getting through
the PIN are all human QA. Project content is still mostly demo (#9), the PIN is still `2468`
(#18), `og:image` is still an SVG (#7), folder logos are still missing (#17).

---

## 7. Keeping this file useful

At the end of any session that changes the project:

1. Update **§2 Health check** with the real result of `npm run build` — never guess.
2. Tick or add rows in **§4 Known gaps**.
3. Add a **§6** entry: what changed, and anything left half-finished.
4. Add to **§5** only when a decision is made that a future session might otherwise undo.

Keep it short. This file earns its place by being faster to read than the codebase.
