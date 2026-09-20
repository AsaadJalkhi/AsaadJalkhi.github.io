/**
 * Content loading + derived lookups.
 *
 * `portfolio.json` is imported at build time (so it ships in the bundle and
 * needs no network request), validated once, and then exposed through a set of
 * memoised selectors. If validation fails the app renders an error screen
 * instead of crashing — see `ContentError`.
 *
 * To swap the JSON file for a real CMS later, replace `loadPortfolio()` with an
 * async fetch. Nothing else in the app touches the raw data.
 */
import raw from '@/content/portfolio.json';
import {
  validatePortfolio,
  type Discipline,
  type DockLink,
  type Folder,
  type MediaItem,
  type Note,
  type Portfolio,
  type Profile,
  type Project,
  type ValidationResult,
} from '@/types/content';

let cached: ValidationResult | null = null;

export function loadPortfolio(): ValidationResult {
  if (!cached) cached = validatePortfolio(raw);
  return cached;
}

/** Raw, unvalidated content — only the Studio needs this (as an edit baseline). */
export function rawPortfolio(): unknown {
  return raw;
}

/* ------------------------------------------------------------- selectors */

export function foldersSorted(p: Portfolio): Folder[] {
  return [...p.folders].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function projectsInFolder(p: Portfolio, folderId: string): Project[] {
  return p.projects
    .filter((project) => project.folder === folderId)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function featuredProjects(p: Portfolio): Project[] {
  return p.projects.filter((project) => project.featured);
}

export function findProject(p: Portfolio, id?: string): Project | undefined {
  return id ? p.projects.find((project) => project.id === id) : undefined;
}

export function findFolder(p: Portfolio, id?: string): Folder | undefined {
  return id ? p.folders.find((folder) => folder.id === id) : undefined;
}

export function findNote(p: Portfolio, id?: string): Note | undefined {
  return id ? p.notes.find((note) => note.id === id) : undefined;
}

export function findMedia(
  p: Portfolio,
  projectId?: string,
  mediaId?: string,
): { project: Project; media: MediaItem } | undefined {
  if (!projectId || !mediaId) return undefined;
  const project = findProject(p, projectId);
  const media = project?.media.find((m) => m.id === mediaId);
  return project && media ? { project, media } : undefined;
}

/** The image used for a project card: explicit thumbnail, else first media. */
export function projectThumb(project: Project): string | undefined {
  if (project.thumbnail) return project.thumbnail;
  const first = project.media.find((m) => m.src || m.thumbnail);
  return first?.thumbnail ?? first?.src;
}

/** Primary discipline — drives accent colour across the UI. */
export function primaryDiscipline(project: Project): Discipline {
  return project.disciplines[0] ?? 'creative';
}

export function countByDiscipline(p: Portfolio): Record<Discipline, number> {
  const counts: Record<Discipline, number> = { marketing: 0, creative: 0, digital: 0 };
  p.projects.forEach((project) => {
    project.disciplines.forEach((d) => {
      counts[d] += 1;
    });
  });
  return counts;
}

/** Every distinct year, newest first — used by Quick View filters. */
export function yearsOf(p: Portfolio): string[] {
  return [...new Set(p.projects.map((project) => project.year).filter(Boolean) as string[])].sort(
    (a, b) => b.localeCompare(a),
  );
}

/**
 * Where a dock shortcut actually points.
 *
 * A dock link may carry its own `url`, but normally it does not: leaving it out
 * means "use the profile", which is the single source of truth for a social
 * link. `mail` resolves to `mailto:profile.email`; everything else matches a
 * `profile.socials` entry by its icon, falling back to its label. Returns
 * undefined when nothing matches, and the dock then skips the shortcut rather
 * than rendering a button that goes nowhere.
 */
export function dockLinkUrl(link: DockLink, profile: Profile): string | undefined {
  if (link.url?.trim()) return link.url.trim();
  if (link.icon === 'mail') return `mailto:${profile.email}`;

  const wanted = link.icon.toLowerCase();
  const label = link.label.toLowerCase();
  const match = profile.socials.find(
    (social) =>
      social.icon?.toLowerCase() === wanted || social.label.toLowerCase() === (wanted || label),
  );
  return match?.url;
}
