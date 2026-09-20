# ASAAD.OS

The portfolio of **Asaad Jalkhi** — marketing, creative and digital — presented through a
personal computer interface.

**Portfolio first, operating system second.** The Work window opens immediately and fills the
screen; the OS is the navigation and personality layer, not the point. Project imagery
supplies the colour, so the interface itself stays neutral.

Two ways in, both first-class:

- **Desktop** — draggable windows, an editorial Work grid, folders, media, command palette.
- **Quick View** — a conventional, readable portfolio for anyone with 60 seconds.

React 19 · TypeScript · Vite 7 · Zustand · Zod · GSAP · react-rnd · lucide-react.
Static build. No backend, no database, no secrets.

> **New to this repo?** Read [`PROJECT_STATUS.md`](PROJECT_STATUS.md) first — it says what is
> built, what is missing and what was already decided.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

The site ships with demo content, so it looks complete immediately — you do not need to add
any assets before you can see it.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type check, then build to `dist/` |
| `npm run preview` | Serve the built `dist/` locally — **always check this before deploying** |
| `npm run lint` | Type check only (`tsc -b`) |

### Keyboard

| Keys | Does |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette — search projects, folders, apps, notes |
| `Q` | Toggle Quick View |
| `Esc` | Close the palette |
| `⌘⇧T` / `Ctrl+Shift+T` | Tidy windows into a grid (also rescues off-screen windows) |
| `Alt+Tab` | Cycle window focus |

### Routes

Hash-based, so refreshing any URL works on GitHub Pages.

| Route | Opens |
| --- | --- |
| `#/` | The desktop |
| `#/quick` | Quick View |
| `#/project/<project-id>` | Desktop with that case study open |
| `#/studio` | Portfolio Studio (asks for a PIN if one is configured) |

---

## How content works

**You never edit React components to change what the site says.** Everything lives in:

```
src/content/portfolio.json
```

It is validated against a Zod schema in `src/types/content.ts` at load time. If the JSON is
wrong, the site shows a readable error listing each bad field — it does not render a blank
page and it does not crash.

Top level:

| Key | What it holds |
| --- | --- |
| `profile` | Name, positioning, about copy, the About window, contact copy, email, socials, CV |
| `settings` | Theme + wallpapers, boot sequence, custom cursor, Studio visibility + PIN, SEO |
| `desktop` | Icons, widgets, dock links + which windows open at launch |
| `alerts` | The joke system dialogs behind the creative-app icons |
| `folders` | The folders on the desktop and in the Projects window |
| `projects` | Every project and its case study |
| `experience` | Work history |
| `skills` | Capability groups |
| `notes` | The plain-text files on the desktop |

Day-to-day recipes live in [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md). How the code is put
together is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

### Adding a project by hand

Add an object to `projects` in `portfolio.json`. Only five fields are required:

```jsonc
{
  "id": "gaf-brand-marketing",     // lowercase + dashes, must be unique
  "title": "GAF — Brand Marketing & Growth",
  "folder": "gaf",                 // must match a folder id
  "summary": "One line shown on cards and list rows.",
  "featured": true,                // shows in Quick View → Selected Work
  "demo": false,                   // true = sample content, labelled in the UI

  "company": "GAF",
  "year": "2026",
  "role": "Marketing Executive",
  "disciplines": ["marketing", "creative"],
  "categories": ["Brand", "Campaigns"],
  "tools": ["Meta Ads", "Premiere Pro"],

  // Art-directs this project's size and shape in the Work grid. Optional —
  // defaults to a medium 4:3 tile. span: sm | md | lg | xl (3/4/6/8 of 12 columns).
  "tile": { "span": "lg", "aspect": "16:9" },

  "caseStudy": {
    "challenge": "...",
    "approach": "...",
    "execution": "...",
    "results": "...",
    "metrics": [{ "label": "Reach", "value": "1.2M" }]
  },
  "media": [{ "id": "m1", "type": "image", "src": "media/gaf/hero.jpg" }],
  "links": [{ "label": "Live site", "url": "https://…", "kind": "website" }]
}
```

Save the file — the dev server reloads and the validator tells you immediately if anything
is off.

### Adding media

Local files go in `public/` and are referenced **without a leading slash**:

```
public/media/gaf/hero.jpg   →   "src": "media/gaf/hero.jpg"
```

Paths are resolved through `src/lib/paths.ts` so they keep working in a GitHub Pages
subdirectory. Supported `type` values:

