# ASAAD.OS — Architecture

How the code is put together, for anyone (human or AI) continuing the work.
For *what is built vs missing*, see [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
For *how to add content*, see [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md).

---

## The one-paragraph version

`portfolio.json` is the entire portfolio. It is validated once by Zod at startup and handed
to the app through React context. A Zustand store owns the shell: which view is showing,
which windows are open, and their z-order. Apps are looked up in a registry, so the window
manager knows nothing about any specific app. Media is dispatched to adapters by `type`, so
no component contains embedding logic. Everything is static — the build output is plain
files, and the only "CMS" is a local editor that hands you a JSON file to commit.

---

## File map

```
src/
  App.tsx                  Root: validate content → boot gate → pick shell → hotkeys → hash sync
  main.tsx                 Mounts <App>

  content/portfolio.json   ALL content
  types/content.ts         Zod schema + inferred types — the contract for the file above
  lib/
    contentStore.ts        Loads + validates content; memoised selectors
    paths.ts               asset() — resolves public/ paths under any base path
    search.ts              Index + scoring for the command palette
    storage.ts             Guarded local + session storage (both throw in private mode)
    utils.ts               cx, clamp, seeded random, moveItem, download, copyText
  state/
    os.ts                  Zustand: view, windows, z-order, palette, cursor, theme, tidy, reset
    portfolio.tsx          Context provider for validated content
  hooks/
    useEnvironment.ts      Viewport size, compact breakpoint, reduced motion
    useHashRoute.ts        Hash routing
    useHotkeys.ts          Declarative global shortcuts
    useOpenTarget.ts       "Open this project/note/app/url/alert" — the one way windows open
    useTheme.ts            Resolves light/dark from content + choice; writes <html data-theme>
    useTypography.ts       Loads the shared + per-role font files; writes the role tokens
    useDesktopLayout.ts    Owns every desktop position: scatter, drag, wrap, persist
    desktopPlacement.ts    Pure collision geometry: protected space, nearest free spot

  components/
    os/                    Boot, Desktop, DesktopIcon, DesktopWidget, Dock, MenuBar,
                           CommandPalette, CustomCursor, Wallpaper
    windows/
      Window.tsx           Chrome, drag, resize, min/max/close, focus
      WindowLayer.tsx      Renders the stack
      registry.tsx         APP REGISTRY — add an app here
      apps/                One component per app
    media/
      MediaRenderer.tsx    Dispatch on media.type
      MediaFrame.tsx       Shared frame: aspect, title, caption, credit, actions
      MediaGallery.tsx     Two-column masonry, shortest-column-first packing
      MediaFocus.tsx       The viewer: aspect-aware composition on a scrim
      focusLayout.ts       Pure: ratio + viewport → portrait / balanced / landscape
      aspect.ts            THE definition of Auto — real intrinsic ratios
      subitems.ts          Gallery images and website screenshots as media
      adapters/            One per media type
      types.ts             AdapterProps — the contract every adapter implements
    quick-view/            Recruiter mode
    mobile/                Purpose-built mobile shell
    ui/                    Btn, Tag, Meta, Field, Toggle, Empty, SmartImage, Poster
  studio/
    StudioApp.tsx          Grouped nav + validation banner
    PinGate.tsx            Casual privacy gate in front of the Studio — NOT security
    useDraft.ts            Draft state, validation, import/export  ← CMS swap point
    panels/                One panel per content area + parts.tsx (form primitives)
  styles/
    tokens.css             Every colour, space, radius, shadow, timing, z-layer
    global.css             Resets, typography, focus, reduced-motion
```

---

## Content model

`src/types/content.ts` is the single source of truth. Zod does three jobs: it *describes*
the shape, it *infers* the TypeScript types (no hand-written duplicates), and it *validates*
at runtime.

Cross-field rules live in a `superRefine` at the bottom and catch the mistakes a plain type
check cannot:

- a project pointing at a folder id that doesn't exist,
- duplicate project ids,
- a desktop icon pointing at a missing folder/project/note,
- a desktop icon pointing at a missing alert id.

`validatePortfolio()` never throws. It returns `{ ok: true, data }` or
`{ ok: false, issues }`, and `App.tsx` renders the issue list as a readable screen. **A
content typo can never white-screen the site.**

Three `disciplines` — `marketing`, `creative`, `digital` — file the work and filter Quick
View. They carry a muted tint each, used sparingly on labels. They are **not** the site's
colour scheme: the chrome is neutral and the colour comes from the project imagery.

Anything invented carries `demo: true` so the UI can label it honestly.

### Adding a field

Add it to the schema as optional, then use it. Existing content stays valid. `.default([])`
on arrays means components never have to null-check them.

Run `npm run check:content` afterwards — the round-trip harness is the thing that proves an untouched
export is still byte-identical. `media.title` (session 11) is the model: one optional string, read in
exactly one place, with **no fallback** to anything else.

**Zod v4 gotcha:** `.default()` takes the *output* type — i.e. the object *after* the inner
defaults have been applied — so `SomeSchema.default({})` will not type-check if the schema
has any required-after-default fields. Use **`.prefault({})`** instead: it takes the *input*
type, which is what "an empty object is fine" actually means. `aboutPage` and
`settings.theme` both use it.

---

## Window manager

`src/state/os.ts`. One Zustand store, no context, no prop drilling.

**Identity.** A window's `key` is derived from its app id plus its payload
(`project|gaf-brand-marketing|…`). Opening the same project twice **focuses the existing
window** rather than stacking duplicates.

**Z-order.** A single incrementing `topZ`. Focusing assigns `topZ + 1`. No sorting, no
reindexing.

**Geometry.** `openWindow` accepts `x`/`y` as either pixels or, if between 0 and 1, a
**share of the viewport** — so `portfolio.json` can describe a composition that scales to
any screen. Everything is clamped on open, so a window can never spawn off-screen.

**Recovery.** Windows can be minimised, maximised (with a stored `restore` box) and
restored from the dock. `tidy()` lays every open window into a grid — the "chaos →
organisation" gesture, and the safety net that rescues anything dragged out of reach.
`resetDesktop()` clears storage and starts over.

**Registry.** `components/windows/registry.tsx` maps `AppId → { label, icon, component }`.
The window manager renders `APPS[win.app].component`. Adding an app is one entry; the
Studio, dock and command palette all read from the same map. The Studio is `lazy()`-loaded
so visitors never download the editor.

---

## Media adapters

The rule: **no component outside `media/` knows how to embed anything.**

`MediaRenderer` switches on `media.type` and renders an adapter. Every adapter receives the
same `AdapterProps` (`media`, `seed`, `discipline`, `mode`, `priority`, `onFocus`) from
`media/types.ts`.

`mode` has three values and they are a contract, not a hint:

| mode | Renders | Who supplies the frame |
| --- | --- | --- |
| `'card'` | bare visual, no chrome | the grid tile |
| `'full'` | wrapped in `MediaFrame` — aspect box, title, caption, credit, Sample badge | the adapter |
| `'focus'` | bare media, **no** frame, title, caption or ratio of its own | the container |

`'focus'` is what makes Focus Mode and the Media window work. Both decide the box *first*,
from the item's own aspect ratio, then render bare media into it. An adapter that adds its
own frame in focus mode re-creates the nested-scrollbar bug described below.

**A container rendering `'card'` or `'focus'` owes the media a containing block.** Bare
adapters are frequently `position: absolute; inset: 0` (`.media-fill`), and CSS resolves that
against the nearest *positioned* ancestor — which, if the container forgot `position:
relative`, is something far up the tree. `overflow: hidden` is not a substitute: a clipper
only clips descendants whose containing block is inside it, so an absolute child that skipped
past the container is not clipped by it. This is not hypothetical; it is exactly how the
Studio broke in session 10, where `.studio-hero-preview` had `aspect-ratio` and `overflow:
hidden` but no `position: relative`, and the hero image escaped to `.studio` (`position:
fixed; inset: 0`) and covered the entire editor. `scripts/check-ui.mjs` asserts the property
for every such container.

#### Playback lifecycle

**Media plays by itself. There is no "Load embed" button anywhere.** The old facades were
an extra click between a person and the work, and on a phone they read as broken.

`hooks/useInView.ts` runs two IntersectionObservers with different jobs:

- **`near`** — `rootMargin: '300px'`, threshold 0, **latched**: it fires once and
  disconnects. This is the *load* signal. A page of ten videos still downloads nothing until
  you scroll towards them, but the one you are about to reach is already buffering.
- **`visible`** — `rootMargin: 0`, threshold `0.35`, **live**. This is the *play/pause*
  signal, and it keeps firing as things scroll past.

Separating them matters: loading should never un-happen, but playing must. If
`IntersectionObserver` is missing the hook fails **open** — everything loads and plays
rather than silently showing nothing.

- **Native `<video>`** → `muted loop playsInline controls`, `preload` driven by `near`,
  play/pause driven by `visible` and `prefers-reduced-motion`. `play()` is always
  `.catch()`-ed; a muted inline video is rarely blocked but a low-power phone will refuse,
  and an uncaught rejection is console noise. The `#t=0.001` media fragment is what nudges
  iOS and Safari into painting a first frame instead of a black rectangle, which is why a
  poster is optional rather than mandatory.
- **YouTube/Vimeo** → the iframe is built on `near` with `autoplay=1&mute=1&playsinline=1`.
  Muted autoplay is the only kind browsers allow without a gesture. YouTube's `loop=1` is
  inert unless `playlist=<id>` is also present — a documented quirk, not a workaround.
- **Instagram** → the embed initialises on `near` via the official `embed.js`, then gives up
  after 6s and shows the cover plus "View original post". **Instagram is never scraped for
  raw video and no private API is used**; when its embed does not cooperate, the fallback
  says so plainly rather than faking a player.
- **Google Drive** → `DriveMedia.tsx` parses the file id out of any of the six share-URL
  shapes Drive emits and builds `/file/<id>/preview`, lazily, on `near`. Beyond that we are
  passengers: it is Google's player in a cross-origin iframe, so **autoplay is not
  guaranteed**, there is no way to press play from outside, and no shape information is
  available — which is why the cover image is what the `auto` ratio measures. A normal Drive
  share URL is emphatically *not* a video file and is never used as a `<video src>`.
- **Missing local files** → `SmartImage` swaps in a generated `Poster` seeded from the
  project id, so art is deterministic and never flickers.
- **Websites** → not embedded at all. Framing a site you do not control yields either a blank
  rectangle (`X-Frame-Options`, `frame-ancestors`) or somebody else's cookie banner sitting
  in the middle of the portfolio; neither is a portfolio piece. `WebsiteMedia.tsx` renders
  the URL as an explicit "Visit Website ↗" plus author-supplied `screenshots[]`, in three
  shapes — none (a small link preview), one (that screenshot is the piece), many (a set that
  clicks through to Focus Mode). The `iframe` flag is retained in the schema so old content
  validates, and is inert for websites.

#### Aspect: there is exactly one "Auto"

`media/aspect.ts` is the single definition. A manual `aspect` always wins. Otherwise the
media's **real** ratio is used — `naturalWidth/naturalHeight` for an image (probed
out-of-band with `new Image()` so nothing is blocked), `videoWidth/videoHeight` from
`loadedmetadata`, and the measured cover image for an embed we cannot see inside.
`FALLBACK_RATIO` is consulted only where the ratio is genuinely unknowable.

