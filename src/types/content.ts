/**
 * ASAAD.OS — content model.
 *
 * The whole portfolio is data. This file is the single source of truth for
 * what that data is allowed to look like. Everything is validated with Zod at
 * load time so a typo in `portfolio.json` produces a readable error screen
 * instead of a blank page.
 *
 * Adding a new field: add it here (optional if existing content lacks it),
 * then use it in a component. Adding a new MEDIA type: extend `mediaTypes`
 * below and add an adapter in `src/components/media/adapters/`.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ atoms */

const nonEmpty = z.string().min(1);
const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers and dashes only');

/** The three lenses every piece of work is filed under. */
export const disciplines = ['marketing', 'creative', 'digital'] as const;
export const DisciplineSchema = z.enum(disciplines);
export type Discipline = z.infer<typeof DisciplineSchema>;

/**
 * Every media kind the renderer knows how to draw.
 *
 * `generative` is DEPRECATED (session 9). It is still validated and still
 * renders, because existing demo content uses it, but it is no longer offered
 * in the Studio's media-type picker and is not documented as a content type
 * anyone should reach for. Do not delete it from this list — doing so would
 * fail validation on every portfolio.json that still contains one.
 */
export const mediaTypes = [
  'image',
  'gallery',
  'video',
  'youtube',
  'vimeo',
  'instagram',
  'drive',
  'website',
  'pdf',
  'embed',
  'generative',
] as const;
export const MediaTypeSchema = z.enum(mediaTypes);
export type MediaType = z.infer<typeof MediaTypeSchema>;

/**
 * How a piece of media is shaped.
 *
 * There is exactly ONE way to say "automatic", and it is **leaving this field
 * out**. Auto means *use the media's own intrinsic ratio* — an image's
 * naturalWidth/naturalHeight, a video's videoWidth/videoHeight, a cover image's
 * real shape — falling back to a per-type default only when the real ratio
 * cannot be known (a cross-origin YouTube iframe, for instance).
 *
 * `'auto'` remains in the enum solely so older content that wrote the string
 * out keeps validating; `isAuto()` in `components/media/aspect.ts` treats the
 * string and the absent field as the same thing, and the Studio only ever
 * writes the absent form. Anything else is a manual override and always wins.
 */
export const AspectSchema = z.enum(['16:9', '4:5', '1:1', '9:16', '3:2', '4:3', 'auto']);
export type Aspect = z.infer<typeof AspectSchema>;

/**
 * Custom artwork for an icon — a folder, a desktop shortcut, a project.
 *
 * Resolution order:
 *   `imageLight` / `imageDark` — a file under /public per theme, so a dark logo
 *        and a light one can both be correct. Supply one and it is used for
 *        both themes; supply both and the resolved theme picks.
 *   `image`  — the original single-image field. Still honoured as the fallback
 *        for whichever theme-specific field is missing, so old content works.
 *   `text`   — a one-to-three character monogram ("Ps", "Ae") drawn on a tile.
 *   nothing  — the neutral default glyph for the item's kind.
 *
 * `tint` colours the MONOGRAM TILE only. It never touches a custom image: an
 * image icon is drawn bare, transparency intact, with no plate behind it. It is
 * no longer part of normal Studio icon editing — see `IconFields`.
 */
export const IconSchema = z.object({
  image: z.string().optional(),
  imageLight: z.string().optional(),
  imageDark: z.string().optional(),
  text: z.string().max(3).optional(),
  tint: z.string().optional(),
});
export type IconSpec = z.infer<typeof IconSchema>;

/** Which side of the desktop an auto-placed item is scattered into. */
export const ZoneSchema = z.enum(['left', 'right', 'any']);
export type Zone = z.infer<typeof ZoneSchema>;

/**
 * One image inside a gallery, or one screenshot of a website.
 *
 * The same shape serves both because they are the same thing from the reader's
 * side: a still with its own alt text, its own caption and its own shape. Each
 * carries an optional `id` so the Studio can reorder and duplicate rows without
 * React losing track of which row is which.
 */
