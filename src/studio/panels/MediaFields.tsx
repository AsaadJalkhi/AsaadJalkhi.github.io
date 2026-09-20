/**
 * The media editor — type first, then only the fields that type actually uses.
 *
 * This replaced a flat wall of every source field at once (Local file, External
 * URL, Thumbnail, Poster, Instagram permalink, Scene…) shown for every media
 * type. That form asked an Instagram Reel for a "Poster" and a local MP4 for an
 * "External URL", and left people guessing which combination would satisfy the
 * validator — which is how "just tick Demo" became folklore.
 *
 * Two rules hold this together:
 *
 * 1. **Choose the type, then fill in what it needs.** Each branch below renders
 *    the two or three fields that matter for that kind of media and nothing
 *    else. Fields that exist in the schema but are rarely wanted live behind
 *    `Advanced`, so nothing is unreachable.
 *
 * 2. **The validator and the form agree, because they share `mediaProblem()`.**
 *    The requirement message under a field comes from the same function the Zod
 *    schema calls, so the Studio can never ask for something the exporter does
 *    not want, or accept something it will later reject.
 *
 * Session 9 changed three things here:
 *
 *   **Gallery is no longer a type you pick.** It was, and picking it gave you a
 *   dead end: a note saying "add one row per image in the list below" pointing
 *   at a list that did not exist, and a validator demanding at least one image
 *   you had no way to add. Now you add an Image, and "Add another image" turns
 *   it into a gallery with the picture you already chose as the first one.
 *
 *   **There is exactly one Aspect ratio "Auto".** There used to be two entries
 *   both reading "auto" — an empty option from the select's placeholder and a
 *   real `'auto'` value — which meant the same thing and looked like a bug
 *   because it was one.
 *
 *   **Caption is a textarea.** A caption is editorial copy, sometimes several
 *   paragraphs. A single-line input silently said otherwise.
 *
 * `demo` is a LABELLING flag here, not a way to pass validation — see the long
 * note on `mediaProblem` in `src/types/content.ts`.
 */
import { AlertCircle, CheckCircle2, ImagePlus } from 'lucide-react';
import { Btn, Toggle } from '@/components/ui/Ui';
import { mediaProblem, type MediaItem, type MediaSubItem } from '@/types/content';
import { Advanced, Area, Choice, Grid, Repeater, Text, LOCAL_PATH_HINT, opts } from './parts';

const SCENES = ['marquee', 'campaign', 'signal', 'grid'] as const;

/**
 * The shape dropdown. **One** Auto, and it is the empty value.
 *
 * Auto is stored as an absent `aspect`, never as the string `'auto'` — see
 * AspectSchema. The empty option below is therefore the whole of "automatic",
 * and `ASPECTS` deliberately does not contain `'auto'` as well.
 */
const ASPECT_OPTIONS = [
  { value: '', label: "Auto — the media's own shape" },
  { value: '16:9', label: '16:9 — widescreen' },
  { value: '4:5', label: '4:5 — portrait post' },
  { value: '1:1', label: '1:1 — square' },
  { value: '9:16', label: '9:16 — Reel / Story' },
  { value: '3:2', label: '3:2 — photo' },
  { value: '4:3', label: '4:3 — classic' },
];

const ASPECT_HINT =
  'Leave on Auto and the real shape of the file is used. Set one to force a shape instead.';

/**
 * Every media kind, labelled the way a person would describe it.
 *
 * `gallery` is absent on purpose — it is reached from Image, not chosen — and
 * so is `generative`, which is deprecated. Neither can be created here; both
 * still render and stay editable if existing content contains one.
 */
export const MEDIA_TYPE_OPTIONS = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video — local file or direct URL' },
  { value: 'instagram', label: 'Instagram — post or Reel' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'vimeo', label: 'Vimeo' },
  { value: 'drive', label: 'Google Drive video' },
  { value: 'website', label: 'Website' },
  { value: 'pdf', label: 'PDF / document' },
  { value: 'embed', label: 'Other embed' },
];

/** Shown under the cover field everywhere it appears. */
const COVER_HINT =
  'Shown before playback and used as a fallback if the media cannot autoplay. A local path from public/, or a full https:// URL.';

type Patch = (part: Partial<MediaItem>) => void;

/** Requirement status for this item, in the person's language. */
function Requirement({ item }: { item: MediaItem }) {
  const problem = mediaProblem(item);
  if (!problem) {
    return (
      <p className="studio-req studio-req--ok">
        <CheckCircle2 strokeWidth={1.6} />
        Ready to export.
      </p>
    );
  }
  return (
    <p className="studio-req">
      <AlertCircle strokeWidth={1.6} />
      {problem.message}
    </p>
  );
}

