# Content Guide

How to keep ASAAD.OS up to date. No coding required — every task below is either clicking
around the Studio or editing one file.

Everything the site says lives in **one file**: `src/content/portfolio.json`.

Two ways to edit it:

- **The Studio** (easier) — run `npm run dev`, then type `#/studio` at the end of the address
  (e.g. `http://localhost:5173/#/studio`), edit visually, export the file.
  There is no button anywhere on the site that opens it — **typing the address is the way in**,
  by design, so visitors never stumble into your editor. If you set a PIN, you'll be asked for
  it first. The Studio then fills the whole screen; press Back or go to `#/` to leave.
- **By hand** — open `src/content/portfolio.json` in any editor.

If you break something, the site tells you exactly which field is wrong. You cannot silently
break it.

---

## The publishing loop

Every change ends the same way:

1. Edit (Studio or by hand).
2. In the Studio: **Export JSON → Download portfolio.json**.
3. Replace `src/content/portfolio.json` with the downloaded file.
4. Commit and push to GitHub.
5. Wait ~2 minutes. The site updates itself.

> **Why can't the Studio just save it?** The site is static — there is no server. Saving from
> the browser would require putting a GitHub password-equivalent into the page, where anyone
> could steal it. Downloading a file is the safe version of the same thing.

Editing by hand while `npm run dev` is running skips steps 2–3; the page reloads instantly.

---

## Adding a new project

1. **Put your media somewhere.** Either:
   - local files in `public/media/project-name/`, or
   - use links you already have (Instagram, YouTube, a live site).
2. Open the Studio → **Projects** → **New**.
3. Fill in the fields. Only four actually matter to start:
   - **Title** — what it's called
   - **Folder** — which folder it belongs in
   - **Summary** — one line, shown on cards
   - **ID** — lowercase with dashes, e.g. `gaf-launch-campaign`
4. Add **Media** (see below).
5. Turn **Demo content** *off* — it's real work.
6. Turn **Featured** *on* if it should appear in Quick View → Selected Work.
7. Export → replace → commit → push.

### Doing it by hand

Add to the `projects` array:

```jsonc
{
  "id": "my-project",
  "title": "My Project",
  "folder": "web",
  "summary": "One line about it.",
  "year": "2026",
  "role": "Marketing Executive",
  "disciplines": ["marketing"],
  "featured": false,
  "demo": false,
  "media": []
}
```

### Choosing how big it looks

The Work window is an irregular editorial grid, not a row of equal cards. Each project's
size and shape come from its own optional `tile`. Set it in Studio → **Projects** → pick a
project → **Tile in the Work grid** (plain-English **Size** and **Shape** dropdowns), or by
hand in `portfolio.json`:

```jsonc
"tile": { "span": "lg", "aspect": "16:9" }
```

`span` is `sm` · `md` · `lg` · `xl` (3, 4, 6 or 8 of 12 columns); `aspect` is any of
`16:9` `4:5` `1:1` `9:16` `3:2` `4:3`. Leave it out and you get a medium 4:3 tile.
Vary it — a grid where everything is `lg` stops being art-directed.

---

## Adding media to a project

In Studio → **Projects** → pick the project → **Media** → **Add media**.

Existing media items are listed as one-line cards — number, type, and the title (or file name)
— and are **collapsed** until you open them with the chevron or by clicking the row. A new item
opens straight away. **Expand all / Collapse all** sit above the list, and **List / Grid** switches
to a thumbnail overview; clicking a tile opens that item's editor back in the list. None of this
is saved into the portfolio — it is only how the Studio shows the list.

The project editor itself works the same way. **Identity, Tile, Case study, Media, Project banner,
Links and Credits** are collapsed when you pick a project, each showing a short summary (for
example `Media · 14 items`). Click a heading to open it, or use **Expand all / Collapse all** at the
top. Media has two levels: open the Media section, then open the individual cards you want.

Every other Studio tab works the same way. The sections of **Profile & CV, Desktop and
Appearance** and the entries of **Folders, Experience and Capabilities** start collapsed, each with
its own **Expand all / Collapse all**. The arrows, duplicate and delete buttons on a row never open
or close it.