export const MediaSubItemSchema = z.object({
  id: z.string().optional(),
  /** Local file under /public. */
  src: z.string().optional(),
  /** External image URL. Either this or `src`. */
  url: z.string().optional(),
  alt: z.string().optional(),
  /** Editorial copy for this one image. Newlines are preserved when rendered. */
  caption: z.string().optional(),
  /** Manual override. Absent = use this image's own intrinsic ratio. */
  aspect: AspectSchema.optional(),
});
export type MediaSubItem = z.infer<typeof MediaSubItemSchema>;

/**
 * One media item. Deliberately loose: a YouTube item needs `url`, a local
 * image needs `src`, an Instagram item works best with `url` + `thumbnail`.
 * `refine` below enforces the minimum each type actually needs.
 */
export const MediaItemSchema = z
  .object({
    id: nonEmpty,
    type: MediaTypeSchema,
    /** Local file under /public, e.g. "media/gaf/launch.jpg". */
    src: z.string().optional(),
    /** External URL (YouTube, Vimeo, Instagram, website, remote MP4). */
    url: z.string().optional(),
    /**
     * Instagram permalink. An alias for `url` that reads better on an
     * Instagram item; whichever is set wins.
     */
    instagramUrl: z.string().optional(),
    /** Still frame. Also the fallback when an embed cannot load. */
    thumbnail: z.string().optional(),
    /** Poster frame for <video>. Falls back to `thumbnail`. */
    poster: z.string().optional(),
    /**
     * This item's own title, e.g. "French Toast — Behind the Scenes".
     *
     * Optional, and **not** a fallback chain. It is distinct from
     * `project.title` (the case study) and from `caption` (editorial copy about
     * the item). Focus Mode shows it when it is set and shows **no title at all**
     * when it is not: substituting the project title made every individual image
     * in a project look as though it were called after the project, which is the
     * behaviour this field exists to end.
     */
    title: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    credit: z.string().optional(),
    /**
     * Manual shape override. Leave it out for Auto — the media's real ratio.
     * See `AspectSchema` above; there is only one way to say "automatic".
     */
    aspect: AspectSchema.optional(),
    /**
     * For type "gallery": the images it contains.
     *
     * A gallery is not a separate thing you choose in the Studio — it is what an
     * `image` becomes the moment you add a second picture to it. The first
     * image is carried over into `items[0]`, never discarded.
     */
    items: z.array(MediaSubItemSchema).optional(),
    /**
     * For type "website": stills of the site.
     *
     * A portfolio shows a site through its own screenshots, art-directed, at the
     * size you chose. It does not iframe somebody else's page — see `iframe`.
     * Zero screenshots is fine and renders a quiet link preview.
     */
    screenshots: z.array(MediaSubItemSchema).optional(),
    /** For type "generative": which built-in animated scene to draw. DEPRECATED. */
    scene: z.enum(['marquee', 'campaign', 'signal', 'grid']).optional(),
    /**
     * DEPRECATED for `website` (session 9) and ignored by `WebsiteMedia`.
     *
     * Framing a site you do not control produces one of two things and never a
     * third: a blank rectangle (the site sends X-Frame-Options / CSP
     * frame-ancestors, which most do) or someone else's cookie banner and
     * navigation sitting inside your case study. Neither is a portfolio piece.
     * Websites now show screenshots plus an explicit "Visit Website" link.
     *
     * The field is kept so existing content keeps validating, and `pdf` still
     * uses it. Nothing in the Studio writes it any more.
     */
    iframe: z.boolean().optional(),
    /** Flag placeholder media so the UI can label it honestly. */
    demo: z.boolean().optional(),
    /** Give this item its own row in a case study instead of the grid. */
    featured: z.boolean().optional(),
  })
  .superRefine((m, ctx) => {
    const problem = mediaProblem(m);
    if (problem) ctx.addIssue({ code: 'custom', path: [problem.field], message: problem.message });
  });
export type MediaItem = z.infer<typeof MediaItemSchema>;

/**
 * What (if anything) is missing from a media item — by TYPE.
 *
 * Two rules were being broken by the old single `refine`, and both mattered:
 *
 * 1. **`demo` was an escape hatch.** The old check passed anything with
 *    `demo: true`, so the Studio ended up telling people to either supply a
 *    source *or* tick Demo. That is a lie about what Demo means. `demo` has
 *    exactly one meaning — "this is fictional sample placeholder content" — and
 *    it is a labelling flag, never a way to silence a validation error. A real
 *    Instagram item with a permalink and nothing else is completely valid, and
 *    nobody should ever have to mark real work as fake to export it.
 *
 * 2. **The message named schema fields.** "Media needs src, url, thumbnail or
 *    demo" is the shape of the data, not the thing the person is missing. Each
 *    branch below says what to go and find instead.
 *
 * Exported because the Studio uses the same function to decide which fields to
 * show and what to say — one definition of "complete", not two that drift.
 */