/**
 * One row of a gallery or a screenshot set.
 *
 * Each picture gets its own source, its own alt text, its own caption and its
 * own shape — because they are different pictures. The surrounding `Repeater`
 * supplies reorder, duplicate and remove.
 */
function SubItemFields({
  item,
  patch,
  kind,
}: {
  item: MediaSubItem;
  patch: (part: Partial<MediaSubItem>) => void;
  kind: 'image' | 'screenshot';
}) {
  return (
    <>
      <Grid>
        <Text
          label={kind === 'screenshot' ? 'Screenshot file or URL' : 'Image file or URL'}
          value={item.src ?? item.url}
          mono
          wide
          placeholder={kind === 'screenshot' ? 'media/site/home.jpg' : 'media/gaf/still-01.jpg'}
          hint={LOCAL_PATH_HINT}
          onChange={(v) => patch({ src: v || undefined, url: undefined })}
        />
      </Grid>
      <Grid>
        <Text
          label="Alt text"
          value={item.alt}
          hint="Described for screen readers"
          onChange={(v) => patch({ alt: v || undefined })}
        />
        <Choice
          label="Aspect ratio"
          value={item.aspect === 'auto' ? '' : (item.aspect ?? '')}
          options={ASPECT_OPTIONS}
          hint={ASPECT_HINT}
          onChange={(v) => patch({ aspect: (v || undefined) as MediaSubItem['aspect'] })}
        />
      </Grid>
      <Area
        label="Caption"
        value={item.caption}
        rows={2}
        hint="Optional, for this picture on its own."
        onChange={(v) => patch({ caption: v || undefined })}
      />
    </>
  );
}

/** The source fields for one media type. Nothing else is rendered. */
function SourceFields({ item, patch }: { item: MediaItem; patch: Patch }) {
  switch (item.type) {
    case 'instagram':
      return (
        <Grid>
          <Text
            label="Instagram URL"
            value={item.instagramUrl ?? item.url}
            mono
            wide
            placeholder="https://www.instagram.com/reel/..."
            hint="The post or Reel permalink. This on its own is enough — you never need to mark real work as Demo."
            onChange={(v) => patch({ instagramUrl: v || undefined })}
          />
          <Text
            label="Cover / Thumbnail"
            value={item.thumbnail}
            mono
            placeholder="media/gaf/reel-cover.jpg"
            hint={`Optional, but strongly recommended for Instagram — its embed is the least reliable on the web, and on Auto its shape is taken from this image. ${COVER_HINT}`}
            onChange={(v) => patch({ thumbnail: v || undefined })}
          />
        </Grid>
      );

    case 'video':
      return (
        <Grid>
          <Text
            label="Local file or direct video URL"
            value={item.src ?? item.url}
            mono
            wide
            placeholder="media/gaf/reel.mp4"
            hint={`${LOCAL_PATH_HINT} A full https:// link to an .mp4 or .webm works too.`}
            onChange={(v) => patch({ src: v || undefined })}
          />
          <Text
            label="Poster / Cover"
            value={item.poster ?? item.thumbnail}
            mono
            placeholder="media/gaf/reel-cover.jpg"
            hint={`Optional — without one, the video's own first frame is used. ${COVER_HINT}`}
            onChange={(v) => patch({ poster: v || undefined })}
          />
        </Grid>
      );

    case 'youtube':
    case 'vimeo': {
      const label = item.type === 'youtube' ? 'YouTube' : 'Vimeo';
      return (
        <Grid>
          <Text
            label={`${label} URL`}
            value={item.url}
            mono
            wide
            placeholder={
              item.type === 'youtube'
                ? 'https://www.youtube.com/watch?v=...'
                : 'https://vimeo.com/...'
            }
            hint={`Paste the normal watch or share link — ASAAD.OS builds the embed itself.`}
            onChange={(v) => patch({ url: v || undefined })}
          />
          <Text
            label="Cover / Thumbnail"
            value={item.thumbnail}
            mono
            hint={`Optional. On Auto, a vertical video needs this (or an explicit 9:16) — the player will not tell us its shape. ${COVER_HINT}`}
            onChange={(v) => patch({ thumbnail: v || undefined })}
          />
        </Grid>
      );
    }

    case 'drive':
      return (
        <Grid>
          <Text
            label="Google Drive share link"
            value={item.url}
            mono
            wide
            placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
            hint="The Drive file must be shared so anyone with the link can view it. Paste the normal share link — ASAAD.OS builds the player itself."
            onChange={(v) => patch({ url: v || undefined })}
          />
          <Text
            label="Cover / Thumbnail"
            value={item.thumbnail}
            mono
            hint={`Recommended. Google's player often opens paused — we cannot press play inside it — so this is what people see first. ${COVER_HINT}`}
            onChange={(v) => patch({ thumbnail: v || undefined })}
          />
        </Grid>
      );

    case 'image':
      return (
        <Text
          label="Image file or URL"
          value={item.src ?? item.url}
          mono
          wide
          placeholder="media/gaf/hero.jpg"
          hint={`${LOCAL_PATH_HINT} A full https:// image URL works too.`}
          onChange={(v) => patch({ src: v || undefined })}
        />
      );

    case 'pdf':
      return (
        <Text
          label="PDF file or URL"
          value={item.src ?? item.url}
          mono
          wide
          placeholder="media/gaf/deck.pdf"
          hint={LOCAL_PATH_HINT}
          onChange={(v) => patch({ src: v || undefined })}
        />
      );

    case 'website':
      return (
        <>
          <Text
            label="Website address"
            value={item.url}
            mono
            wide
            placeholder="https://example.com"
            hint="Shown as an explicit 'Visit Website' link. The site itself is never embedded — see the screenshots below."
            onChange={(v) => patch({ url: v || undefined })}
          />
          <Repeater
            label="Screenshots"
            addLabel="Add a screenshot"
            items={item.screenshots ?? []}
            onChange={(next) => patch({ screenshots: next.length ? next : undefined })}
            create={(): MediaSubItem => ({})}
            labelOf={(shot, i) => shot.caption ?? shot.alt ?? shot.src ?? `Screenshot ${i + 1}`}
            empty="No screenshots yet — this will show as a small link preview. Add one or more and they become the picture of the site."
          >
            {(shot, patchShot) => (
              <SubItemFields item={shot} patch={patchShot} kind="screenshot" />
            )}
          </Repeater>
        </>
      );

    case 'embed':
      return (
        <Text
          label="Embed URL"
          value={item.url}
          mono
          wide
          placeholder="https://..."
          hint="Any address that is allowed to be shown in an iframe."
          onChange={(v) => patch({ url: v || undefined })}
        />
      );

    case 'generative':
      // Deprecated: no longer creatable, but an existing item stays editable
      // rather than becoming a row you can see and cannot change.
      return (
        <Choice
          label="Scene"
          value={item.scene}
          options={opts(SCENES)}
          placeholder="marquee"
          hint="A built-in animated scene. This type is no longer offered for new media — replace it with a real image or video when you have one."
          onChange={(v) => patch({ scene: (v || undefined) as MediaItem['scene'] })}
        />
      );

    case 'gallery':
      return null;

    default:
      return null;
  }
}