**Preview** (top of the project editor) shows your current, unsaved edits exactly as ASAAD.OS
draws them. You don't need to export or replace `portfolio.json` first. **Project** is the real
case-study page. **Folder** is the real Work view, starting on this project's folder, with the
draft's cards and thumbnails; clicking a card previews that project. **Desktop / Narrow / Mobile**
change the preview's width. Close it with ✕ or Esc. Preview never saves or exports anything.

**Pick the Type first.** The fields below it change to match — you only ever see the two or
three that type actually uses, and a line underneath tells you what is still missing and
turns into "Ready to export." when it isn't.

| I have… | Type | Fill in |
| --- | --- | --- |
| A photo on my computer | `image` | **Image file or URL** — `media/gaf/hero.jpg` |
| A video file | `video` | **Local file or direct video URL** (+ optional **Poster / Cover**) |
| A YouTube link | `youtube` | **YouTube URL** — paste the normal watch or share link |
| A Vimeo link | `vimeo` | **Vimeo URL** |
| An Instagram post or Reel | `instagram` | **Instagram URL** (+ **Cover / Thumbnail**) |
| A video on Google Drive | `drive` | **Google Drive share link** (+ **Cover / Thumbnail**) |
| A website I built | `website` | **Website address**, then add **Screenshots** |
| A PDF | `pdf` | **PDF file or URL** — `media/gaf/deck.pdf` |
| Several images | — | Add an **Image**, then press **"+ Add another image"** |

### Giving a piece of media its own title

Every media item has an optional **Media title** — the name of that one piece of work, for example
`French Toast — Behind the Scenes`. It appears above the caption in the project and as the heading in
Focus Mode when you click the item open.

It is **optional and never inherited.** Leave it empty and no title is shown at all — the project's
title is *not* used in its place. That is deliberate: ten photographs in one project are not ten
items all called the same thing, and a project name sitting on top of every image tells the visitor
nothing about the image. The project, company and year are still there in Focus Mode as one quiet
line at the bottom of the information column, where they read as context rather than as a title.

So: give a title to the items that have one, skip it on the ones that do not, and the layout is
correct either way. The reading order in Focus Mode is **Media title → Caption → Tools → Credit →
the external link**, and any part you leave empty is simply not rendered.

Captions are separate and can be as long as you like: press Enter for a new line and the line breaks
are kept.

### Tools: the project's, and the item's

There are **two** Tools fields, and they answer two different questions.

**The project's Tools** (Studio → *Projects* → the project itself) is everything you used anywhere in
that case study — `Adobe Premiere Pro, Adobe Photoshop, Blender`. It appears in the **project
footer**, next to Tags and Credits, as the software list for the whole piece of work.

**A media item's Tools** (Studio → the media item, under Caption) is what made *that one thing* —
`Sony FX3, Adobe Lightroom` on a photograph, `Blender, Adobe After Effects` on a render. It appears
**only in Focus Mode**, when you click the item open.

This used to be one field doing both jobs, and the project's list was printed beside every item: a
photograph in the project above claimed it had been made in Blender, because something else in the
same project had. Now they are separate, so each one can be true.

Media Tools is **optional and never inherited**. Leave it empty and the Tools line is simply not
shown — the project's list is *not* used in its place, and you will never see "Tools —" with nothing
after it. Old media items that predate the field keep working exactly as they are; fill it in on the
items where it says something.

**Credits stay with the project.** There is no per-item Credits field and there is not meant to be —
the project's Credits section covers the people who worked on the work. (An individual item does have
a one-line **Credit** for a photographer or collaborator, which is a different, smaller thing — see
below.)

### Date

Every media item has an optional **Date**, next to Tools: when that piece of work was made or
published. It is plain text, so write it however it reads best — `March 2026`, `Summer 2025`,
`2026-03-14` are all fine. Nothing sorts or filters by it, so there is no format to get right.

Like Tools, it is shown **only in Focus Mode**, and leaving it empty shows nothing at all. The
project's own **Year** is separate and still dates the case study as a whole.

### What shows where

The ordinary project page — the media grid you scroll — shows each item's **title and caption**, and
nothing else. Everything else waits until somebody clicks an item open:

| Field | The project grid | Focus Mode |
| --- | --- | --- |
| Media title | ✓ | ✓ |
| Caption | ✓ | ✓ |
| Tools (the item's) | — | ✓ |
| Date | — | ✓ |
| Credit (the item's) | — | ✓ |
| Project Tools & Credits | in the **footer** | — |

**Credit is worth filling in and no longer appears on the tile.** It used to print under every
picture in the grid, which turns into a wall of repeated names the moment several items share a
photographer. Keep filling it in: it is shown, in full, when the item is opened. Nothing you have
already written was lost — it simply moved to where there is room to read it.

### Several images: galleries

You don't pick "gallery" from the list. Add an **Image** as normal, then press
**"+ Add another image"** underneath it — the picture you already chose becomes image one,
and you get a numbered list to add more. Each image keeps **its own** source, alt text,
caption and shape, and can be reordered, duplicated or removed. Take the list back down to a
single image and it quietly becomes a plain Image again.

Clicking any image in a gallery opens it full size, with ← and → stepping through the set.

### Websites

**The site itself is never embedded, and that is deliberate.** Nearly every real website
refuses to be shown inside another page (`X-Frame-Options`, `frame-ancestors`), so an
embedded one is a blank rectangle — and the ones that *do* allow it show up as somebody
else's cookie banner sitting in the middle of your portfolio. Neither is a portfolio piece.

So a website item is: the address, shown as an explicit **"Visit Website ↗"** link, plus
**your own screenshots**. With no screenshots it renders as a small link preview. With one,
that screenshot is the piece. With several, they lay out as a set and click through to full
size. `iframe: true` in older content is now ignored.

### Google Drive video

Paste the normal share link. Two things are worth knowing before you rely on it:

- **The file must be shared so anyone with the link can view it**, or visitors get Google's
  sign-in screen instead of your video.
- Playback runs inside **Google's own player**, which we cannot press play on from the
  outside. It often opens paused, and **autoplay is not guaranteed.** Add a
  **Cover / Thumbnail** so there is something of yours on screen either way.

A normal Drive share URL is not a video file and cannot be used as one — if you want
reliable autoplay, put an `.mp4` in `public/` and use the `video` type instead.

### Local file, or URL

Images and videos have **two buttons above the box: Local file and URL.** Say which you mean
and the field helps with that one. (YouTube, Vimeo, Instagram, Drive and Website are always a
URL — there is nothing to choose.)

**Local file.** Put the file inside `public/`, then say where it is. You can paste whichever
form you have and the field tidies it up when you click away:

```
media/gaf/reel.mp4                                ← what gets stored
/public/media/gaf/reel.mp4                        → media/gaf/reel.mp4
E:\asaad portifolio\public\media\gaf\reel.mp4     → media/gaf/reel.mp4
```

So Windows' **"Copy as path"** is fine: paste it, tab out, done. The stored path is always
relative to `public/`, because that is the only form that works once the site is published.

**A file outside `public/` is refused**, with "This file must be inside the project's `public/`
folder." That is not the Studio being fussy — a path like `E:\Downloads\clip.mp4` exists only on
your machine, so the published site would show nothing. Move the file into `public/` first.

**The field then goes and looks.** Under the box you'll see *Found public/media/gaf/reel.mp4*,
or *No file at public/… yet. Copy it there and this will clear.* A missing file is a warning,
not an error: you can write a project now and drop the assets in later.

**There is no Browse button, on purpose.** A web page is not allowed to know where a file on
your computer actually lives — browsers hide it deliberately — so a file picker here could only
pretend to work. Copying the path is the honest version.

**URL.** A full `https://` address to the file itself. External links are passed through
untouched.

### Two things that are easy to get wrong

**"Sample placeholder content" is a label, not a switch.** It means exactly one thing: *this
project or media is fictional placeholder content*, and it adds a visible "Sample" badge so
nobody mistakes invented work for real work. **It has never made validation pass and it
never will.** If an item is incomplete, the Studio tells you which field is missing — fix
the field. Ticking Sample on real work only mislabels your own portfolio.

**Cover / Thumbnail is your safety net.** It is shown before playback starts and used as the
fallback whenever the media can't autoplay. Strongly recommended for Instagram, whose embed
is the least reliable on the web — private accounts, ad blockers and rate limits all break
it. With a cover, visitors see your image plus "View original post"; without one they see an
empty box.

**Aspect ratio is on Auto, and Auto is real.** There is exactly one Auto, and it means *use
the media's own shape* — the image's real pixel dimensions, the video's real dimensions, or
the cover image's shape where the media is an opaque embed we cannot measure. Leave it alone
and a portrait photograph is portrait and a panorama is a panorama.

Set an explicit ratio only when you want to **force** a shape — `9:16` for a Reel whose
cover you haven't supplied, `4:5` for portrait posts. A forced ratio letterboxes rather than
crops: an explicit `16:9` on a tall picture is an instruction about the frame, not
permission to cut your work up.

**Caption, Alt text and Credit are three different things.** Caption is editorial copy —
write as much as the work needs, in as many paragraphs as it needs; line breaks are kept and
long captions wrap instead of running off the side. Alt text is what the picture *is*, for
screen readers. Credit is who else made it.

### The project banner

**Project banner** (its own section, above Media) is the wide band across the top of a case
study. It is **its own image or video**, not one of the project's media items — you point it at
a file, you don't pick from a list.

Three separate things, easy to confuse:

| | What it controls |
| --- | --- |
| **Tile in the Work grid** | How the project looks as a card in the Work window |
| **Project banner** | The wide band across the top of the case study |
| **Media** | Everything laid out down the page below the writing |

**"Full-width row"** on a media item has nothing to do with the banner — it means only "give
this item its own row across both columns" down in the body.

**What the banner accepts.** A **local file only** — an image or a video inside `public/`, same
path rules as everywhere else. Not a URL, not Instagram, YouTube, Drive or a website: those
bring their own player chrome and their own shape, and a band is neither.

**Any source shape works, so don't fight it.** The band is a fixed height — the same for every
project at the same window size — and the picture is cropped to fill it from the centre. It is
never letterboxed and never has black bars, whatever you give it. **Recommended: 1920 × 700**
(about 2.7 : 1), because that is roughly what actually survives the crop. A tall photograph will
work; you will just see the middle of it.

**A video banner is decoration, not a player.** It plays automatically, silently, on a loop,
with no controls and no progress bar. Use a few seconds of motion, not a film — the film belongs
in the media below, where people can watch it properly.

**Leave it as None and the case study opens on its title.** Nothing is drawn, and there is no
empty grey band — a case study that opens on its words is a real piece of art direction.

> **If you set a hero before:** older projects stored a hero by pointing at one of their own
> media items. Those still work and still display. The banner panel offers a one-click **"Use it
> as the banner"** if you want to convert; nothing is converted unless you press it.

### Media below the banner is shown in full

The banner is the one thing on the page that gets cropped. Everything in the media below is
shown **whole** — a 9:16 Reel, a portrait photograph and a panorama all keep their own shape,
and none of them is cut to fit a box.

Tall media is bounded rather than cropped: a portrait item is capped at roughly two thirds of
the screen's height and centred, so it is completely visible without being absurd to scroll
past. Clicking it still opens Focus Mode for a larger look — but you should never *need* Focus
Mode to see what something is.

**Media plays by itself.** There is no "Load embed" button — video and embeds load as they
approach the screen and play muted when they're on it. You don't configure this.

**A project with no media at all is valid.** `media: []` is a perfectly good project; the
case study just renders without a gallery.

**Missing images don't break anything.** If a file is absent, the site draws generated
artwork in its place, so you can build out projects before you've gathered the assets.

---

## Writing a case study

Studio → **Projects** → pick the project → **Case study** → **Add a case study**.

Fill only what you have — empty sections simply don't appear:

| Field | Ask yourself |
| --- | --- |
| Context | What was the situation? |
| Challenge | What was actually hard? |
| Objective | What were you asked to achieve? |
| Approach | How did you decide to attack it? |
| Execution | What did you actually do? |
| Results | What happened? |

**Metrics** are the headline numbers (Reach · 1.2M). If a number is invented for now, leave
**Demo content** on for that project so the site labels it as a sample. Never present made-up
results as real ones — it is the one thing that would sink the whole portfolio.

---

## Common tasks

### Reorder projects
Studio → **Projects** → select one → arrows in the top-right of the detail panel.
Within a folder, the **Order** number wins (lower first).

### Mark a project as featured
Studio → **Projects** → **Featured** toggle. Featured projects are the only ones in
Quick View → Selected Work. Keep it to your strongest 5–8.

### Rename a folder
Studio → **Folders** → click the folder's row to open it (every folder card starts collapsed;
**Expand all** opens them all) → change **Name**. Safe. (To change only the big heading inside the
folder, use **Folder intro → Intro title** instead.)
Changing a folder's **ID** is not — projects point at it. The Studio will tell you what broke.

### Add a folder
Studio → **Folders** → **Add folder**. Set a name, an ID, and a discipline for its colour.

### Give a folder an intro (banner, title, description)
Studio → **Folders** → open the folder → **Folder intro**. All three fields are optional:
- **Intro title** is the large heading above the cards. If you leave it empty, the folder
  name is used. The name is still what the tab says.
- **Description** is a paragraph about the brand or company. Line breaks are kept.
- **Banner** works exactly like the project banner: a local image or a silent looping video,
  cropped to the same band. Paste the path any way you like and it is cleaned when you leave the
  field.

If all three are empty, the folder opens straight onto its cards as before, and folders you
haven't touched need no changes. Press **Preview → Folder** to see the intro before exporting.

### Set a project's card thumbnail
Studio → **Projects** → **Identity** → **Thumbnail**. This works like every other file field:
paste `media/gaf/Thumbnails/cover.jpg`, or the full Windows "Copy as path" string, and it is
trimmed to the path inside `public/` when you leave the field. Paths outside `public/` are
refused. Choose **URL** for a remote image. If this is left empty, the card uses the first
media item.

### Edit the About window
Studio → **Profile & CV** → **The About window**. This is the long, human version:

| Field | What it is |
| --- | --- |
| **Opening line** | one strong sentence, set large at the top |
| **Positioning statement** | a short line under it — what you do, in your words |
| **Paragraphs** | how you work, what you care about. One paragraph per line |
| **Portrait** | a photo from `public/`, e.g. `media/portrait.jpg`. Optional |
| **Image strip** | a few more images — workspace, set, shelf |
| **Short lists** | small columns: "Currently", "Tools I live in", "Off the clock" |
| **Closing footnote** | a last quiet line. Good place for a joke |

Leave it all empty and the window falls back to **About paragraphs** (the short version used
by Quick View and search), which is under **Identity** in the same panel.

There are deliberately **no counters or statistics** in About. It is where a person speaks,
not where the site reports on itself.

### Change your email or social links
Studio → **Profile & CV** → **Contact**. Edit **Email** and the **Social links** list once and
you are done: that list is the single source of truth, and everywhere the site shows a link —
the Contact window, Quick View, the mobile layout and the dock shortcuts — reads from it.
There is nowhere to update a second time and no chance of two places disagreeing.

Each social link has a **Label** (Email / LinkedIn / Instagram), a **Handle** shown next to
it, a **URL**, and an icon. Email should be `mailto:` followed by your address; the rest are
ordinary `https://` links that open in a new tab. Email opens your mail app instead of a tab.

**Contact headline** and **Contact note** are the copy at the top of the Contact window;
leave the headline empty and it falls back to **Availability**. Contact is reached from the
**menu bar**, not the dock — see below for the dock shortcuts.

Also update the fallback email in `index.html` (search for `example.com`).

### Update your CV
1. Put the PDF in `public/cv/`, e.g. `public/cv/asaad-cv.pdf`.
2. Studio → **Profile & CV** → **CV** → **PDF path**: `cv/asaad-cv.pdf`.
3. Update **Text version** so the CV is readable in the window without downloading.

### Add a job to Experience
Studio → **Experience** → **Add role**. Company, role, period, then highlights one per line.
Link a project to add a "see the work" action.

### Edit capabilities
Studio → **Capabilities**. Grouped lists, one capability per line.
Deliberately no percentage bars — "Photoshop 95%" tells a recruiter nothing.

### Change what's on the desktop
Studio → **Desktop & dock** → **Shortcuts**. Give it a label, pick what it **opens**, and
optionally point **Icon image** at a logo in `public/` (or type a 1–3 character monogram).

**You do not set positions.** The desktop scatters new items for you, deterministically, so
the layout is the same on every visit without being grid-locked. Visitors can drag anything
and their arrangement is remembered in their own browser; dragged past an edge, an icon wraps
round to the other side. If you really want to pin something, the **Advanced** drawer has
X / Y / Rotate — you will almost never need it.

**Opens** can be: a folder, a project, a note, an app window, a piece of media, a URL inside
the in-OS browser, **an external site in a new tab**, or **a system alert**.

### Add an Email / LinkedIn / Instagram shortcut to the dock
Studio → **Desktop & dock** → **Dock links**. Label, one of five icons, and — optionally — a URL.

**Leave the URL empty and the shortcut uses your profile.** The `mail` icon becomes your
email address; the others match the social link with the same name. So a dock link labelled
"Instagram" with the Instagram icon and no URL points wherever **Profile & CV → Contact** says
Instagram is, and changing it there changes both at once. Fill the URL in only when you want
this one shortcut to go somewhere different.

They sit in their own segment at the right of the dock. Links open in a new tab; email opens
your mail app.

### Edit the joke alerts (Photoshop, After Effects, Blender, VS Code)
Studio → **Desktop & dock** → **System alerts**. Each has a title, a body, a tone
(info / caution / error) and up to two buttons. A desktop shortcut whose **Opens** is set to
"A system alert" points at one of them.

Keep them short and dry. They are a wink, not a comedy set.

### Add or edit a widget
Studio → **Desktop & dock** → **Widgets**. Three kinds, all self-contained — no network, no
live services:

- **Clock & date** — the time, with an optional place label.
- **Sticky note** — a short card in your own voice.
- **Reaction time test** — press Start, wait for the panel to turn blue, press it again, and
  it shows how many milliseconds that took. Your best score is remembered in your browser.
  There is nothing to configure beyond the title and where it sits, which is the point.

Two widgets on screen is plenty.

### Switch the site to dark by default, or lock the theme
Studio → **Appearance** → **Theme**. **Start in dark mode** sets what a first-time visitor
sees; **Let visitors switch** adds the sun/moon toggle to the menu bar. Turn it off and your
chosen mode is forced for everyone.

### Set the wallpapers
Studio → **Appearance** → **Wallpapers**. Put the images in `public/` and reference them
without a leading slash, e.g. `wallpapers/light.jpg`. Light and dark get their own image, and
switching theme cross-fades between them. Leave either empty and that mode uses its built-in
gradient.

Both are already set up: `wallpapers/light-theme-wallpaper.jpg` and
`wallpapers/dark-theme-wallpaper.jpg`, living in `public/wallpapers/`. To swap one, drop your
image in that folder and point the field at it. **Avoid spaces in the filename** — use
hyphens — because a space in an asset path is a reliable way to get a broken image in a
production build.

### Change the typography

Studio → **Appearance** → **Typography**. Three roles, a typeface each if you want one, one global
scale.

Change nothing at all and the site uses the native system font stack at the sizes it already uses.
That is a legitimate finished answer, not an unfinished one: it is a large part of why ASAAD.OS reads
as an operating system rather than a web page imitating one.

#### Adding a custom font

1. Put the font file inside `public/fonts/` — for example `public/fonts/asaad-font.woff2`.
2. In **Shared font** → **Font file**, write `fonts/asaad-font.woff2`. No `public/`, no leading
   slash. Paths are case-sensitive once the site is deployed, so type the folder and file name
   exactly as they are on disk.
3. In **Font name**, put whatever you want to call it. Any name is fine — it is just a label for the
   file you loaded.

That is the whole job for one font everywhere: the shared font is used by all three roles.

#### A different font per role

Each role has its own **Font name** and **Font file** as well, directly above its size and weight.
Fill them in and that role uses that face; leave them empty and it keeps the shared font. So pairing a
display face with a different text face is two more files and no new concepts:

| you want | fill in |
| --- | --- |
| one font everywhere | **Shared font** only |
| a display face + a text face | **Shared font** = the text face, **Display** → font = the display face |
| three unrelated faces | a font on each of Display, Heading and Body |

You never have to fill in three fields to change one, and the shared font is not wasted when a role
overrides it — the roles that did not override still use it.

`.woff2` is recommended and is much the smallest; `.woff`, `.ttf` and `.otf` also work in any browser
that supports them. A **variable** font and a plain single-weight font are both fine: if the file has
a weight axis the weights below come out of it, and if it does not, the browser handles it. You do
not need a second file for bold.

**One file per font is the whole workflow.** There is no ZIP upload, no scanning a folder for a
family, no separate Regular / Medium / Semibold / Bold uploads, and no weight-file mapping to
maintain. One file per role is a typographic choice; four files per role is inventory.

**Font name with no file** is also useful on its own: it selects a font already installed on the
visitor's machine. Good for Georgia, Helvetica or Times — nothing is downloaded.

**There is no Google Fonts and no font service.** The font file lives in the repository and deploys
like everything else, so the site renders identically offline, behind a corporate firewall, and in
five years when a hosted service has reorganised its URLs. The licence question is yours to check: a
font you may use on a website is not automatically a font you may self-host, though most modern
licences allow it.

If the path is wrong the site does not break — it quietly keeps the system font and logs one warning
in the browser console. Check there first if a font you expected does not appear.

#### The three roles

| role | where it is used |
| --- | --- |
| **Display** | Rare and large: a major project title, the About statement, a hero heading |
| **Heading** | Media titles, ordinary project titles, section headings, window headings, strong labels |
| **Body** | Captions, paragraphs, descriptions, metadata — everything you actually read |

Below its optional font, each role has the same four controls, and all four are plain numbers — you
never type CSS:

- **Size** — pixels, on a desktop screen. Smaller screens scale down from it automatically, and they
  scale Display hardest, Heading a little, and Body not at all.
- **Weight** — 300 Light through 800 Extrabold. A variable font uses this directly; a single-weight
  file may be synthesised by the browser, which is fine.
- **Letter spacing** — a small signed number. Negative is tighter, positive is looser, `0` is the
  font's own spacing. Useful range is about `-0.08` to `0.15`; most custom faces want a small
  negative value on Display.
- **Line height** — a multiple of the font size. `0.95`–`1.1` suits big titles, `1.5` suits
  paragraphs.

Leave any control empty and that one keeps its built-in value. You can tune Display and leave Body
alone.

There are no per-component font settings, on purpose. Buttons, menus, individual captions and single
projects do not get their own typography — three roles cover the whole site, and more controls than
that produces a site that no longer looks like one thing.

#### Global type scale

**Type scale (%)**, default `100`. It nudges every size at once. 85–120% is the useful range.

This exists because two fonts set at the same size genuinely render at different visual sizes, and
correcting that one control at a time is miserable. It moves **text only** — icons, media, the dock,
the windows, the spacing and every button stay exactly where they are.

The preview under each role is live and honest: it reads the same variables the site does, so if a
file failed to load you see the fallback here too rather than being told everything is fine.

### Change an icon (desktop shortcuts, folders, projects)
Every icon editor is the same three fields plus a light/dark preview pair.

- **Light mode image** — used in light mode, and in both modes if you leave the other empty.
- **Dark mode image** — use this when the light-mode logo disappears against a dark desktop.
  A mark drawn in black is invisible at night; a white one is invisible by day.
- **Fallback monogram** — up to 3 characters, shown when there is no image or the file is
  missing.

Place the files in `public/`, then reference them without `public/` and without a leading
slash — `icons/logo.png`.

**Nothing on the desktop is drawn on a plate.** No raised tile behind anything, no tint over
it, nothing rounding its corners off: a transparent PNG looks on the desktop exactly like it
looks in the file. That now goes for the fallbacks too — a folder, a document, a PDF and a
monogram are all drawn as a mark with a label under it, at the same size as your artwork, so
a desktop holding both reads as one set of things rather than two.

That is also why there is no longer a "Fallback tint" field in normal icon editing: a real
logo never touches it. Existing tints in your content still apply — they colour the monogram
letters themselves now, rather than a square behind them.

The two previews show light and dark side by side, each on the background it simulates, so
you find out about the invisible-logo problem here rather than after deploying.

### Put a PIN on the Studio
Studio → **Appearance** → **Studio PIN**. 4–8 digits; empty means no gate.

**This is a privacy gate, not security.** The site is static — there is no server to check a
secret, so the PIN ships inside the JavaScript bundle and anyone determined can read it in
devtools. It keeps casual visitors out of the Studio — it is a closed door on a room in your
own house, not a lock. If content genuinely must not be touched, edit `portfolio.json`
locally instead.

The PIN is asked for once per browser tab: unlock it and it stays unlocked until you close
the tab. Forgot it? It's in `settings.studioPin` in `src/content/portfolio.json`.

### Change which windows open at launch
Studio → **Desktop & dock** → **Windows open at launch**. Two or three is plenty — more feels
cluttered rather than alive.

### Edit the desktop notes (ideas.txt, dont_open.txt…)
Studio → **Desktop & dock** → **Notes**. This is where the personality lives. Keep it short and dry;
it's still a professional portfolio.

### Turn off the boot animation
Studio → **Profile & CV** → **Site settings** → **Boot sequence**.

### Hide the Studio from visitors
Already done, and there is no switch for it. The Studio isn't an app in ASAAD.OS: it has no
dock icon, no desktop icon, no menu-bar entry, and it never appears in search or the command
palette. The only way in is typing `#/studio`. Put a PIN on it (above) if you want a second
layer between the address and your content.

---

## When something goes wrong

### "Content could not be loaded"
The JSON has a problem. The screen lists every bad field and why. The usual causes:

| Message | Fix |
| --- | --- |
| `Unknown folder "x"` | The project's folder doesn't exist — pick a real one |
| `Duplicate project id` | Two projects share an id; ids must be unique |
| `Use lowercase letters, numbers and dashes only` | An id has capitals, spaces or symbols |
| `Media needs a src, a url or a thumbnail` | A media item is empty — fill one field or delete it |
| `points at a missing note/project` | A desktop icon targets something you deleted |

### Export is greyed out in the Studio
There are validation problems — they're listed in red at the top. This is on purpose: it
stops a broken file reaching the live site.

### I lost my Studio edits

The draft is saved in your browser, so a refresh is safe.

**If you see "Your saved Studio draft was created from an older version of the portfolio"** —
that screen is protecting you. It means `portfolio.json` has changed since you last saved a
draft (you exported and committed from another machine, or pulled someone else's change),
so the Studio will not guess which one you meant.

- **Load current portfolio** (the safe default) — starts from the real `portfolio.json`.
  Your old draft is discarded, but download it first if you're unsure.
- **Download the old draft** — saves it as `portfolio.old-studio-draft.json` so you can
  compare before deciding. Nothing is thrown away without a copy.
- **Use the old draft anyway** — only if you know it is the newer work.

**Reload from portfolio.json** in the sidebar does the same thing mid-session, with a
two-step confirm.

**Discard changes** resets to the committed content — that one is not undoable.

There is also `backup/portfolio.TRUTH.json` in the repo: a known-good copy kept as an
emergency reference. Compare against it; don't edit it.

### I pushed but the site didn't change
Check the **Actions** tab on GitHub. Green means deployed — hard-refresh your browser
(`Ctrl+Shift+R`). Red means the build failed; the log says why.

### An image isn't showing
The site quietly draws generated art when a file is missing. Check that the file is really in
`public/`, and that the path has no leading slash and no `public/` prefix.

---

## Before you send this to anyone

- [ ] Replace `hello@asaad.example.com` with your real email (`portfolio.json` + `index.html`)
- [ ] Replace `https://asaad.example.com/` with your real URL (`index.html` + Site settings)
- [ ] Upload your real CV and update the path
- [ ] Turn **Demo content** off on every project that is genuinely yours
- [ ] Delete the demo projects you're not replacing
- [ ] Check Quick View reads well on a phone
- [ ] Confirm every external link opens the right thing