export function mediaProblem(
  m: Pick<MediaItem, 'type' | 'src' | 'url' | 'instagramUrl' | 'thumbnail' | 'scene' | 'items'>,
): { field: string; message: string } | null {
  const has = (v?: string) => Boolean(v && v.trim());

  switch (m.type) {
    case 'image':
      return has(m.src) || has(m.url)
        ? null
        : { field: 'src', message: 'Add an image file from public/, or an image URL.' };

    case 'video':
      return has(m.src) || has(m.url)
        ? null
        : { field: 'src', message: 'Add a local video path or a direct video URL.' };

    case 'instagram':
      // A permalink ALONE is enough. A cover is recommended, never required.
      return has(m.instagramUrl) || has(m.url)
        ? null
        : { field: 'instagramUrl', message: 'Add the Instagram post or Reel URL.' };

    case 'youtube':
      return has(m.url) ? null : { field: 'url', message: 'Add the YouTube URL.' };

    case 'vimeo':
      return has(m.url) ? null : { field: 'url', message: 'Add the Vimeo URL.' };

    case 'drive':
      // The share link is the whole requirement. A cover is recommended,
      // never required — see DriveMedia for why autoplay is not guaranteed.
      return has(m.url) || has(m.src)
        ? null
        : { field: 'url', message: 'Add the Google Drive share link for the video.' };

    case 'website':
      // Screenshots are optional: with none, the item renders a quiet link
      // preview, which is a better answer than an empty frame.
      return has(m.url) ? null : { field: 'url', message: 'Add the website address.' };

    case 'embed':
      return has(m.url) ? null : { field: 'url', message: 'Add the URL to embed.' };

    case 'pdf':
      return has(m.src) || has(m.url)
        ? null
        : { field: 'src', message: 'Add the PDF path from public/, or a PDF URL.' };

    case 'generative':
      // Deprecated, but still reachable by existing content — keep it valid.
      return m.scene ? null : { field: 'scene', message: 'Choose which animated scene to draw.' };

    case 'gallery':
      // `src` counts: a gallery is an image that grew, and the original image
      // is a legitimate first picture even before `items` is written.
      return m.items?.length || has(m.src) || has(m.url)
        ? null
        : { field: 'items', message: 'Add at least one image to the gallery.' };

    default:
      return null;
  }
}

export const LinkSchema = z.object({
  label: nonEmpty,
  url: nonEmpty,
  kind: z
    .enum(['website', 'instagram', 'linkedin', 'youtube', 'vimeo', 'behance', 'email', 'file', 'other'])
    .default('other'),
});
export type PortfolioLink = z.infer<typeof LinkSchema>;

/* ------------------------------------------------------------- case study */

export const MetricSchema = z.object({
  label: nonEmpty,
  value: nonEmpty,
  note: z.string().optional(),
});
export type Metric = z.infer<typeof MetricSchema>;

export const CaseSectionSchema = z.object({
  label: nonEmpty,
  body: nonEmpty,
});

export const CaseStudySchema = z.object({
  context: z.string().optional(),
  challenge: z.string().optional(),
  objective: z.string().optional(),
  approach: z.string().optional(),
  execution: z.string().optional(),
  results: z.string().optional(),
  /** Headline numbers. Mark the project `demo` if these are illustrative. */
  metrics: z.array(MetricSchema).default([]),
  /** Anything the fixed fields above don't cover. */
  sections: z.array(CaseSectionSchema).default([]),
});
export type CaseStudy = z.infer<typeof CaseStudySchema>;

/* ----------------------------------------------------------------- project */