/**
 * Image ⇄ Gallery, as one continuous thing.
 *
 * An image with one picture is an Image. Add a second and it is a Gallery. Take
 * it back down to one and it is an Image again. Nobody has to know that those
 * are two different `type` values in the JSON, and — the part that was actually
 * broken — **the picture you already chose is carried into the gallery as the
 * first image** rather than being dropped on the floor by the type change.
 */
function ImageOrGallery({ item, patch }: { item: MediaItem; patch: Patch }) {
  const isGallery = item.type === 'gallery';
  const items: MediaSubItem[] = isGallery
    ? (item.items ?? [])
    : item.src || item.url
      ? [{ src: item.src, url: item.url, alt: item.alt, aspect: item.aspect }]
      : [];

  const becomeGallery = () => {
    patch({
      type: 'gallery',
      // The existing picture becomes image one. A blank second row is added so
      // "add another image" actually produces somewhere to put another image.
      items: [...items, {}],
      // The source fields now live per-row; clearing them keeps one picture in
      // one place instead of two that can disagree.
      src: undefined,
      url: undefined,
    });
  };

  const setItems = (next: MediaSubItem[]) => {
    if (next.length <= 1) {
      // Back to a single image — fold the survivor up onto the item itself so
      // the JSON says what it means.
      const only = next[0];
      patch({
        type: 'image',
        items: undefined,
        src: only?.src,
        url: only?.url,
        alt: only?.alt ?? item.alt,
        aspect: only?.aspect ?? item.aspect,
      });
      return;
    }
    patch({ items: next });
  };

  if (!isGallery) {
    return (
      <>
        <SourceFields item={item} patch={patch} />
        <div className="studio-inline-action">
          <Btn size="sm" variant="ghost" icon={<ImagePlus />} onClick={becomeGallery}>
            Add another image
          </Btn>
          <span className="studio-hint">
            Turns this into a gallery. The image above stays as the first one.
          </span>
        </div>
      </>
    );
  }

  return (
    <Repeater
      label="Images"
      addLabel="Add another image"
      items={items}
      onChange={setItems}
      create={(): MediaSubItem => ({})}
      labelOf={(sub, i) => sub.caption ?? sub.alt ?? sub.src ?? `Image ${i + 1}`}
      empty="Add the first image."
    >
      {(sub, patchSub) => <SubItemFields item={sub} patch={patchSub} kind="image" />}
    </Repeater>
  );
}