| Type | Needs | Notes |
| --- | --- | --- |
| `image` | `src` | Lazy-loaded; falls back to generated art if missing |
| `gallery` | `items[]` | Several images, each with its own shape and caption. **Not something you pick** — add an Image in the Studio, then "Add another image" |
| `video` | `src` or `url` | A local file or a direct `.mp4`/`.webm` URL. Add `poster` for the still frame |
| `youtube` / `vimeo` | `url` | Loads and plays muted as it scrolls into view |
| `instagram` | `instagramUrl` **or** `url` | The permalink alone is enough. Add `thumbnail` anyway — embeds fail often, and it becomes the cover plus "View original post" |
| `drive` | `url` | A Google Drive share link. **The file must be shared so anyone with the link can view it.** Drive's own player is used, so autoplay is not guaranteed — give it a `thumbnail` |
| `website` | `url` + `screenshots[]` | A "Visit Website" link plus your own screenshots. The site is **never** embedded |
| `pdf` | `src` | |
| `embed` | `url` | Any other embeddable URL |

`aspect` shapes the frame and sizes Focus Mode — use `9:16` for Reels, `4:5` for portrait
posts. **Leave it out and it is automatic**, meaning the media's real intrinsic ratio: the
image's `naturalWidth/naturalHeight`, the video's `videoWidth/videoHeight`, or the cover
image's shape for an opaque embed. There is one way to say automatic and it is omitting the
field. `thumbnail` / `poster` is the cover: shown before playback and used as the fallback
whenever the media can't autoplay.

`heroMediaId` on a project names the single item that opens the case study, at its own
aspect ratio. Omit it and the case study opens on its title, which is a real choice. It is
**not** inferred from `featured` — that flag now means only "give this its own full-width
row in the body". Set `showHeroInMedia: true` to have the hero also appear below.

`generative` is **deprecated**: it still renders, and existing content using it is
untouched, but it is no longer offered when adding media. `iframe: true` on a `website` item
is inert — it is ignored by the renderer and kept in the schema only so old content
validates.

`demo: true` means one thing only — *this is fictional placeholder content* — and adds a
visible "Sample" badge. It is **not** a way to skip validation; if a field is missing the
Studio names it.

Media loads as it approaches the viewport and plays muted and inline when it is on screen.
There is no "Load embed" button to press, and `prefers-reduced-motion` is respected.

**Missing images never break the page.** `SmartImage` renders a generated `Poster` instead,
which is why the demo content looks complete with an empty `public/media/` folder.

---

## Portfolio Studio

A visual editor at **`#/studio`** (or from the dock/command palette). It edits everything
above without touching JSON by hand: projects, folders, experience, capabilities, profile,
CV, desktop icons and notes — with reorder, duplicate and delete for both projects and their
media.

Everything is editable there, including the Work-grid tile size/shape, Instagram permalinks,
the About window, theme and wallpapers, dock links, widgets and the alert jokes. The
navigation is grouped by what you are trying to do — **Your work**, **About you**,
**The desktop**, **Publish** — and ids and coordinates are tucked into **Advanced** drawers,
because you should never have to type either one.

### The Studio PIN

`settings.studioPin` (Studio → **Appearance**) puts a passcode screen in front of the Studio.
Empty means no gate.

> ⚠️ **This is a privacy gate, not security, and it is not trying to be one.** The site is
> static — there is no server that could check a secret — so the PIN is compiled into the
> same JavaScript bundle the browser downloads, and anyone who opens devtools can read it.
> It stops casual visitors wandering in. That is the whole goal.
>
> If content genuinely must not be touched, edit `portfolio.json` locally and deploy a build
> you trust. There is no visibility switch to flip — see below.

The unlock is kept in `sessionStorage`, so it lasts as long as the tab.

**The Studio cannot publish, by design.** This site is static: writing to the repository
from the browser would mean shipping a GitHub token in client-side JavaScript where anyone
could read it. So the workflow is:

1. Edit in the Studio. It validates as you type — export is blocked while anything is invalid.
2. Click **Download portfolio.json** (or **Copy JSON**).
3. Replace `src/content/portfolio.json` with that file.
4. Commit and push. GitHub Actions rebuilds and redeploys, usually in under two minutes.

**Import JSON** loads a file back in, so you can keep editing an export later. Your draft is
backed up to `localStorage`, so a refresh mid-edit is not destructive; **Discard changes**
resets to the committed content.

**The Studio is already hidden from visitors.** It is not an app in ASAAD.OS: no dock icon,
no desktop icon, no menu-bar entry, no command-palette or search result. The only way in is
typing `#/studio` in the address bar, which always works — so there is no setting to toggle,
and `settings.showStudio` no longer exists. (Old content files carrying it still load fine;
the key is simply ignored.)

It opens full-screen rather than in a window, shows the PIN gate first if one is configured,
and is lazily loaded, so visitors who never go there never download it.