export const ProjectSchema = z.object({
  id: slug,
  title: nonEmpty,
  /** Short label for tight spots (dock, file names, breadcrumbs). */
  shortTitle: z.string().optional(),
  /** Folder id this project lives in. Must match a folder in `folders`. */
  folder: slug,
  company: z.string().optional(),
  year: z.string().optional(),
  role: z.string().optional(),
  location: z.string().optional(),
  /** One line. Shown in list rows and Quick View cards. */
  summary: nonEmpty,
  /** Optional longer intro paragraph for the case study header. */
  description: z.string().optional(),
  disciplines: z.array(DisciplineSchema).default([]),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  credits: z.array(z.object({ role: nonEmpty, name: nonEmpty })).default([]),
  caseStudy: CaseStudySchema.optional(),
  media: z.array(MediaItemSchema).default([]),
  /**
   * Which media item opens the case study, by id. **Explicit, or nothing.**
   *
   * Until session 9 the hero was inferred — first `featured` item, else the
   * first item in the array — which meant `featured` secretly did two jobs and
   * nobody could choose "no hero". Now: set it and that item leads the page;
   * leave it out and the case study begins immediately with the title. There is
   * no empty hero area either way.
   *
   * Three distinct concepts, never to be confused again:
   *   `tile`         — how the project looks in the WORK GRID
   *   `heroMediaId`  — what leads the CASE STUDY
   *   `media`        — the body of the case study
   *
   * A dangling id is a validation error rather than a silent blank — see the
   * root `superRefine`. The Studio clears the reference when you delete the
   * item it names, so it should never get there by accident.
   */
  heroMediaId: z.string().optional(),
  /**
   * Repeat the hero inside the media masonry as well. Off unless set, because
   * showing the same picture twice on one page reads as a mistake.
   */
  showHeroInMedia: z.boolean().optional(),
  links: z.array(LinkSchema).default([]),
  thumbnail: z.string().optional(),
  /** Icon used when this project sits on the desktop as a shortcut. */
  icon: IconSchema.optional(),
  /**
   * How this project sits in the Work grid. This is the art direction: vary
   * span and aspect across projects so the archive reads as composed rather
   * than as a uniform card wall. Omit it and the tile takes a sensible default.
   */
  tile: z
    .object({
      span: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
      aspect: AspectSchema.default('4:3'),
    })
    .optional(),
  /** Featured projects appear in Quick View → Selected Work. */
  featured: z.boolean().default(false),
  /** true = sample content written to demonstrate the system. */
  demo: z.boolean().default(false),
  /** Manual sort order inside a folder (lower first). */
  order: z.number().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

/* ------------------------------------------------------------------ folder */

export const FolderSchema = z.object({
  id: slug,
  name: nonEmpty,
  caption: z.string().optional(),
  discipline: DisciplineSchema.optional(),
  /** Company logo or monogram for this folder's icon. */
  icon: IconSchema.optional(),
  order: z.number().optional(),
});
export type Folder = z.infer<typeof FolderSchema>;

/* -------------------------------------------------------------- experience */

export const ExperienceSchema = z.object({
  id: slug,
  company: nonEmpty,
  role: nonEmpty,
  period: nonEmpty,
  location: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  disciplines: z.array(DisciplineSchema).default([]),
  /** Optional link to a project id for "see the work". */
  projectId: z.string().optional(),
  current: z.boolean().default(false),
});
export type Experience = z.infer<typeof ExperienceSchema>;

/* ------------------------------------------------------------------ skills */

export const SkillGroupSchema = z.object({
  id: slug,
  title: nonEmpty,
  discipline: DisciplineSchema,
  caption: z.string().optional(),
  items: z.array(nonEmpty).min(1),
});
export type SkillGroup = z.infer<typeof SkillGroupSchema>;

/* ------------------------------------------------------------------- notes */

/** Plain text files that live on the desktop (ideas.txt, dont_open.txt …). */
export const NoteSchema = z.object({
  id: slug,
  title: nonEmpty,
  body: nonEmpty,
  tone: z.enum(['plain', 'accent', 'easter-egg']).default('plain'),
});
export type Note = z.infer<typeof NoteSchema>;

/* ----------------------------------------------------------------- profile */

export const SocialSchema = z.object({
  label: nonEmpty,
  handle: z.string().optional(),
  url: nonEmpty,
  icon: z.string().optional(),
});

/**
 * The About window, written as content rather than as markup.
 *
 * Everything is optional so the window degrades to `profile.about` +
 * `profile.principles` if this block is missing. There are deliberately no
 * counters or statistics here — About is where a person speaks, not where the
 * site reports on itself.
 */
export const AboutPageSchema = z.object({
  /** One strong opening line, set larger than the rest. */
  lede: z.string().optional(),
  /** A short positioning statement under the name. */
  statement: z.string().optional(),
  /** How you work / what you do — one paragraph per entry. */
  paragraphs: z.array(nonEmpty).default([]),
  /** Portrait image under /public. Falls back to generated poster art. */
  portrait: z.string().optional(),
  /** Optional strip of images — workspace, set, whatever is true. */
  images: z
    .array(z.object({ src: nonEmpty, alt: z.string().optional(), caption: z.string().optional() }))
    .default([]),
  /** Short columns: "Currently", "Tools I live in", "Off the clock"… */
  lists: z.array(z.object({ title: nonEmpty, items: z.array(nonEmpty).min(1) })).default([]),
  /** A last quiet line at the bottom. Good place for a joke. */
  footnote: z.string().optional(),
});
export type AboutPage = z.infer<typeof AboutPageSchema>;

/** Copy for the Contact window. Kept here so it is editable in the Studio. */
export const ContactCopySchema = z.object({
  headline: z.string().optional(),
  note: z.string().optional(),
});
export type ContactCopy = z.infer<typeof ContactCopySchema>;

export const ProfileSchema = z.object({
  name: nonEmpty,
  osName: nonEmpty,
  positioning: nonEmpty,
  headline: nonEmpty,
  subheadline: z.string().optional(),
  location: z.string().optional(),
  availability: z.string().optional(),
  /** Short paragraphs for the About window. */
  about: z.array(nonEmpty).min(1),
  /** Three-to-five bullet "what I actually do" lines. */
  principles: z.array(nonEmpty).default([]),
  /** The richer About window. Falls back to `about` + `principles`. */
  aboutPage: AboutPageSchema.prefault({}),
  /** Contact window copy. */
  contact: ContactCopySchema.default({}),
  email: z.string().email(),
  phone: z.string().optional(),
  socials: z.array(SocialSchema).default([]),
  cv: z.object({
    file: z.string(),
    label: z.string().default('Download CV'),
    updated: z.string().optional(),
    preview: z.string().optional(),
    /** Text version rendered inside the CV window. */
    sections: z
      .array(z.object({ heading: nonEmpty, lines: z.array(nonEmpty).min(1) }))
      .default([]),
  }),
});
export type Profile = z.infer<typeof ProfileSchema>;

/* ----------------------------------------------------------------- desktop */

/** What a desktop icon points at when you open it. */
export const DesktopTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('folder'), value: slug }),
  z.object({ type: z.literal('project'), value: slug }),
  z.object({ type: z.literal('note'), value: slug }),
  z.object({ type: z.literal('app'), value: nonEmpty }),
  z.object({ type: z.literal('media'), value: nonEmpty, projectId: z.string().optional() }),
  /** Opens inside the OS browser window. */
  z.object({ type: z.literal('url'), value: nonEmpty }),
  /** Leaves the site — opens the URL in a new browser tab. */
  z.object({ type: z.literal('external'), value: nonEmpty }),
  /** Opens one of the `alerts` below as a system dialog. */
  z.object({ type: z.literal('alert'), value: slug }),
]);
export type DesktopTarget = z.infer<typeof DesktopTargetSchema>;

