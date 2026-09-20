/**
 * Command palette index.
 *
 * Builds a flat list of everything openable — projects, folders, notes, media,
 * skills, companies and apps — then scores it against a query. Small enough
 * that a linear scan is instant; no search library needed.
 */
import type { Portfolio } from '@/types/content';
import type { AppId, WindowPayload } from '@/state/os';

export type SearchKind = 'app' | 'project' | 'folder' | 'note' | 'media' | 'skill' | 'company' | 'action';

export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  /** Extra words that should match but aren't shown. */
  keywords: string[];
  /** What happens on Enter. */
  action:
    | { type: 'window'; app: AppId; title: string; subtitle?: string; payload?: WindowPayload }
    | { type: 'view'; view: 'desktop' | 'quickview' }
    | { type: 'url'; url: string }
    | { type: 'command'; command: 'tidy' | 'closeAll' | 'reset' | 'cursor' };
}

const APP_ENTRIES: SearchEntry[] = [
  {
    id: 'app-projects',
    kind: 'app',
    title: 'Projects',
    subtitle: 'File explorer',
    keywords: ['finder', 'work', 'folders', 'explorer', 'files'],
    action: { type: 'window', app: 'projects', title: 'Projects' },
  },
  {
    id: 'app-about',
    kind: 'app',
    title: 'About',
    subtitle: 'Who this is',
    keywords: ['bio', 'profile', 'me', 'story'],
    action: { type: 'window', app: 'about', title: 'About' },
  },
  {
    id: 'app-cv',
    kind: 'app',
    title: 'CV',
    subtitle: 'Résumé & download',
    keywords: ['resume', 'cv', 'pdf', 'download', 'experience'],
    action: { type: 'window', app: 'cv', title: 'CV' },
  },
  {
    id: 'app-contact',
    kind: 'app',
    title: 'Contact',
    subtitle: 'Email & socials',
    keywords: ['email', 'hire', 'linkedin', 'instagram', 'reach', 'message'],
    action: { type: 'window', app: 'contact', title: 'Contact' },
  },
  {
    id: 'app-skills',
    kind: 'app',
    title: 'Capabilities',
    subtitle: 'What I do',
    keywords: ['skills', 'services', 'abilities', 'tools'],
    action: { type: 'window', app: 'skills', title: 'Capabilities' },
  },
  {
    id: 'app-experience',
    kind: 'app',
    title: 'Experience',
    subtitle: 'Where I have worked',
    keywords: ['roles', 'jobs', 'history', 'career'],
    action: { type: 'window', app: 'experience', title: 'Experience' },
  },
  {
    id: 'view-quick',
    kind: 'action',
    title: 'Quick View',
    subtitle: 'The whole portfolio, one page',
    keywords: ['recruiter', 'summary', 'overview', 'organised', 'simple'],
    action: { type: 'view', view: 'quickview' },
  },
  {
    id: 'view-desktop',
    kind: 'action',
    title: 'Explore OS',
    subtitle: 'Back to the desktop',
    keywords: ['desktop', 'home', 'os', 'explore'],
    action: { type: 'view', view: 'desktop' },
  },
  {
    id: 'cmd-tidy',
    kind: 'action',
    title: 'Tidy Windows',
    subtitle: 'Arrange everything into a grid',
    keywords: ['organise', 'organize', 'arrange', 'clean', 'grid'],
    action: { type: 'command', command: 'tidy' },
  },
  {
    id: 'cmd-close',
    kind: 'action',
    title: 'Close All Windows',
    subtitle: 'Clear the desktop',
    keywords: ['clear', 'quit', 'close'],
    action: { type: 'command', command: 'closeAll' },
  },
  {
    id: 'cmd-reset',
    kind: 'action',
    title: 'Reset Desktop',
    subtitle: 'Back to the original composition',
    keywords: ['restore', 'default', 'factory'],
    action: { type: 'command', command: 'reset' },
  },
  {
    id: 'cmd-cursor',
    kind: 'action',
    title: 'Toggle Custom Cursor',
    subtitle: 'Switch between OS and system cursor',
    keywords: ['pointer', 'mouse', 'cursor'],
    action: { type: 'command', command: 'cursor' },
  },
];