---

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` handles it: type check → build → SPA fallback → `.nojekyll`
→ deploy. On every push to `main`.

**One-time setup:**

1. Push the repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. The Actions tab shows the deploy; the URL appears when it finishes.

### The base path — you do not need to change it

`vite.config.ts` uses `base: './'`, so the same build works at:

- a user site — `asaad.github.io`
- a project subdirectory — `asaad.github.io/asaad-os/`
- a custom domain

Do **not** hardcode your repo name. If you ever need an absolute base, set the `BASE_PATH`
environment variable instead of editing the config.

### Custom domain

1. Add a `CNAME` file to `public/` containing only your domain, e.g. `asaad.com`.
2. Point DNS at GitHub: a `CNAME` record for `www`, or `A` records for the apex
   (`185.199.108–111.153`).
3. **Settings → Pages → Custom domain**, then tick **Enforce HTTPS**.
4. Update the placeholder URLs in `index.html` (`canonical`, `og:url`) and
   `settings.seo.url` in `portfolio.json`.

---

## Replacing the demo content

Profile, contact details, CV and work history are already real. What is still placeholder:

| Placeholder | Where | Status |
| --- | --- | --- |
| LinkedIn + Instagram URLs | `portfolio.json` → `profile.socials` **and** `desktop.dockLinks` (both still point at the bare site) | ⬜ needs your real URLs |
| Wallpapers | `settings.theme.wallpaperLight` / `wallpaperDark` are unset — both modes use the built-in gradient | ⬜ drop images in `public/wallpapers/` |
| Studio PIN | `settings.studioPin` is the placeholder `2468` | ⬜ change it in Studio → Appearance |
| About copy | `profile.aboutPage` was drafted from the CV and skills | ⬜ rewrite it in your own voice |
| Folder icons | `folder.icon.image` is unset — generic folder glyphs | ⬜ optional: company logos in `public/icons/` |
| Sample projects | `portfolio.json` → `projects` — 9 of 10 are `demo: true` | ⬜ replace one at a time |
| `og:image` | `index.html` — currently an SVG; social platforms want a 1200×630 PNG | ⬜ optional |
| Site URL | `settings.seo.url` is deliberately omitted until there is a real domain | — |

### Replacing one sample project with real work

1. Drop your files in `public/media/<project>/`.
2. In `portfolio.json`, find the project and replace `title`, `summary`, `company`, `year`,
   `role` and the `media` array with yours.
3. Delete the `caseStudy` prose that starts *"Sample placeholder text."* — or rewrite it.
   Sections you leave out simply don't render.
4. Set **`"demo": false`**. That removes the *sample* label from the UI.
5. Adjust `tile` if the new imagery wants a different shape in the grid.

Nothing else needs touching — no React file has to change to add or remove work.

### Replacing the CV

The current CV is **`public/cv/Asaad_CV.pdf`**, referenced as `profile.cv.file`. To swap it:

1. Put the new PDF in `public/cv/`.
2. Set `profile.cv.file` to `cv/<your-file>.pdf` (no leading slash).
3. Optionally set `label`, `updated` and `preview`.
4. `profile.cv.sections` is the text version rendered inside the CV window — keep it in sync
   so the CV is readable without downloading anything.

### Changing the desktop

`desktop.items` is the icon layout. `x`/`y` are **percentages** of the desktop area, so it
scales with the viewport. (`rotate` still exists in the schema but is no longer used — tilted
icons read as decoration.) `desktop.autoOpen` lists the windows already open at launch —
keep it to **two**: the Work window, dominant, plus at most one small secondary.
Easiest done visually in the Studio's **Desktop** panel.

**Icons take one image per theme.** `icon.imageLight` is used in light mode,
`icon.imageDark` in dark; either may be omitted, and the legacy single `icon.image` covers
both. Place the files in `public/`, then reference them without `public/` and without a
leading slash (`icons/logo.png`).

Every icon is drawn **bare** — 72px, `object-fit: contain`, no plate behind it, no tint over
it, nothing clipping it. A transparent PNG looks on the desktop exactly like it looks in the
file, and the `icon.text` monograms and generic glyphs are drawn the same way, as marks with a
label rather than tiles. `icon.tint` colours the monogram letters, and is no longer part of
normal icon editing in the Studio.

### Fonts

`settings.typography` is the whole type system: three roles, each free to have its own typeface, and
one global scale.

```json
"typography": {
  "font":    { "family": "Asaad", "file": "fonts/asaad-font.woff2" },
  "display": {
    "font": { "family": "Asaad Display", "file": "fonts/asaad-display.woff2" },
    "size": 40, "weight": 600, "tracking": -0.03, "leading": 0.95
  },
  "heading": { "size": 21, "weight": 500, "tracking": -0.011, "leading": 1.10 },
  "body":    { "size": 15, "weight": 400, "tracking": 0,      "leading": 1.50 },
  "scale": 100
}
```

Top-level `font` is the **shared** face, used by every role that does not name its own. Any role may
override it with a `font` of its own, as `display` does above — that is how a display face gets paired
with a different text face, while `heading` and `body` here still use the shared one. Every field is
optional at every level: `font` alone is a single font for the whole site, and no `font` at all leaves
the native system stack.

The roles are DISPLAY (rare, large, editorial), HEADING (media titles, project titles, section and
window headings) and BODY (captions, paragraphs, metadata). Variable and static fonts are both fine;
there is no per-weight file to supply and nothing to map.

`font.family` alone selects a font already on the visitor's machine. Add `file` — a path under
`public/`, by convention `public/fonts/`, as `.woff2` / `.woff` / `.ttf` / `.otf` — and that file
ships with the site and is loaded via the `FontFace` API. **There is no Google Fonts dependency and
no external font service**, by design: the site renders the same offline and in five years.

`scale` is a percentage over typography and nothing else — icons, media, the dock, windows and
spacing do not move.

Every field is optional, and so is the whole object. Configure nothing and the native system stack is
used at the sizes the design already used, which is a legitimate final answer. A font that fails to
load falls back silently with one console warning; it never blanks the page. The older
`primary` / `secondary` pair still works and needs no migration.

Media items have their own optional `title`, shown above the caption and used as the heading in Focus
Mode. It never falls back to the project's title: no title means no title.

---

## Adding a whole new content type

Say you want `spotify`:

1. **Schema** — add `'spotify'` to `mediaTypes` in `src/types/content.ts`.
2. **Adapter** — create `src/components/media/adapters/SpotifyMedia.tsx` taking `AdapterProps`
   from `src/components/media/types.ts`.
3. **Register** — add the case to the switch in `src/components/media/MediaRenderer.tsx`.
4. **Style** — add any CSS to `src/components/media/media.css`.

Nothing else changes: the Studio picks up the new type automatically (its dropdown is built
from `mediaTypes`), and so does the validator.

Adding a new **app window** is one entry in `src/components/windows/registry.tsx` — id,
label, icon, component, and `inDock: true` if it belongs in the dock.

---

## Troubleshooting

**Blank page / 404s on assets after deploying.** Almost always the base path. Keep
`base: './'` and reference assets without a leading slash. Confirm locally with
`npm run build && npm run preview`.

**Page 404s when refreshing a deep link.** The app uses hash routing specifically to avoid
this. If you see it, something replaced a `#/…` link with a real path.