export const DesktopItemSchema = z.object({
  id: slug,
  label: nonEmpty,
  kind: z.enum(['folder', 'document', 'note', 'video', 'image', 'link', 'pdf', 'app', 'design']),
  target: DesktopTargetSchema,
  /**
   * Position as a % of the desktop area. BOTH ARE OPTIONAL: leave them out and
   * the desktop scatters the item for you (deterministically, seeded from its
   * id, so the layout is stable across reloads). Once a visitor drags an icon,
   * their position is remembered in their own browser and wins over both.
   */
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  /** Which band the auto-scatter drops it into. */
  zone: ZoneSchema.default('any'),
  /** Small rotation in degrees. Advanced; the scatter does not use it. */
  rotate: z.number().min(-12).max(12).default(0),
  /** Custom logo or monogram. Falls back to the glyph for `kind`. */
  icon: IconSchema.optional(),
  accent: DisciplineSchema.optional(),
  badge: z.string().optional(),
});
export type DesktopItem = z.infer<typeof DesktopItemSchema>;

/**
 * A small panel that lives on the desktop next to the icons. All self-contained:
 * no network, no API, nothing to break.
 *   `clock`    — time, day and date, with an optional place label.
 *   `note`     — a short personal card: what you're working on, a line you like.
 *   `reaction` — a reaction-time tester. Tap start, wait for the blue, tap it.
 *
 * `reaction` is the one deliberate exception to "no games" in PROJECT_STATUS §5,
 * requested explicitly. It is self-contained: no levels, no sound, no network,
 * no leaderboard. Keep it that way, and do not remove it.
 */
