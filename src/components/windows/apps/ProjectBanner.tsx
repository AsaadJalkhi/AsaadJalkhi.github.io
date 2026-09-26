/**
 * The strip across the top of a case study.
 *
 * Not a media adapter, and deliberately not routed through `MediaRenderer`. The
 * adapters exist to show a piece of work *in full*, at its own aspect ratio,
 * with a caption and a way into Focus Mode. A banner is the opposite object: it
 * is page furniture, it is cropped on purpose, and its height is a property of
 * the page rather than of the file. Sending it through the adapter contract
 * would mean fighting every part of that contract.
 *
 * So: one local image or one local video, `object-fit: cover`, a height the
 * stylesheet owns. Nothing here reads the source's aspect ratio — that is what
 * makes every project's banner the same height at the same window size, and
 * what makes "any source shape is fine" true rather than aspirational.
 *
 * Video banners are decorative motion, not a player: autoplay, muted, looping,
 * inline, and no controls. There is nothing to play, pause or scrub, because it
 * is not something you watch — it is something the page moves behind the title.
 * Work that is *meant* to be watched belongs in the media below, where it gets
 * controls, a caption and Focus Mode.
 */
import { asset } from '@/lib/paths';
import { usePrefersReducedMotion } from '@/hooks/useEnvironment';
import type { Banner, Project } from '@/types/content';

/**
 * The banner to draw for a project, new field first.
 *
 * The legacy branch is why existing portfolios did not go blank when the hero
 * was replaced: a project with `heroMediaId` and no `banner` still gets a band,
 * drawn from that item. It is read-only compatibility — nothing writes the old
 * fields back, and the Studio offers an explicit one-click conversion rather
 * than rewriting content while someone is looking away.
 */
export function resolveBanner(project: Project): Banner | undefined {
  if (project.banner) return project.banner;

  const legacy = project.heroMediaId
    ? project.media.find((item) => item.id === project.heroMediaId)
    : undefined;
  if (!legacy || (legacy.type !== 'image' && legacy.type !== 'video')) return undefined;

  const src = legacy.src ?? legacy.url;
  if (!src) return undefined;
  return { type: legacy.type, src, alt: legacy.alt ?? legacy.caption };
}

/**
 * Media the case-study body should show.
 *
 * A `banner` never touches this list — it is not one of these items, so there
 * is nothing to exclude and no "show it again below" option to offer. The old
 * hero *was* one of these items, so its old exclusion rule is preserved for as
 * long as a project still uses it.
 */
export function bodyMedia(project: Project) {
  if (project.banner) return project.media;
  if (!project.heroMediaId || project.showHeroInMedia) return project.media;
  return project.media.filter((item) => item.id !== project.heroMediaId);
}

export function ProjectBanner({ banner }: { banner: Banner }) {
  const reduced = usePrefersReducedMotion();
  const src = asset(banner.src);
  if (!src) return null;

  return (
    <div className="case__banner">
      {banner.type === 'video' ? (
        <video
          className="case__banner-media"
          /*
           * The media fragment is what makes a still frame appear when autoplay
           * is declined — by the browser, or by us for a visitor who asked for
           * less motion. Without it some browsers paint black until play starts.
           */
          src={src.includes('#') ? src : `${src}#t=0.001`}
          autoPlay={!reduced}
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          {...(banner.alt ? { 'aria-label': banner.alt, role: 'img' } : { 'aria-hidden': true })}
        />
      ) : (
        <img
          className="case__banner-media"
          src={src}
          alt={banner.alt ?? ''}
          decoding="async"
          draggable={false}
        />
      )}
    </div>
  );
}