**CSS or JS files 404 on Pages.** The `.nojekyll` step in the workflow prevents Jekyll from
eating files starting with `_`. Don't remove it.

**"Content could not be loaded".** The JSON no longer matches the schema; the screen lists
each field and why. Common causes: a project pointing at a folder id that doesn't exist, a
duplicate project id, or an `id` with capitals or spaces (lowercase, numbers and dashes only).

**The build fails on `tsc -b`.** Run `npm run lint` locally for the same output. The
deploy workflow runs it too, so this fails the deploy before anything ships.

**Images don't appear but no error shows.** Expected: a missing file quietly falls back to
generated poster art. Check the path is relative to `public/` with no leading slash.

**Changes not showing on the live site.** Check the Actions tab finished green, then
hard-refresh. Pages caches aggressively.

**"Your saved Studio draft was created from an older version of the portfolio."** Not an
error — a safety net. The Studio noticed your browser's saved draft was started from a
different `portfolio.json` than the one on disk, and refuses to guess which is newer. Pick
**Load current portfolio** unless you are certain the draft is the newer work, and use
**Download the old draft** first if you want to compare. See CONTENT_GUIDE → *I lost my
Studio edits*.

**A video or embed doesn't play.** It should start on its own, muted, as it scrolls into
view — there is no button to press. If it stays still: check the path or URL in Studio (the
media editor names the exact missing field), and remember Instagram embeds fail regularly
for reasons outside the site's control (private accounts, ad blockers, rate limits). That is
what **Cover / Thumbnail** is for. `prefers-reduced-motion` also intentionally suppresses
autoplay.

**A Reel or portrait video looks stretched.** Set **Aspect ratio** to `9:16` (or `4:5` for
portrait posts) on that media item. The frame and Focus Mode both size themselves from it.

---

## Conventions worth keeping

- All styling comes from the tokens in `src/styles/tokens.css`. No ad-hoc colours or spacing.
- **The chrome is neutral — black, off-black, white, warm white, grey.** Colour is the
  project imagery's job. No neon accents, no glowing borders.
- **Monospace is never the dominant font**, and tags are quiet labels, not filled badges.
- Buttons, tags, fields and toggles come from `src/components/ui/Ui.tsx`. Don't hand-roll them.
- Anything invented is flagged `demo: true` and labelled in the UI. Never present a fictional
  number as a real achievement.
- Animations stay quick and respect `prefers-reduced-motion`.
- No analytics, no trackers, no secrets in the client.