export const WidgetSchema = z.object({
  id: slug,
  type: z.enum(['clock', 'note', 'reaction']),
  title: z.string().optional(),
  /** `note` body text. Unused by the other types. */
  body: z.string().optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  zone: ZoneSchema.default('any'),
});
export type Widget = z.infer<typeof WidgetSchema>;

/**
 * An external shortcut pinned to the dock — mail, Instagram, LinkedIn.
 *
 * `url` is OPTIONAL on purpose. Left out, the dock resolves it from the profile:
 * `mail` becomes `mailto:profile.email`, and the rest match a `profile.socials`
 * entry. That keeps one source of truth for a social URL instead of asking
 * anyone to keep the same link correct in two places. Set `url` only to point a
 * dock shortcut somewhere the profile does not already know about.
 */
export const DockLinkSchema = z.object({
  id: slug,
  label: nonEmpty,
  url: z.string().optional(),
  icon: z.enum(['mail', 'instagram', 'linkedin', 'github', 'link']).default('link'),
});
export type DockLink = z.infer<typeof DockLinkSchema>;

/**
 * A fake "creative software" launcher. Clicking one opens a system alert with
 * a line of your own writing instead of a 4 GB application. Personality, not
 * a feature — keep them short and keep them few.
 */
export const AlertSchema = z.object({
  id: slug,
  /** The application it pretends to be — shown above the title. */
  app: nonEmpty,
  title: nonEmpty,
  body: nonEmpty,
  tone: z.enum(['info', 'caution', 'error']).default('info'),
  /** Up to two. The first is the default action; both just close the dialog. */
  buttons: z
    .array(z.object({ label: nonEmpty, primary: z.boolean().default(false) }))
    .max(2)
    .default([]),
});
export type SystemAlert = z.infer<typeof AlertSchema>;

/** Windows that are already open when the desktop loads. */
export const AutoOpenSchema = z.object({
  app: nonEmpty,
  payloadId: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  /** Higher = on top at boot. */
  order: z.number().default(0),
});
export type AutoOpen = z.infer<typeof AutoOpenSchema>;

export const DesktopSchema = z.object({
  items: z.array(DesktopItemSchema).default([]),
  widgets: z.array(WidgetSchema).default([]),
  dockLinks: z.array(DockLinkSchema).default([]),
  autoOpen: z.array(AutoOpenSchema).default([]),
});

/* ---------------------------------------------------------------- settings */

/**
 * Appearance. Light is the default because the work reads better on paper
 * white; dark stays one click away in the menu bar.
 *
 * Wallpapers are optional image paths under /public. When one is missing the
 * built-in CSS gradient for that theme is used, so the site never ships a
 * broken background. Both are cross-faded on a theme change, never hard-cut.
 */
export const ThemeSettingsSchema = z.object({
  default: z.enum(['light', 'dark']).default('light'),
  allowToggle: z.boolean().default(true),
  wallpaperLight: z.string().optional(),
  wallpaperDark: z.string().optional(),
});
export type ThemeSettings = z.infer<typeof ThemeSettingsSchema>;

/**
 * One typeface: what to call it, and optionally the file to load it from.
 *
 * `file` is a path under /public exactly like every other asset — "fonts/
 * MyFont.woff2", no leading slash, no "public/" prefix. WOFF2 is the right
 * answer for the web; WOFF, TTF and OTF are accepted because people have them.
 *
 * With no `file`, `family` is treated as a font already available on the
 * visitor's machine and appended to the front of the built-in stack. With
 * neither, the built-in stack is used unchanged. Nothing is fetched from Google
 * Fonts or any other third party, ever — see PROJECT_STATUS: no external
 * services, no requests the visitor did not ask for.
 */