export function buildIndex(p: Portfolio): SearchEntry[] {
  const entries: SearchEntry[] = [...APP_ENTRIES];

  // The Studio is deliberately absent from search. It is not a visitor-facing
  // app; the only way in is typing #/studio. See App.tsx.

  p.folders.forEach((folder) => {
    entries.push({
      id: `folder-${folder.id}`,
      kind: 'folder',
      title: folder.name,
      subtitle: folder.caption ?? 'Folder',
      keywords: [folder.id, 'folder'],
      action: {
        type: 'window',
        app: 'projects',
        title: 'Projects',
        payload: { folderId: folder.id },
      },
    });
  });

  p.projects.forEach((project) => {
    entries.push({
      id: `project-${project.id}`,
      kind: 'project',
      title: project.title,
      subtitle: [project.company, project.year].filter(Boolean).join(' · ') || 'Project',
      keywords: [
        project.id,
        project.shortTitle ?? '',
        project.company ?? '',
        project.role ?? '',
        ...project.tags,
        ...project.categories,
        ...project.tools,
        ...project.disciplines,
      ].filter(Boolean),
      action: {
        type: 'window',
        app: 'project',
        title: project.shortTitle ?? project.title,
        subtitle: project.company,
        payload: { projectId: project.id },
      },
    });

    project.media.forEach((media) => {
      if (!media.caption) return;
      entries.push({
        id: `media-${project.id}-${media.id}`,
        kind: 'media',
        title: media.caption,
        subtitle: `${project.shortTitle ?? project.title} · ${media.type}`,
        keywords: [media.type, media.id, project.title],
        action: {
          type: 'window',
          app: 'media',
          title: media.caption,
          subtitle: project.shortTitle ?? project.title,
          payload: { projectId: project.id, mediaId: media.id },
        },
      });
    });
  });

  p.notes.forEach((note) => {
    entries.push({
      id: `note-${note.id}`,
      kind: 'note',
      title: note.title,
      subtitle: 'Text file',
      keywords: ['note', 'txt', note.id],
      action: { type: 'window', app: 'note', title: note.title, payload: { noteId: note.id } },
    });
  });

  p.experience.forEach((job) => {
    entries.push({
      id: `company-${job.id}`,
      kind: 'company',
      title: job.company,
      subtitle: `${job.role} · ${job.period}`,
      keywords: ['experience', 'role', 'job', job.role],
      action: { type: 'window', app: 'experience', title: 'Experience' },
    });
  });

  p.skills.forEach((group) => {
    group.items.forEach((item, i) => {
      entries.push({
        id: `skill-${group.id}-${i}`,
        kind: 'skill',
        title: item,
        subtitle: `${group.title} capability`,
        keywords: ['skill', group.title, group.discipline],
        action: { type: 'window', app: 'skills', title: 'Capabilities' },
      });
    });
  });

  return entries;
}

/** Higher is better; 0 means no match. */
function score(entry: SearchEntry, query: string): number {
  const q = query.toLowerCase();
  const title = entry.title.toLowerCase();
  if (title === q) return 1000;
  if (title.startsWith(q)) return 800 - title.length;
  if (title.includes(q)) return 600 - title.indexOf(q);

  const subtitle = entry.subtitle?.toLowerCase() ?? '';
  if (subtitle.includes(q)) return 400;

  const keyword = entry.keywords.find((k) => k.toLowerCase().includes(q));
  if (keyword) return 300 - keyword.length;

  // Loose initials match: "ts" → "Times Square"
  const initials = title
    .split(/[\s&/-]+/)
    .map((word) => word[0] ?? '')
    .join('');
  if (initials.startsWith(q)) return 250;

  return 0;
}

const KIND_WEIGHT: Record<SearchKind, number> = {
  action: 6,
  app: 5,
  project: 4,
  folder: 3,
  company: 2,
  note: 1,
  media: 0,
  skill: 0,
};

export function searchEntries(index: SearchEntry[], query: string, limit = 9): SearchEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return index
      .filter((e) => e.kind === 'action' || e.kind === 'app' || e.kind === 'folder')
      .slice(0, limit);
  }
  return index
    .map((entry) => ({ entry, s: score(entry, trimmed) + KIND_WEIGHT[entry.kind] }))
    .filter((r) => r.s > KIND_WEIGHT[r.entry.kind])
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.entry);
}