Auto is stored as the **absent** field. `'auto'` remains a legal value for backward
compatibility and `isAuto()` treats the two identically, but the Studio only ever writes the
absent form — the old form produced two identical "auto" entries in one dropdown.

Auto propagates into layout rather than just into a number: with no declared ratio,
`MediaFrame` declares no `aspect-ratio` at all and the picture sizes the frame from the
inside (`fill` means "content sizes it"). A forced ratio letterboxes rather than crops.

#### Masonry

`MediaGallery.tsx` packs items **shortest-column-first** using an estimated height (the
picture's ratio plus an allowance for its caption), rather than laying them out in CSS grid
rows. Row-based grid left blank holes wherever neighbouring items disagreed about height,
which is most of the time once every item keeps its own shape. `featured` items break out
full-width and interrupt the run, and packing restarts beneath them. Column count comes from
a `ResizeObserver` and fails open at 2.

Each item is one packed block: the media and its caption travel together, so a caption never
detaches from the picture it describes.

#### Focus Mode

`MediaFocus.tsx` is the viewer. **Its arrangement is chosen from the media's aspect ratio**,
because one layout cannot serve a 9:16 Reel and a 16:9 player — that mismatch is what made
the player small and the dark rectangle around it enormous.

The decision lives in `media/focusLayout.ts`, which is pure and touches no DOM, so it is
testable with plain numbers (`scripts/check-ui.mjs`). It takes the **resolved** ratio — the
one `media/aspect.ts` already decides: manual aspect wins, then the real measured intrinsic,
then the per-type fallback — plus the real viewport, and returns a `FocusPlan`: which layout,
whether the information sits beside the media or below it, and the exact pixel box the media
gets.

| ratio | layout | arrangement |
| --- | --- | --- |
| `< 0.95` | `portrait` | information left (~31%, 260–420px), media right, using the full height |
| `0.95 – 1.5` | `balanced` | side-by-side on a wide viewport, stacked when narrower |
| `≥ 1.5` | `landscape` | media large on top, information row beneath — **never** side-by-side |
| any, `< 1024px` wide | — | stacked: media, then information |

The thresholds are not 1.0 on purpose: a 4:5 Instagram post (0.8) and a 5:4 photo (1.25) want
the same treatment as a square, and a hard boundary would send two near-identical shapes to
opposite layouts. Landscape is never given a third of the width, which would make the player
smaller than the tile it was opened from. `focusPlan` fits the ratio inside the available box
— whichever axis runs out first decides — so the aspect is preserved exactly and nothing
overflows; portrait is additionally capped at 560px wide so a Reel stays a tall object on an
ultrawide instead of growing into its whole column.

The box is sized **inline, in pixels**, from that plan. `media.css` must not fight it: no
`width`/`height`/`max-*` on `.focus__box` and no `overflow` on the media. Two earlier viewers
were broken by exactly that — `width: min(1000px, 100%); max-height: 80vh; overflow: auto`
produced every reported symptom at once: an oversized white canvas, portrait Reels smeared
across a desktop-width box, and a second scrollbar inside the first.

**There is no dark card.** A full-screen scrim, then the content composed inside it, so the
media and its information read as one designed thing rather than a picture with a detached
rectangle behind it.

**Information comes from the item's own fields.** `media.title` (session 11) is the only field added for it. The media's title, caption and
credit, and a `FocusContext` passed in by whatever opened the viewer (project title, company,
year, tools). Every part is optional and an empty section is not rendered at all. Landscape
splits it into two editorial columns, writing left and making credits right; portrait and
balanced stack the same blocks down one panel. **The caption lives inside that region in every
layout** — it is no longer a floating block under the media, which is how it ended up outside
the composition and underneath the dock. It preserves author newlines (`pre-wrap`), breaks
long words rather than widening the panel (`overflow-wrap: anywhere`), and the information
region is what scrolls when the copy is long. The media is never a nested scrolling box.

**The controls belong to the overlay, not to the media, and they get their own space.**

Close sits top-right; the two arrows are absolutely positioned against `.focus`, vertically
centred, all at `z-index: 3` inside the overlay's own stacking context — an iframe paints its own
surface and would otherwise cover them, and a tall caption would otherwise displace them. `Esc`,
`←` and `→` all work.

The arrows are **not** simply layered over the content. `focusPlan()` reserves a gutter at each
edge of the viewport — `NAV_GUTTER` 64px, `NAV_GUTTER_NARROW` 44px below 720px wide — subtracts it
from the width available to the media, and returns it as `plan.gutter`. `MediaFocus` passes it down
as `--focus-gutter`, and `.focus__layout` spends exactly that amount as horizontal padding, so the
reading order is:

```
portrait    [ gutter ][ information ][ media ][ gutter ]
landscape   [ gutter ][      main content     ][ gutter ]
```

Each arrow then centres itself inside its own empty lane
(`left: calc(var(--focus-pad) + (var(--focus-gutter) - var(--focus-nav)) / 2)`). With a single item
`hasNav` is false, the gutter is zero, and the media gets the width back. Raising the arrows'
z-index was the wrong fix and is documented as such in `media.css`: it puts the arrow in front of
the words instead of behind them, and over a cross-origin iframe it does not even manage that.

**Focus Mode is the top application layer, and it portals to get there.** `.focus` is
`position: fixed` at `var(--z-focus)` (1150), between `--z-palette` (1100) and `--z-boot` (1200):
above the menu bar, the dock, every window, the widgets, the desktop icons and the command palette.
Only the startup cover and the custom cursor outrank it.

The token alone is not enough, and this is the part that bites. `MediaFocus` is rendered from inside
a project window, and `window.css` gives `.window` `isolation: isolate` (which is what fixes the
backdrop-filter corner artefact, so it stays). That creates a stacking context: a z-index set inside
it is only compared against that window's own children, and the window itself sits at `--z-windows`
(100 + a per-window offset) — below the menu bar. The old `var(--z-sheet)` (1000) was already
greater than `--z-menubar` (950) and it made no difference whatsoever.

So `MediaFocus` ends with `createPortal(overlay, document.body)`. **If the menu bar ever shows
through Focus Mode again, the portal is what broke. A larger number will not help.** `check:ui`
asserts both the portal and the token ordering, and that no raw three-digit z-index has been
smuggled into `media.css` or `window.css`.

**A media item's title is its own.** `.focus__title` renders `media.title` and nothing else, in the
HEADING role. There is no fallback to `project.title`: an item with no title shows no title. The
information hierarchy is title → caption → tools → credit → external action, and project · company ·
year appear only as `.focus__context`, one quiet line at the bottom of the facts column —
deliberately not a heading, because rendering the project name as each item's title is what made ten
images in one project read as ten copies of the same thing. Project context alone does not earn an
information panel (`hasInfo` requires a title, caption, credit, tool or permalink).

**Instagram in Focus Mode is constrained, never restyled.** The embed is opaque, official
and cross-origin: we size the box around it and cover it while it initialises, and we do not
attempt to reach inside it. There is no scraping and no private API.

**Artwork is never a link — except stills.** Tiles used to be wrapped in a `<button>`, which
put `<video>` and cross-origin `<iframe>`s inside a button (invalid nesting), swallowed every
click meant for the player's own scrubber, and meant a stray click could leave the site. A
still image has no controls underneath to steal the click from, so images and screenshots
open Focus Mode on click (`.media-open`, `cursor: zoom-in`), which is what everyone tries
first. Everything with a player keeps the explicit affordance in `FocusAffordance.tsx`.

Add a type: extend `mediaTypes` in the schema, add a `mediaProblem()` case, add a
`FALLBACK_RATIO` entry, add an adapter, add the registry line in `MediaRenderer.tsx`, add a
`SourceFields` branch in `studio/panels/MediaFields.tsx`.

#### Deprecated, retained

`generative` is no longer offered when adding media and is gone from the user-facing guide,
but it is still in `mediaTypes`, still has an adapter, and still renders — four items in the
live content use it. Removing the enum value would fail validation on every `portfolio.json`
that contains one. `MediaFields` shows the option only for an item that already is one, so
the select is never blank.

#### Project hero

`project.heroMediaId` explicitly names the item that opens a case study; `showHeroInMedia`
optionally repeats it in the body. Both are `.optional()` rather than `.default()` so an
untouched export gains no new keys — the round-trip guarantee.

This replaced `media.find(featured) ?? media[0]`, which conflated three unrelated concepts.
They are now separate and documented as such: the **Work grid tile** (`project.tile`) is how
the project looks as a card; the **project hero** (`heroMediaId`) is the one item at the top
of the case study; **project media** is everything below the writing. `featured` on a media
item now means only "full-width row in the masonry". A `heroMediaId` pointing at deleted
media is a named validation error, and the Studio clears the reference at the moment the
media row is deleted.

---

## Desktop

### Where things sit

`hooks/useDesktopLayout.ts` owns the position of **every** icon and widget, because they
share a surface and therefore have to share collision rules. Three sources of truth, in
priority order — and they differ in more than precedence, see *Protected space* below:

1. a position the visitor dragged — localStorage, wins over everything and is never rewritten;
2. an explicit `x`/`y` in `portfolio.json` — an advanced override, and a *preference*;
3. the generated scatter.

The scatter is **seeded, not random-per-load** (`seededRandom(id)`), so the desktop looks the
same on every visit — curated rather than chaotic — while still reading as hand-placed rather
than grid-locked. Items are banded into a left and a right column with jitter, which keeps
the middle of the screen clear for windows.

Coordinates are percentages, so a layout survives any viewport without re-running. Dragging
uses Pointer Events with `setPointerCapture`; positions **wrap** modulo 100 instead of
clamping, so an icon pushed off the right edge reappears on the left. A pointer that moves
less than `DRAG_THRESHOLD_PX` counts as a click, which is why `onClick` calls
`layout.didDrag()` before opening anything.

The Studio therefore never asks anyone to type a coordinate — x/y live behind an `Advanced`
drawer.

### Protected space — free positioning, no grid

`hooks/desktopPlacement.ts` is the collision geometry, and it is **pure**: no DOM, no React, no
storage, so the rules are asserted with numbers in `scripts/check-ui.mjs` (checks 16–18) rather
than by hand in a browser. Every item carries a `SAFE_PAD` of 10px around its box, so "not
overlapping" also means "not touching" — two labels sharing a pixel row reads as broken.

**There is no grid, and adding one would be a regression.** A position that is legal is kept
*exactly*: dropped at 733.4, stored at 733.4. Nothing is rounded to a step or snapped to a cell.
Only a position that lands inside somebody else's protected area is changed, and then only as far
as it has to be.

`resolveSpot()` is an outward ring search: rings of growing radius (12px apart) around the
requested point, 16 candidates each, the ring rotated half a step each time so successive rings do
not retry the same directions. The first free candidate wins, which makes it the nearest free spot
to within one ring — and reads as *the neighbour made room*, which is what a drop landing on
somebody should feel like. Candidates are clamped to sit wholly on the surface so a nudge never
parks an icon half off the desktop; the requested point itself is not, because a drop the visitor
asked for is honoured as-is. If a desktop is so full that nothing is free within 80 rings, the
requested point is returned unchanged: an overlapping icon beats a vanished one.

**Pixels, not percentages.** Percentages are what gets stored, but a percentage is a different
distance horizontally than vertically, and "the nearest free spot" has to mean nearest *on screen*.
`useDesktopLayout` converts at the boundary and the geometry module only ever sees pixels.

**Collision is consulted on drop, never during the drag.** `onMove` is untouched: the icon follows
the pointer exactly, still wraps at the edges, and passes freely over its neighbours while the
button is down. It is `onUp` that runs the requested point through `settle()` — which measures the
dragged element's real box, treats every *other* item's current position as an obstacle, resolves,
and persists the accepted point to the existing `storageKeys.layout`. Refreshing keeps icons where
they were dropped, and the storage shape did not change.

**Footprints are measured, not assumed.** `data-layout-id` on `.dicon` and `.widget` is how the
hook finds each element; it reads their real boxes in a layout effect and on resize. A widget is
roughly twice an icon's area and a `note` widget's height depends on its text, so a nominal box
would have let icons settle on a widget's lower half. Measurement stands down while a drag is in
flight — a drag re-renders every `pointermove`, and re-reading every box per frame is a forced
reflow for numbers that cannot have changed.

**Who decided matters more than precedence.** This is the part that is easy to get backwards:

| Tier | Resolved? | Why |
| --- | --- | --- |
| `saved` | **Never.** Placed first, untouched at every viewport. | It is the visitor's own decision, and it is what makes a layout saved before collision existed load exactly as it was left — pre-existing overlaps included. |
| `authored` | Yes, but with first refusal on its spot. | An `x`/`y` in the content file is a preference. No author can pick coordinates that clear their neighbours at *every* window size: the two shipped widgets are 21% apart, which genuinely overlapped at 1280×720 before this pass. |
| `generated` | Yes, against both of the above and against each other. | So a newly added shortcut avoids everything already on the desktop, saved positions included. |

### Icons are marks; the wrapper owns the pointer

Artwork, a monogram and a generic lucide glyph are all drawn the same way: a bare 72px mark
with a label under it. **No plate.** No raised tile, no gradient, no filled backdrop, no
rounded square, for the fallbacks either — a desktop where half the icons wear buttons and
half do not reads as two different systems. A transparent PNG is drawn with `object-fit:
contain` and nothing behind it, so it looks on the desktop exactly as it looks in the file.
`icon.tint` colours the monogram itself rather than painting a square behind it.

**The `.dicon` button owns the whole gesture, and the artwork is inert.** An `<img>` is
natively draggable: pressing in the middle of a PNG started Chrome's own image drag, which
floated a ghost of the picture over the widgets and windows, cut off the pointer stream
`useDesktopLayout` was listening to, and left the shortcut where it was. Dragging only worked
if you happened to grab the label or the padding. The image therefore carries
`draggable={false}`, a `dragstart` guard, `-webkit-user-drag: none` and — the load-bearing one
— `pointer-events: none`, so every press lands on the button, which is where both the drag and
the click already live. `user-select: none` on the button covers the same failure via the
label. Any decorative image inside a pointer-driven control needs the same treatment.

### What an icon can open

`DesktopTarget` is a discriminated union: `folder`, `project`, `note`, `app`, `media`, `url`
(opens in the in-OS browser window), `external` (leaves the site in a new tab) and `alert`
(opens one of the root-level `alerts` as a system dialog — the creative-software jokes on the
right of the desktop). `useOpenTarget` is the only place that switches on it.

### Widgets

`DesktopWidget.tsx`. Three types, all deliberately self-contained — no network, no API,
nothing to break:

| Type | What it is |
| --- | --- |
| `clock` | Time, day, date, optional place label. |
| `note` | A short card whose text comes from the content file. |
| `reaction` | A reaction-time test. `ReactionWidget.tsx`, the only widget with state. |

They flow through the same layout system as the icons, so they are draggable too.

**On `reaction` specifically:** §5 of PROJECT_STATUS.md rules out games, and this is its one
deliberate exception, requested explicitly. It is scoped to stay tiny — press start, wait for
the panel to turn blue, press again, read the milliseconds; best score in `localStorage`; no
levels, no sound, no leaderboard, no network, no dependencies, no animation beyond a colour
change. It is a widget that happens to be playable, not a game the portfolio ships. **Do not
remove it, and do not grow it.**

It listens on `pointerdown` rather than `click` so mouse, touch and pen share one path and
the visitor's own finger-release isn't counted in the score, and it calls `stopPropagation()`
because the card underneath it is draggable.

### Window dragging: three edges free, one edge held

`<Rnd>` in `Window.tsx` has **no `bounds` prop**. Left, right and bottom are completely
unbounded — a window can be dragged fully off any of those three edges and left there.
`.desktop` is `position: fixed; inset: 0; overflow: hidden`, so what leaves the viewport is
clipped rather than producing scrollbars, and nothing wraps around to the opposite side.

**The top edge is the exception, and it is deliberate.** A window dragged under the menubar
took its own title bar with it, and the title bar is the only thing you can grab — so the
window became unrecoverable by direct manipulation. The other three edges always leave the
title bar reachable, so they stay free.

The constraint is enforced by **controlled positioning**, not by `bounds`:

```tsx
onDrag={(_event, data) => {
  const top = topSafeArea();
  if (data.y < top) rnd.current?.updatePosition({ x: data.x, y: top });
}}
```

`bounds` cannot express this — it walls all four sides at once, which is the bug this
replaced. Returning `false` from `onDrag` does not work either: it aborts the whole gesture
instead of letting the window slide along the limit. Calling `updatePosition` lets the
window keep moving horizontally while its `y` rests against the boundary.

`topSafeArea()` lives in `lib/chrome.ts` and is `menubarHeight() + 8`, read from the
`--menubar-h` custom property rather than hardcoded, so the limit follows the CSS. The same
helper is used for spawn clamping, maximise geometry and Tidy in `state/os.ts` — there are
no magic numbers left on any of those paths.

The routes back from off-screen are unchanged: Tidy (⌃T — re-lays every open window into a
grid), maximise/restore, the dock/taskbar entry, and Reset desktop.

An earlier build had `bounds="parent"` here plus a `useEffect` that clamped `x`/`y` with
`win.x, win.y` in its dependency array; between them **every** edge behaved like a wall.
Both are gone. Do not restore either: the mount-only clamp effect that remains carries an
`eslint-disable` and a comment explaining why it must never re-run on `y` changes.

### Theme

`settings.theme.default` decides what a first-time visitor sees (light). `allowToggle`
decides whether the menu-bar sun/moon appears at all; with it off, the chosen mode is forced
for everyone. `useApplyTheme()` — called once in `App.tsx`'s `Shell` — writes
`<html data-theme>`, and every token in `tokens.css` keys off that one attribute.

`Wallpaper.tsx` keeps **both** layers mounted at all times and swaps their opacity, so a theme
change cross-fades rather than hard-cutting. Each layer takes an optional image from
`settings.theme.wallpaperLight` / `wallpaperDark` and falls back to a built-in gradient.

---

## Quick View

`components/quick-view/QuickView.tsx`. A real view swap, not a filter: intro, selected work
(`featured` projects only), experience, capabilities, about, contact, CV.

This is the recruiter path, and **usability beats artistry here** — it is plain, scannable
and fast. It shares the tokens and UI primitives with the OS, so it feels like the same
product without the desktop metaphor. Reachable at `#/quick`, by `Q`, from the dock, and
from the menu bar.

---

## Mobile

`useIsCompact()` picks `MobileShell` instead of `Desktop`. It is **not** a squeezed desktop:
apps are cards, projects open as full-screen sheets, there is no dragging and no custom
cursor. Quick View is prominent. All content stays reachable.

---

## Routing

Hash-based (`#/`, `#/quick`, `#/project/<id>`, `#/studio`) via `useHashRoute`. This is a
deployment constraint, not a preference: GitHub Pages has no server-side rewrites, so a real
path would 404 on refresh.

`App.tsx` syncs both directions — hash → state on load (deep links work cold), state → hash
on change (URLs stay shareable).

**A route is applied exactly once**, guarded by an `appliedRoute` ref. This is not an optimisation;
without it the app has a live navigation bug. The hash → state effect must depend on `view` (it needs
the `view === 'boot'` guard so a deep link is not applied mid-boot), which means *any* `setView` re-runs
it — and re-running it re-reads the still-unchanged hash and puts the old view straight back. That is
why "Explore the OS" did nothing from `#/quick`: `setView('desktop')` was immediately overwritten,
the state → hash effect rewrote the hash, and the two effects ping-ponged. It looked like a
localhost artefact and was not.

The rule is: **the hash is the source of truth for navigation *events*, not a lock on the current
view.** Once a route has been applied, the app owns the view until the route genuinely changes again —
a link, a manual edit, Back or Forward. Deep links, a refresh inside Quick View, and history
navigation all still work, and everything stays SPA: no reload, ever.

---

## Studio

### The PIN gate

`studio/PinGate.tsx` wraps the whole Studio. **It is not security and does not pretend to
be:** this is a static site, so `settings.studioPin` is compiled into the same bundle the
browser downloads and anyone can read it in devtools. It is a closed door on a room in your
own house — it stops people wandering in, which is the entire goal. With no PIN configured
the gate is skipped. The unlock lives in `sessionStorage`, so it lasts as long as the tab.

If content genuinely must not be touched, the answer is not a longer PIN: edit
`portfolio.json` locally and deploy a build you trust.

### URL-only, full-screen

**The Studio is not an application in ASAAD.OS.** It has no dock icon, no desktop icon, no
menu-bar item, no Quick View link, no command-palette result and no search result. It is
absent from `registry.tsx`, from `APP_IDS`/`defaultBox` in `state/os.ts`, and from
`lib/search.ts`, so it cannot leak back into the UI by accident — there is no `studio` app
for anything to reference.

The only way in is typing `#/studio`, which **always works**. `App.tsx` sees that route head
and returns the Studio *instead of* the shell, above every hook so the early return is legal;
OS hotkeys are disabled while it is open, and the state→hash effect stands down so the OS
cannot navigate the editor away from itself. `.studio` and `.pin` are `position: fixed;
inset: 0` and size to `100dvh`, because the Studio is a screen, not a window.

`StudioApp` is `React.lazy`-imported, so a visitor who never types `#/studio` never downloads
it — it builds as its own `StudioApp-*.js` / `.css` chunk. `.studio-loading` covers the gap.

There is deliberately **no `settings.showStudio`**. A visibility flag had nothing left to
toggle once the Studio left the UI, and setting it to `false` would have disabled `#/studio`
itself, which is the opposite of what is wanted: hidden from the portfolio, reachable by URL.
Old `portfolio.json` files carrying the key still validate — `z.object()` strips unknown keys
— and the field disappears on the next Studio export.

`#/studio`. Deliberately **not** a production admin panel.

`useDraft.ts` holds a structural clone of the content, validated on every keystroke, backed
up to `localStorage` so a refresh mid-edit isn't destructive. Panels are pure functions of
`{ draft, update }`, where `update` takes a mutator applied to a fresh clone. Form
primitives live in `panels/parts.tsx` — `Repeater` handles every nested list (reorder,
duplicate, delete) so no panel reimplements list editing.

Export is **blocked while validation fails**, which stops a broken file from reaching the
live site.

#### The draft envelope — why saved drafts are version-aware

This is the most important thing in the Studio, because getting it wrong loses work.

The original initializer was three lines and one fatal assumption:

```ts
const saved = readStore(storageKeys.studioDraft, null);
if (saved) { const p = validatePortfolio(saved); if (p.ok) return p.data; }
```

It restored **any** draft that merely *validated*. An old draft validates perfectly — it is
just old. So a draft saved before the wallpapers, widgets and creative-app shortcuts existed
would silently replace the newer canonical `portfolio.json` on open, and the next export
wrote that stale state to disk. Nothing errored. The content was simply older than the file
it overwrote.

A draft is now stored as an envelope:

```ts
interface DraftEnvelope { baseSignature: string; savedAt: string; draft: unknown }
```

`baseSignature` is a `fingerprint()` of the `portfolio.json` the draft was started from:
FNV-1a over a `stableStringify()` that **sorts object keys at every depth but deliberately
leaves array order alone**, because in this schema array order *is* content — it is the
order projects appear on the desktop.

On open, three cases:

| Case | Meaning | What happens |
| --- | --- | --- |
| signature matches | draft is current | resumed silently, as before |
| signature differs | `portfolio.json` changed since the draft was saved | **recovery screen** |
| no signature (legacy bare save) | provenance unknown | treated as stale by definition |

The recovery screen never guesses. It presents three actions and the **safe default is
"Load current portfolio"** — the destructive option is never the primary button. The third
action downloads the old draft as `portfolio.old-studio-draft.json` so nothing is ever
thrown away without a copy. Unreadable drafts are removed rather than re-parsed forever.

A `Reload from portfolio.json` button in the sidebar (two-step confirm) covers the same need
mid-session.

**Regression tested, not assumed.** The round trip is verified against the immutable
`backup/portfolio.TRUTH.json`: a no-edit round trip drops **zero** fields and adds only 23
Zod `.default()` materializations (`responsibilities: []` ×10, `rotate: 0` ×12,
`primary: false` ×1 — all additive and harmless), the export is a fixed point under
re-import, and a single-field edit produces **exactly one** diff.

### Swapping in a real CMS later

`useDraft`'s load/save are the only functions that touch persistence, and `loadPortfolio()`
is the only place the app reads content. Point those two at an API and every panel and every
component keeps working unchanged. That was the reason for the split.

**Non-negotiable:** no GitHub token, no API key, no secret ever goes into client-side code.
A static site cannot keep one. Export-a-file is the honest design, not a limitation to route
around.

---

## Styling

CSS custom properties in `tokens.css`, co-located plain CSS per area. No CSS-in-JS, no
utility framework, no runtime style cost.

Z-index is a single scale in tokens (`--z-wallpaper` → `--z-cursor`) so nothing fights.
Monospace exists (`--font-mono`) but must never dominate.

### Typography: three roles, a face each, one scale

By default the type is a **system sans stack** (`--font-sans`) for the whole interface, with an
old-style serif (`--font-editorial`) for selected headings, and **no web font is requested at all**.
The Google Fonts link was removed deliberately and is not coming back: the system stack is what makes
the OS read as native, and it costs zero requests.

On top of that sits an optional custom-font system with three moving parts.

**The faces.** `settings.typography.font` names a file under `public/` — by convention
`public/fonts/` — and is the **shared** face: every role uses it unless it names its own. A role then
overrides it with `display.font`, `heading.font` or `body.font`, which is how a display face gets
paired with a different text face. `useTypography` loads each one with the `FontFace` API (never an
injected `@font-face` rule, because `FontFace` reports failure and a rule cannot), fetching each
distinct file exactly once, and on success only sets `--font-custom` / `--font-custom-<role>` to
`'Family', <native stack>`, so the system fallbacks still catch every glyph a file does not cover.

Precedence is the CSS cascade rather than logic in the hook — the loader writes both levels and the
tokens decide:

```css
--font-display: var(--font-custom-display, var(--font-custom, var(--font-native-display)));
--font-heading: var(--font-custom-heading, var(--font-custom, var(--font-native-display)));
--font-body:    var(--font-custom-body,    var(--font-custom, var(--font-native-sans)));
--font-sans:    var(--font-body);
```

Read outwards: this role's own face, then the shared face, then the native stack. `--font-custom` and
the three `--font-custom-<role>` are therefore **never declared in CSS**. An empty custom property
makes `font-family` invalid at computed-value time rather than falling back, which would cost the page
its font — so the absence of a declaration is the mechanism, not an oversight. `check:ui` asserts both
the chain and the absence.

One file per role, and no more. There is no ZIP upload, no folder scanning, no per-weight file slot,
no automatic weight-file mapping: that is a font manager, and a portfolio does not need one. A
variable font supplies its own weights; a static one is left to the browser, whose synthesis is
acceptable here. A missing or corrupt file logs one `console.warn` and changes nothing else.

**The roles.** `--font-*`, `--size-*`, `--weight-*`, `--tracking-*` and `--leading-*` for
`display`, `heading` and `body`, defined in `tokens.css` with defaults that are literally the values
the stylesheets already hard-coded — which is why configuring nothing leaves the site pixel-identical.
Each role is applied at a small, curated set of anchors rather than sprinkled through the React tree:

| role | means | anchors |
| --- | --- | --- |
| DISPLAY | rare, large, editorial | `.case__title`, `.about__name`, `.contact__title` |
| HEADING | titles, section and window headings, strong labels | `.section-title__text`, `.focus__title`, `.media-frame__title` |
| BODY | everything you read | `body` — inherited by the whole document |

There are deliberately **no per-component typography controls.** Component-level exceptions stay in
CSS where they were already needed; `.media-frame__title` is the heading role at `× 0.72`, because a
full-size heading inside a two-column masonry caption shouts over the work.

**The scale.** `--type-scale` (1 = 100%) multiplies every `--fs-*` token and every configured role
size. It cannot move anything else: spacing, radii, icon sizes, the dock and window geometry are px
values on their own scales, and `check:ui` proves the guarantee by asserting that `--fs-*` is spent
on `font-size` and nothing else, anywhere in `src/`.

A *configured* role size is a desktop reference value. `useTypography` emits it as
`calc(clamp(floor, floor + Nvw, size) * var(--type-scale))`, reaching the configured size at 1280px
wide: Display gives up 55% on a narrow screen, Heading 20%, Body nothing at all — body text is
already at its readable size and shrinking it is how sites become unreadable on phones.

`primary` / `secondary` from the previous two-font system are still honoured: `primary` stands in as
the custom face when `font` is unset, and `secondary` still drives `--font-editorial`. No content
needs migrating.

Motion is quick by default and never blocks access to information;
`prefers-reduced-motion` shortens or removes it, including skipping the boot sequence.

---

## Performance

- `portfolio.json` is imported at build time — no content request on load.
- Manual chunks split React, GSAP and react-rnd; the Studio is a lazy chunk.
- Images lazy-load; embeds defer until visible; video uses poster frames.
- Generated posters are CSS/SVG, so the homepage is populated without heavy downloads.

---

## Deployment

`.github/workflows/deploy.yml`: checkout → Node 20 → `npm ci` → `npm run lint` →
`npm run build` → copy `index.html` to `404.html` → `touch .nojekyll` → upload → deploy.

The type check gates the deploy, so a broken build never ships.
`base: './'` keeps the output portable across user sites, project subdirectories and custom
domains without config edits.