export const FontSpecSchema = z.object({
  /** Display name, e.g. "Söhne". Also the CSS family name when `file` is set. */
  family: z.string().optional(),
  /** Font file under /public, e.g. "fonts/Sohne-Buch.woff2". */
  file: z.string().optional(),
});
export type FontSpec = z.infer<typeof FontSpecSchema>;

/**
 * One typography role — Display, Heading or Body.
 *
 * Every field is optional, and an absent field means "keep the built-in value",
 * which is why leaving typography alone cannot change how the site looks.
 *
 * The units are deliberately not CSS. Nobody editing a portfolio should have to
 * know that tracking is expressed in `em` and leading is unitless: the Studio
 * asks for numbers and this schema states what they mean.
 */
export const TypeRoleSchema = z.object({
  /**
   * This role's own typeface. Absent means "use the shared `typography.font`",
   * and if that is absent too, the native system stack. So a role's font is an
   * override, which is what lets one file cover everything until you decide a
   * particular role wants its own.
   */
  font: FontSpecSchema.optional(),
  /** Font size in pixels, at desktop. Small screens scale down from it. */
  size: z.number().min(8).max(200).optional(),
  /** 300–800. A variable font uses it directly; a static one may synthesise. */
  weight: z.number().min(100).max(900).optional(),
  /** Letter spacing in `em`. Negative tightens — custom fonts often need it. */
  tracking: z.number().min(-0.08).max(0.15).optional(),
  /** Line height as a multiplier of the font size, e.g. 1.5. */
  leading: z.number().min(0.8).max(2).optional(),
});
export type TypeRole = z.infer<typeof TypeRoleSchema>;

/**
 * The typography system: three roles, each of which can have its own typeface.
 *
 * `font` is the shared face — the one most sites want, set once and used by every
 * role. Each role may then override it with `display.font`, `heading.font` or
 * `body.font`, which is how you pair a display face with a different text face.
 * A role with no font of its own inherits `font`; with neither, the native system
 * stack. So the simple case stays one field, and the expressive case is three.
 *
 * What is still deliberately absent: ZIP upload, font-family folder scanning,
 * per-weight file slots (Regular/Medium/Semibold/Bold as separate uploads) and
 * automatic weight-file mapping. Those are a font manager. One file per role is a
 * typographic choice; four files per role is inventory. A variable font supplies
 * its own weights, and a static one is left to the browser.
 *
 * `scale` is a global percentage over all typography and nothing else. It exists
 * because two fonts at the same `font-size` can render visibly different sizes,
 * and correcting that one control at a time is miserable.
 *
 * `primary` / `secondary` are the previous two-font system. They are **kept and
 * still honoured** so existing content keeps working unchanged: `primary` is
 * used as the shared face when `font` is not set, and `secondary` still supplies
 * the editorial family. Nothing needs migrating.
 */
export const TypographySettingsSchema = z.object({
  /** The shared custom face. Any role may override it with its own. */
  font: FontSpecSchema.optional(),
  display: TypeRoleSchema.optional(),
  heading: TypeRoleSchema.optional(),
  body: TypeRoleSchema.optional(),
  /** Global typography scale as a percentage. 100 = the sizes as configured. */
  scale: z.number().min(50).max(200).optional(),
  /** Legacy interface font. Used as the shared face when `font` is unset. */
  primary: FontSpecSchema.optional(),
  /** Legacy editorial font. Still loaded and still drives --font-editorial. */
  secondary: FontSpecSchema.optional(),
});
export type TypographySettings = z.infer<typeof TypographySettingsSchema>;