export function MediaFields({ item, patch }: { item: MediaItem; patch: Patch }) {
  const isStill = item.type === 'image' || item.type === 'gallery';

  /*
   * A gallery's type is not in the list — it is a state an Image is in, not a
   * thing you pick. Same for a deprecated generative item. Both still need to
   * show their own current value rather than an empty select, so the option is
   * added only for the item already using it.
   */
  const typeOptions = [...MEDIA_TYPE_OPTIONS];
  if (item.type === 'gallery') {
    typeOptions.splice(1, 0, { value: 'gallery', label: 'Gallery — several images' });
  }
  if (item.type === 'generative') {
    typeOptions.push({ value: 'generative', label: 'Generative — built-in scene (retired)' });
  }

  return (
    <>
      <Grid>
        <Choice
          label="Media type"
          value={item.type}
          options={typeOptions}
          hint="Pick this first — the fields below follow it."
          onChange={(v) => patch({ type: v as MediaItem['type'] })}
        />
        <Choice
          label="Aspect ratio"
          // Legacy content may carry the string 'auto'; it means the same as
          // empty, and picking Auto here rewrites it to the single stored form.
          value={item.aspect === 'auto' ? '' : (item.aspect ?? '')}
          options={ASPECT_OPTIONS}
          hint={`${ASPECT_HINT} Shapes the frame in the case study and sizes it in Focus Mode.`}
          onChange={(v) => patch({ aspect: (v || undefined) as MediaItem['aspect'] })}
        />
      </Grid>

      {isStill ? (
        <ImageOrGallery item={item} patch={patch} />
      ) : (
        <SourceFields item={item} patch={patch} />
      )}
      <Requirement item={item} />

      {/*
       * The item's own title, above the caption because that is the order it is
       * read in. Optional on purpose: leave it empty and the viewer shows no
       * title rather than borrowing the project's.
       */}
      <Text
        label="Media title"
        value={item.title}
        placeholder="French Toast — Behind the Scenes"
        hint="Optional. The name of this one piece of media. Leave it empty and no title is shown — the project title is never used in its place."
        onChange={(v) => patch({ title: v || undefined })}
      />

      <Area
        label="Caption"
        value={item.caption}
        rows={3}
        hint="Editorial copy, not a label — write as much as the work needs. Line breaks and paragraphs are kept."
        onChange={(v) => patch({ caption: v || undefined })}
      />
      <Grid>
        <Text
          label="Alt text"
          value={item.alt}
          hint="Described for screen readers. Different from the caption: this is what the picture IS."
          onChange={(v) => patch({ alt: v })}
        />
        <Text
          label="Credit"
          value={item.credit}
          hint="Photographer, studio, collaborator."
          onChange={(v) => patch({ credit: v || undefined })}
        />
      </Grid>

      <div className="studio-toggles">
        <Toggle
          label="Full-width row"
          hint="Give this item its own row across both columns instead of sitting in the masonry"
          checked={item.featured ?? false}
          onChange={(v) => patch({ featured: v })}
        />
        <Toggle
          label="Sample placeholder content"
          hint="Only for fictional demo material — it adds a visible 'Sample' label. It is not needed to pass validation."
          checked={item.demo ?? false}
          onChange={(v) => patch({ demo: v })}
        />
      </div>

      <Advanced hint="Rarely needed. These stay available so nothing in the schema is unreachable from the Studio.">
        <Grid>
          <Text
            label="Secondary URL"
            value={item.url}
            mono
            hint="Used by a few types as an alternate source. Normally leave this alone."
            onChange={(v) => patch({ url: v || undefined })}
          />
          <Text
            label="Local file (src)"
            value={item.src}
            mono
            hint="The raw src field, if you need to set it directly."
            onChange={(v) => patch({ src: v || undefined })}
          />
          <Text
            label="Thumbnail"
            value={item.thumbnail}
            mono
            onChange={(v) => patch({ thumbnail: v || undefined })}
          />
        </Grid>
      </Advanced>
    </>
  );
}
