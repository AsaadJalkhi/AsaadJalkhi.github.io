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
    paths.ts               asset() — resolves public/ paths under any base path;
                           normalizeLocalPath() — the one definition of a stored local path
    masonry.ts             Shortest-column-first packing + width → column count (pure)
    search.ts              Index + scoring for the command palette
    storage.ts             Guarded local + session storage (both throw in private mode)
    utils.ts               cx, clamp, seeded random, moveItem, download, copyText
  state/
    os.ts                  Zustand: view, windows, z-order, palette, cursor, theme, tidy, reset
    portfolio.tsx          Context provider for validated content
  hooks/
    useColumnCount.ts      How many columns the CONTAINER holds — ResizeObserver, not innerWidth
    useEnvironment.ts      Viewport size, compact breakpoint, reduced motion
    useHashRoute.ts        Hash routing
    useHotkeys.ts          Declarative global shortcuts
    useOpenTarget.ts       "Open this project/note/app/url/alert" — the one way things open
    openSurface.ts         How the SHELL opens things: a window, or a mobile sheet
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
      MediaGallery.tsx     One/two-column masonry over lib/masonry.ts + useColumnCount
      MediaFocus.tsx       The viewer: aspect-aware composition on a scrim
      focusLayout.ts       Pure: ratio + viewport → portrait / balanced / landscape
      aspect.ts            THE definition of Auto — real intrinsic ratios
      subitems.ts          Gallery images and website screenshots as media
      adapters/            One per media type
      types.ts             AdapterProps — the contract every adapter implements
    quick-view/            Recruiter mode
    mobile/                Purpose-built mobile shell; MobileSurface owns the sheet stack
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

**Maximised = menu bar to bottom edge.** `toggleMaximize` and the viewport-tracking effect
in `Window.tsx` both use `y: topSafeArea()`, `height: viewport.height - topSafeArea()`. The
dock is not reserved; it overlays the window, since `--z-dock` (900) is above the windows
layer (`--z-windows` 100) and below Focus Mode (`--z-focus` 1150). The window gets
`.window--maximized`, which sets `--window-clear: calc(var(--dock-h) + var(--s-4))`. A
`::after` spacer of that height ends the scroller: `.window__body`, or `.work__scroll` in the
Work window, whose body spacer is turned off. That way the last content can scroll up clear
of the dock. Restored windows get no spacer. Tidy still leaves an 84px dock gap, because it
lays windows out rather than maximising them. `check-ui` 34 checks all of this.

**Registry.** `components/windows/registry.tsx` maps `AppId → { label, icon, component }`.
The window manager renders `APPS[win.app].component`. Adding an app is one entry; the
Studio, dock and command palette all read from the same map. The Studio is `lazy()`-loaded
so visitors never download the editor.