export const SettingsSchema = z.object({
  boot: z.object({
    enabled: z.boolean().default(true),
    /** Milliseconds. Keep it short — nobody wants a fake loading screen. */
    duration: z.number().min(300).max(4000).default(1400),
    /** After the first visit, run a much shorter version. */
    shortenAfterFirstVisit: z.boolean().default(true),
  }),
  theme: ThemeSettingsSchema.prefault({}),
  /**
   * Optional, and optional all the way down: absent means the built-in system
   * stack, which is a perfectly good answer. Left `.optional()` rather than
   * given a default so that exporting an untouched portfolio.json does not
   * materialise an empty `typography: {}` into every file.
   */
  typography: TypographySettingsSchema.optional(),
  customCursor: z.boolean().default(true),
  /*
   * There is deliberately no `showStudio` here any more.
   *
   * The Studio is not an app in ASAAD.OS: it has no dock icon, no desktop
   * icon, no command-palette entry and no search result. The only way in is to
   * type `#/studio`, which always works. A visibility flag would have had
   * nothing left to toggle.
   *
   * Older portfolio.json files may still carry `settings.showStudio`. That is
   * harmless — Zod objects strip unknown keys — so they keep validating and the
   * field simply disappears on the next Studio export.
   */
  /**
   * Casual privacy gate for the Studio — 4 to 8 digits.
   *
   * NOT SECURITY. This is a static site: the PIN ships inside the JavaScript
   * bundle and anyone who opens devtools can read it. It exists to stop a
   * casual visitor wandering into the editor, nothing more. Never put anything
   * behind it that actually needs protecting.
   */
  studioPin: z
    .string()
    .regex(/^\d{4,8}$/, 'Use 4–8 digits, or leave it empty for no gate')
    .optional(),
  seo: z.object({
    title: nonEmpty,
    description: nonEmpty,
    url: z.string().optional(),
  }),
});
export type Settings = z.infer<typeof SettingsSchema>;

/* --------------------------------------------------------------- the root */

export const PortfolioSchema = z
  .object({
    /** Bump when the shape changes so the Studio can migrate old exports. */
    version: z.number().int().positive(),
    profile: ProfileSchema,
    settings: SettingsSchema,
    desktop: DesktopSchema,
    folders: z.array(FolderSchema).min(1),
    projects: z.array(ProjectSchema).default([]),
    experience: z.array(ExperienceSchema).default([]),
    skills: z.array(SkillGroupSchema).default([]),
    notes: z.array(NoteSchema).default([]),
    /** Dialogs opened by the playful "creative software" desktop icons. */
    alerts: z.array(AlertSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const folderIds = new Set(data.folders.map((f) => f.id));
    const projectIds = new Set<string>();
    const noteIds = new Set(data.notes.map((n) => n.id));
    const alertIds = new Set(data.alerts.map((a) => a.id));

    data.projects.forEach((p, i) => {
      if (!folderIds.has(p.folder)) {
        ctx.addIssue({
          code: 'custom',
          path: ['projects', i, 'folder'],
          message: `Unknown folder "${p.folder}". Known folders: ${[...folderIds].join(', ')}`,
        });
      }
      if (projectIds.has(p.id)) {
        ctx.addIssue({ code: 'custom', path: ['projects', i, 'id'], message: `Duplicate project id "${p.id}"` });
      }
      projectIds.add(p.id);

      // A hero pointing at media that no longer exists is said out loud rather
      // than rendered as a blank space at the top of the case study. The Studio
      // clears the reference on delete, so this should only ever fire for a
      // hand-edited file.
      if (p.heroMediaId && !p.media.some((m) => m.id === p.heroMediaId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['projects', i, 'heroMediaId'],
          message: `"${p.title}" has a hero image that no longer exists. Pick a different hero, or choose None.`,
        });
      }
    });

    data.desktop.items.forEach((item, i) => {
      const { target } = item;
      const bad =
        (target.type === 'folder' && !folderIds.has(target.value)) ||
        (target.type === 'project' && !projectIds.has(target.value)) ||
        (target.type === 'note' && !noteIds.has(target.value)) ||
        (target.type === 'alert' && !alertIds.has(target.value));
      if (bad) {
        ctx.addIssue({
          code: 'custom',
          path: ['desktop', 'items', i, 'target', 'value'],
          message: `Desktop item "${item.label}" points at a missing ${target.type}: "${target.value}"`,
        });
      }
    });
  });

export type Portfolio = z.infer<typeof PortfolioSchema>;

/** Shape returned by the loader — never throws, always tells you what broke. */
export type ValidationResult =
  | { ok: true; data: Portfolio }
  | { ok: false; issues: { path: string; message: string }[] };

export function validatePortfolio(input: unknown): ValidationResult {
  const parsed = PortfolioSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  };
}