**A folder is not an app.** `openFolder()` presents the **Work window** with
`payload.folderId`, which `ProjectsApp` reads as the initial value of the folder filter it
already has. So "All work", a brand tab and an opened folder are one component with a different
array, and the only thing that positions project cards anywhere in the OS is `ProjectGrid`
inside that file — see [Masonry](#masonry--one-packer-two-grids). A second grid for folder
contents is the bug, not the feature; `check-ui` 27 fails if one appears.

**Folder intro.** A folder can carry optional `introTitle`, `description` and `banner`
(`FolderSchema`, no defaults). When the open folder has any of them, `WorkView` renders
`FolderIntro` inside `.work__scroll`, before `ProjectGrid`: the shared `ProjectBanner`, then
`.case__title` (`introTitle || name`), then `.case__intro`. It reuses the case study's
classes, so `ProjectsApp` imports `apps.css`. Folder-specific spacing is `.work__intro` in
`work.css`. The heading aligns to the grid edge and the folder name stays the tab label.
With none of the fields set, nothing renders and the folder opens straight onto its cards.
The Studio Folder preview is the same `WorkView`, so it shows the draft intro. A project or
folder intro without a banner is marked `data-bannerless` and gets a top inset (32px, or 20px
narrow). One with a banner gets nothing extra. See `check-ui` 31–33.

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
for every such container. That particular rule went with the hero it previewed in session 13,
so check 2 now asserts its *absence* as well: a rule with no markup left is exactly the kind
of thing that gets copied back into service later.

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

#### Body media is shown whole, and bounded by its own shape

**Nothing in a case study body is cropped.** `object-fit: cover` exists in exactly two places:
a grid tile in `card` mode, and the project banner. Everywhere else the media is `contain` or
natural, so Focus Mode is a way to see something *larger*, never the only way to see it at all.

The problem that makes this non-trivial is that "show all of it" and "do not make it enormous"
look opposed for a 9:16 Reel. They are not, because the frame already knows the resolved ratio.
`MediaFrame` publishes two things: `data-shape`, from `focusLayout()` — the *same* thresholds
Focus Mode uses, so `portrait` cannot come to mean two different things — and `--frame-ratio`,
the resolved number. The stylesheet then converts a height ceiling into a width ceiling:

```css
.media-frame { --media-cap: 70vh; }
.media-frame[data-shape='portrait'] .media-frame__stage {
  max-width: calc(var(--media-cap) * var(--frame-ratio, 1));
  margin-inline: auto;
}
```

Portrait takes the cap at ×1 and balanced at ×1.15. Landscape gets no rule: it is bound by the
column width already, and anything added there could only start cropping it. Because the bound
is a `max-width`, the element keeps its own `aspect-ratio` and stays centred. Capping the `<img>`
with `max-height` instead was tried and is worse — it shrinks the box without moving the auto
margins, so the media strands itself against the left edge of its column.

An `auto` image reaches these rules because `ImageMedia` measures itself with `useImageRatio`
and hands the result to the frame. A `featured` item still spans the full width; spanning is a
width decision and does not imply a crop.

#### Masonry — one packer, two grids

Both column layouts in the OS — the media inside a case study and the project cards in the
Work window — pack **shortest-column-first** instead of laying out in CSS grid rows. Grid is
row-based: every item in a row occupies a row as tall as the tallest item in it, so blank holes
open up wherever neighbours disagree about height, which is most of the time once each item
keeps its own shape.

The algorithm is `lib/masonry.ts` and is shared:

```
packColumns(items, count, height)   items in source order → count columns, each next item
                                    into the currently shortest one. Never sorts, never
                                    mutates. count <= 1 returns the list as-is.
columnsForWidth(width, steps)       ascending min-widths → column count. Pure, so the
                                    breakpoints are asserted with numbers (check 27).
```

Heights are **estimated from the data**, never measured: a ratio plus an allowance for the text
under it. The DOM then stays static — no observer per card, no reflow loop, no jump when images
arrive. Being slightly wrong costs slightly uneven columns and nothing else. Each caller owns
its own estimate, because only it knows what its item is made of.

Column count comes from `hooks/useColumnCount.ts`, which measures the **container's content
box**, not the viewport: every grid here lives in a draggable, resizable window, and two windows
side by side disagree about what "wide" means. The first measurement is synchronous in a layout
effect (so the opening frame is already right), a `ResizeObserver` handles resizes, and the
initial state fails open at the widest tier.

| Grid | Steps | Columns |
| --- | --- | --- |
| `MediaGallery` (case study) | `[620]` | 1 / 2 |
| `ProjectGrid` (Work window) | `[700, 1150]` | 1 / 2 / 3 — three is the ceiling |

In the media grid, `featured` items break out full-width and interrupt the run, and packing
restarts beneath them. Each item is one packed block: the media and its caption travel together,
so a caption never detaches from the picture it describes.

In the Work grid, the same is true of a card and its label. Because masonry needs equal columns,
`project.tile.span` no longer sets a card's width there; `tile.aspect` still decides its shape,
which is what makes the heights vary in the first place.

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

**Tools exist at two levels, and they are not the same list (session 14).**

| Field | Shape | Where it appears |
| --- | --- | --- |
| `project.tools` | `string[]`, defaulted | The **project footer** only — chips beside Tags and Credits |
| `project.credits` | `Credit[]`, defaulted | The **project footer** only |
| `media.tools` | optional `string` | **Focus Mode** only, as the Tools row |
| `media.date` | optional `string` | **Focus Mode** only, as the Date row |
| `media.credit` | optional `string` | **Focus Mode** only, as the Credit row |
| `media.title`, `media.caption` | optional `string` | The grid tile **and** Focus Mode |

Focus Mode used to render `project.tools` next to every item, which is wrong in the ordinary case
rather than the edge case: a case study cut in Premiere, retouched in Photoshop and rendered in
Blender told the visitor that a single photograph in it had been made with all three. `media.tools`
is read straight from the item (`active.tools?.trim()`), there is **no fallback** to the project, and
an item without it renders no Tools row at all — never a label with nothing after it.

The enforcement is the type, not the call site: `tools` was **removed from `FocusContext`**, so a
future caller cannot pass the project's list in even by accident. `FocusContext` is now provenance
only (project title, company, year). `media.tools` is a free-text string rather than an array because
it is one short line read as written; `project.tools` stays an array because those are chips.
Credits remain **project-level only** — there is deliberately no `media.credits`, and the per-item
`media.credit` (one line: photographer, studio, collaborator) is a different, older field.

**`media.date` is free text, and nothing parses it.** "Summer 2025", "March 2026" and "2026-03-14"
are all real answers to when a piece of work was made, and a date type would force a precision the
work often does not have. Nothing sorts or filters by it; it is a line of provenance shown beside
Tools. `project.year` still dates the case study.

**The grid tile is title + caption, and `MediaFrame` enforces that by not having the props.**
`media.tools`, `media.date` and `media.credit` are all Focus-Mode-only. `MediaFrame` never knew about
tools or date, and in session 14 its **`credit` prop was deleted** along with the nine adapter call
sites that passed it and the `.media-frame__credit` rule — a credit line under every picture in a
two-column masonry is noise as soon as more than one item carries one. Deleting the prop rather than
just omitting the argument matters: "don't pass a credit" is a decision nine adapters each have to
remember, while "there is nothing to pass" is one decision that holds for the tenth adapter too.
Sub-items inherit it instead of losing it — `asMediaItems()` carries the parent's `credit`, `tools`,
`date` and `demo` onto each gallery image so opening one in Focus Mode shows them, while caption, alt
and shape stay per-picture.

`check:ui` 26 asserts every clause of the above, in both directions: the fallback is gone, no adapter
passes credit/tools/date into the frame, and the footer still prints `project.tools` and
`project.credits` while Focus Mode still prints all three item rows. Deleting a row is as much a
regression as printing it on a tile.

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

#### Where a picture or a video comes from: `SourceField`

Image and video are the only two media types that can be *either* a file in `public/` or a
remote URL, and `studio/panels/SourceField.tsx` makes the visitor say which. One box that
accepted both could not name the mistake you had made, because it did not know which of the two
you were attempting. YouTube, Vimeo, Instagram, Drive and website keep a single URL field — a
"local file" half for YouTube would be a lie.

**Normalisation lives in `lib/paths.ts`, not in the Studio.** `normalizeLocalPath()` is the one
definition of what a stored path is, shared by the field and by `BannerSchema`:

| typed | stored |
| --- | --- |
| `media/gaf/v.mp4` | `media/gaf/v.mp4` |
| `/public/media/gaf/v.mp4` | `media/gaf/v.mp4` |
| `E:\asaad portifolio\public\media\gaf\v.mp4` | `media/gaf/v.mp4` |
| `E:\elsewhere\v.mp4` | *refused:* "This file must be inside the project's `public/` folder." |

Backslashes become slashes, everything up to and including the last `public/` segment is
dropped (matched case-insensitively, on a segment boundary), and duplicate and leading slashes
collapse. A machine-absolute path with no `public/` segment is **refused by name rather than
stored**: it cannot deploy, so accepting it would only move the failure somewhere further from
the field that caused it. `portfolio.json` therefore never contains an `E:\…` — asserted by
`check-ui` 23.

**Existence is checked, not assumed.** `useAssetProbe` issues a `HEAD` for the resolved asset
after a 400 ms settle, and treats a `text/html` content-type as not-found because Vite answers
unknown paths with `index.html`. A miss is reported quietly in the field; nothing is blocked and
nothing throws.

**There is no file picker, and that is deliberate.** A browser will not tell a page where a
chosen file lives — it reports `C:\fakepath\name.jpg` on purpose — so a picker here could only
*look* like it worked. Making it real means Electron or a backend, which is a very large change
to a static site in exchange for saving one paste. The mode is UI state only, so switching to
URL to look and switching back cannot clear the source.

#### Deprecated, retained

`generative` is no longer offered when adding media and is gone from the user-facing guide,
but it is still in `mediaTypes`, still has an adapter, and still renders — four items in the
live content use it. Removing the enum value would fail validation on every `portfolio.json`
that contains one. `MediaFields` shows the option only for an item that already is one, so
the select is never blank.

#### Project banner

`project.banner` is the wide band at the top of a case study. It is **its own field**, not one
of the project's media items:

```ts
banner?: { type: 'image' | 'video'; src: string; alt?: string }
```

`.optional()` rather than `.default()`, so an untouched export gains no new keys — the
round-trip guarantee. `src` is refined through `localPathProblem()`, which makes "a local file
inside `public/`" a schema rule rather than a request in a hint. There is no URL, Instagram,
YouTube, Drive, website or embed banner: those types bring their own chrome and their own
aspect ratios, and a band is neither.

**Why it stopped being a media item.** `heroMediaId` promoted one of the project's own media by
id, which meant the banner and the work competed for one list, "show the hero again below" had
to exist as an option, and a 9:16 Reel could be elected to a role it is the wrong shape for.
A banner is a different *kind* of thing from a piece of work, so it gets a different field.
Nothing filters the media list any more, because the banner was never in it.

**The band is the page's decision.** `.case__banner` is `height: clamp(190px, 30vh, 280px)`
(`clamp(170px, 24vh, 190px)` when compact) with `overflow: hidden`, and the media inside is
`width/height: 100%`, `object-fit: cover`, `object-position: center`. Every project's banner is
therefore the same height at the same window size, any source shape is accepted, and there are
no letterbox bars — the source's ratio is never consulted. Recommended source: **1920 × 700**.
This is the one place in the app where cropping is correct, and it is the opposite of the rule
for body media above.

A `banner.type === 'video'` is **editorial motion, not a player**: `autoPlay muted loop
playsInline`, no `controls`, no progress bar, and `tabIndex={-1}`. `ProjectBanner.tsx` renders
it directly and deliberately does not go through `MediaRenderer`, whose entire contract is
"show the work whole at its own ratio".

**Legacy content is read, not rewritten.** `resolveBanner(project)` falls back to `heroMediaId`
when no banner is set, and `bodyMedia(project)` keeps honouring `showHeroInMedia` for exactly
those projects. `heroMediaId` is `@deprecated`, still validates, and a dangling one is still a
named validation error that the Studio clears when the media row is deleted. The Studio offers
a one-click "use it as the banner" migration and never performs one on its own.

The three concepts this originally separated are unchanged: the **Work grid tile**
(`project.tile`) is how the project looks as a card, the **banner** is the band at the top, and
**project media** is everything below the writing. `featured` on a media item still means only
"full-width row in the masonry".

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

### How "open this" resolves — one path, declared by the shell

Every app component is shared between the two shells, so no app can be the thing that knows
which one it is in. `hooks/openSurface.ts` is how the **shell** says how opening works:

- `useOpenTarget` describes *what* is being opened and routes everything through one `present()`
  exit. It consults `useOpenSurface()` first and falls back to `openWindow` only when there is
  no surface. Nothing else in the hook may call `openWindow`; `check-ui` 25 counts the calls.
- **Desktop** provides no surface, so `present()` opens a window — unchanged behaviour.
- **Mobile** provides one. `MobileSurface` pushes a full-screen sheet onto a **stack**, so a
  project opened from inside a folder can go Back to the folder rather than to the home screen.
  Every level stays mounted; buried levels are `inert`.

**The provider wraps the whole shell** — `Shell` renders
`<MobileSurface enabled={compact}><ShellBody /></MobileSurface>` — and that is load-bearing, not
tidiness.

> **The bug this fixes.** `MobileShell` used to keep its own sheet state and open things
> directly. Tapping a folder opened a sheet containing `ProjectsApp`; the tiles inside it call
> `useOpenTarget().openProject`, which called `openWindow` — a *desktop* window. Nothing on
> mobile renders the window layer, so the tap looked dead, while a real window sat in state and
> appeared the moment the viewport grew wide enough to draw it. A project tapped on the home
> screen worked only because that one call site bypassed the hook. Two paths, one of them wrong.
>
> Providing the surface inside `MobileShell` would fix the reported case and leave two doors
> open: the **command palette** (reachable from the mobile top bar, and calling `openWindow`
> directly) and a cold **`#/project/<id>` deep link** applied in `App.tsx` both sit *above* the
> home screen in the tree. A surface that covers only part of the app is a surface someone has
> to remember, which is how this bug survives its own fix.

The palette therefore opens through `useOpenTarget().present`, which exists for callers that
have already built an `OpenSpec` and would otherwise reach past the surface to the store.

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

The one exception is a project's media, which renders through `panels/MediaList.tsx` because a
fully expanded form per item made a ten-item project several screens long. It keeps the
`Repeater` contract (same `moveItem`, same id de-duplication on Duplicate, same `onChange(next)`)
and adds presentation only:

- **Cards are collapsed by default.** A collapsed card is one ~52px row — `#NN`, a short type
  (`Gallery · 8 images`), and a label from `mediaLabel()`: `title` → local file name → a
  type-specific summary (a shortened URL, never the whole one) → the type. Move / duplicate /
  delete stay on the row beside a chevron. `MediaFields` is mounted only while a card is open;
  collapsing loses nothing because every value already lives in the draft. `Advanced` inside it
  is still its own `<details>`, closed by default.
- **Open state is a `useFolds` set of media ids** — independent per card, session only,
  and reset per project because `ProjectsPanel` renders `<MediaList key={project.id}>`. Expand all
  / Collapse all rewrite that set for the current project only. A newly added item opens itself.
- **List / Grid** is a preference in `localStorage` (`storageKeys.studioMediaView`, default
  `list`). Grid is overview only: `auto-fill, minmax(200px, 1fr)` tiles, capped at four columns by
  a container query, each with a thumbnail (thumbnail → poster → image / first gallery image /
  first screenshot → a local video's first frame), the same row text and actions. Clicking a tile
  switches to List with that card open and scrolls to it — the form is never crammed into a tile.
- A gallery stays **one** card; its images are edited inside it, as before.
- **Drag to reorder (session 19).** Every List row and Grid tile has a `GripVertical` grip
  (`.studio-media-grip`, `aria-label`/`title` "Drag to reorder media") beside the `#NN`. Only the
  grip is `draggable`; the card is a drop target. Native HTML5 drag and drop, with no dependency.
  The drag image is the whole card, and the payload uses a private MIME type, so text fields
  inside an open card won't accept it. `.studio-media` handles `dragover`/`drop`: the pointer's
  top or bottom half (List) or left or right half (Grid, where rows wrap) picks before or after
  the card under it, drawn as a `--c-accent` box-shadow line (`is-drop-before`/`is-drop-after`).
  A target on either side of the dragged item shows no line and does nothing. On drop,
  `slotIndex(from, slot)` in `lib/utils.ts` turns the insertion slot into a target index, and the
  arrows' `move(from, to)` applies it, so there is one `moveItem` call and one `items` array in
  both views. Keys are the media id (`itemKeys`, which adds the position only for a repeated id).
  Open cards stay open after a move, and their editors keep their internal state. Touch devices
  keep the arrows as the fallback.

None of this touches the schema, the draft or the export — checks 28 and 35 assert it.

**One collapsible primitive (sessions 20–21).** Every fold in the Studio draws through three
exports of `parts.tsx`:

- **`Collapsible`** is the card: the media-card look (`studio-rep__item studio-media-card`, a ~52px
  head). The head is one real button (`aria-expanded`, `aria-controls`) holding an optional `#NN`
  (`index`), a `tag`, the `title` and a one-line `summary`. `lead` (a drag grip) sits before it and
  `actions` (move, duplicate, delete) after it, both *siblings* of the button, so using one never
  toggles the card. The chevron comes last. The body, wrapped in a `StudioBoundary`, mounts only
  while open. It is controlled (`open` + `onToggle`) or self-contained (`defaultOpen`, false).
  Extra attributes land on the card, which is how `MediaList` passes its `data-media-*` drag data.
- **`useFolds<K>()`** holds one collection's open ids in a `Set` in component state, empty at mount:
  `isOpen`, `toggle`, `reveal` (a new item), `set` (Expand all is `set(ids)`, Collapse all is
  `set([])`), `rename` (an id edit keeps its card open) and `props(id, summary)` to spread on a
  `Section`.
- **`FoldBar`** is the row above a collection: its own children (the media List/Grid switch, the
  project Preview button), a count, and Expand all / Collapse all for that collection only.

`Section` with `onToggle` is now a `Collapsible`. `Repeater` with `fold={{ folds, id }}` draws each
row as one, and opens a newly added row itself. Without `fold`, rows are the plain always-open
rows as before.

Users:

- **Projects:** the seven sections (below).
- **Media:** `MediaList` List cards. The grip is the `lead` and the tools are the `actions`.
- **Folders, Experience and Capabilities:** entries fold by id.
- **Profile & CV, Desktop & Dock and Appearance:** every section folds, with a digest (counts,
  names, `Light by default · toggle on`, `Custom typography`).

Each of these has its own bar. Not folded:

- **Export & Import:** a short linear flow.
- **Small nested lists** (links, credits, metrics, socials, alert buttons, gallery images,
  screenshots): each row is a few fields.
- **The Appearance role blocks:** they live inside the Typography section.
- **`Advanced`:** it stays its own `<details>`.
- **Folder intro:** a `Section` with local state.

The old `studio-section--fold` and `studio-detail__bar` CSS is gone. Checks 28, 29, 35, 40 and 41.

**Project sections fold (session 17).** `Section` in `parts.tsx` takes optional
`open` / `onToggle` / `summary`; with `onToggle` it renders its title as a real button
(`aria-expanded`, `aria-controls`) and mounts its hint and fields only while open. Other panels
don't pass it and are unchanged. `ProjectsPanel` folds its seven top-level sections — Identity,
Tile, Case study, Media, Project banner, Links, Credits (`FOLDS`) — all collapsed by default, each
with a one-line digest from `foldSummaries()` (title · company · year, `Medium · 4:3`, `3 fields ·
2 metrics · 0 sections`, `14 items`, `Image` / `Video` / `None` / `Legacy hero`, `2 links`,
`1 credit`). Open state is a `Set<Fold>` in component state. It resets only when a *different*
project is chosen (`choose()`), not whenever the id changes, because typing a new project's title
renames its id. A new project opens on Identity. **Expand all / Collapse all** above the sections
rewrite that set and nothing else. Media is two levels: the Media fold holds `MediaList`, whose
cards fold on their own as above; closing the Media fold unmounts the list, so its open cards reset.

**Draft preview (session 17).** A **Preview** button above the sections mounts
`panels/ProjectPreview.tsx` as a full-screen layer inside `.studio`, and only while it is open.
It gets `draft` as a prop and draws it with the live renderers:

- **Project** → `CaseStudyBody` (from `ProjectApp.tsx`, already prop-driven): banner, header,
  facts, narrative, media masonry, Focus Mode, footer, links.
- **Folder** → `WorkView`, extracted from `ProjectsApp` with no behaviour change: the filter row,
  featured-then-`order` sort, `ProjectGrid`, `Tile` and `projectThumb`. `ProjectsApp` is now
  `WorkView` fed `usePortfolio()` and `openProject`; the preview feeds it the draft and a local
  callback that switches the preview to Project mode for that card. It starts on the edited
  project's folder.

Nothing is exported or saved, no window is opened, the hash is not touched and the published
portfolio is not read — check 29 pins this and fails if the preview draws `case` / `work` / `tile`
markup of its own. **Desktop / Narrow / Mobile** set only the stage width (full / 860px / 400px);
the preference is `storageKeys.studioPreviewWidth`. The masonry and the Work grid measure their own
container, so they respond as in a resized window. The few rules keyed to the viewport
(`@media (max-width: 640px)` in `apps.css`) do not fire, because the viewport has not changed.
Focus Mode portals to `<body>` on `--z-focus`, so it opens above the preview. Escape closes Focus
first, then the preview.

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

**The visitor-facing OS uses two faces only: Heading and Body (session 20).** `--font-mono`
still exists, but only the Studio and the content-error screen use it. The class named `.mono`
in `global.css` is the shared small-label class. It's used by `Meta`, `Field`, `Divider`, Quick
View, CV, Experience, Focus Mode facts, media hosts and others, and it is now set in
`--font-body`. That one class was what put a code face into so many places. `studio.css`
scopes `.studio .mono` back to `--font-mono`, except inside `.studio-preview__stage`, which has
to match the live site. The direct `--font-mono` uses in visitor CSS (note body, contact and
Quick View email, poster caption, generative scene label) are `--font-body` now. `check-ui` 36
fails if `--font-mono` comes back into a visitor stylesheet.

**App content doesn't repeat its window title.** No component injects the app name. Each app
used to open with a hard-coded `<Meta>` eyebrow that matched its registry label (About,
Capabilities, Contact, CV's "Curriculum Vitae", Experience). Those eyebrows are gone, and the
window chrome names the app. `NoteApp` starts straight on `note.body`, with no filename header
or line count. `check-ui` 37 compares every `<Meta>` in the apps against the registry labels.
Real section headings (CV sections, project footer labels, skill groups) stay.

An empty folder renders its intro, if it has one, and nothing else. There is no placeholder.

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
