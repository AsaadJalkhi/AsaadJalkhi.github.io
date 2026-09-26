/**
 * One place that knows how to turn "a thing in the content file" into "an open
 * window". Used by the desktop, the dock, the explorer, the palette, Quick View
 * and the mobile shell, so behaviour stays identical everywhere.
 *
 * *How* a thing opens is the shell's business, not this hook's: a desktop window
 * on the desktop, a sheet on mobile. That is `OpenSurfaceContext` — see the note
 * there for the bug that comes back the moment a call site decides for itself.
 */
import { useMemo } from 'react';
import { useOs, type AppId, type OpenSpec, type WindowPayload } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { findFolder, findNote, findProject, primaryDiscipline } from '@/lib/contentStore';
import { APPS } from '@/components/windows/registry';
import { useOpenSurface } from './openSurface';
import type { DesktopTarget } from '@/types/content';

export function useOpenTarget() {
  const openWindow = useOs((state) => state.openWindow);
  const surface = useOpenSurface();
  const portfolio = usePortfolio();

  return useMemo(() => {
    /*
     * The single exit. Everything below describes WHAT is being opened and
     * leaves WHERE to the shell — a sheet on mobile, a window on the desktop.
     * Nothing in this hook may call `openWindow` directly; doing so is what
     * created a desktop window from a mobile tap and made the tap look dead.
     */
    const present = (spec: OpenSpec) => {
      if (surface) surface(spec);
      else openWindow(spec);
    };

    /**
     * Viewing work is the point of the site, so a project claims almost the
     * whole workspace rather than opening as another mid-sized window.
     */
    const stageBox = () => {
      if (typeof window === 'undefined') return undefined;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(1180, Math.round(vw * 0.9));
      const height = Math.max(360, Math.round(vh - 132));
      return { x: Math.round((vw - width) / 2), y: 44, width, height };
    };

    const openProject = (projectId: string) => {
      const project = findProject(portfolio, projectId);
      if (!project) return;
      present({
        app: 'project',
        title: project.shortTitle ?? project.title,
        subtitle: [project.company, project.year].filter(Boolean).join(' · '),
        payload: { projectId },
        accent: primaryDiscipline(project),
        box: stageBox(),
      });
    };

    const openFolder = (folderId: string) => {
      const folder = findFolder(portfolio, folderId);
      present({
        app: 'projects',
        title: folder ? folder.name : 'Projects',
        subtitle: folder?.caption,
        payload: { folderId },
        accent: folder?.discipline,
      });
    };

    const openNote = (noteId: string) => {
      const note = findNote(portfolio, noteId);
      if (!note) return;
      present({ app: 'note', title: note.title, payload: { noteId } });
    };

    const openMedia = (projectId: string, mediaId: string) => {
      const project = findProject(portfolio, projectId);
      const media = project?.media.find((item) => item.id === mediaId);
      if (!project || !media) return;
      present({
        app: 'media',
        title: media.caption ?? media.id,
        subtitle: project.shortTitle ?? project.title,
        payload: { projectId, mediaId },
        accent: primaryDiscipline(project),
      });
    };

    const openApp = (app: AppId, payload?: WindowPayload) => {
      present({ app, title: APPS[app].label, payload });
    };

    const openUrl = (url: string) => {
      present({ app: 'browser', title: 'Browser', subtitle: url, payload: { url } });
    };

    /**
     * Leaves the site. Used by the email/social shortcuts, which belong to the
     * outside world and should behave like it — a new tab, `noopener` so the
     * target can never reach back into this window.
     *
     * `mailto:` and `tel:` are handed to the current tab instead. They hand off
     * to another application rather than loading a page, so opening them in a
     * new tab just strands an empty one behind the mail client.
     */
    const openExternal = (url: string) => {
      if (typeof window === 'undefined') return;
      if (/^(mailto:|tel:)/i.test(url)) {
        window.location.href = url;
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    /**
     * The creative-software easter eggs. They open a small system alert rather
     * than an app, because the joke is that this OS does not actually ship
     * Photoshop.
     */
    const openAlert = (alertId: string) => {
      const alert = portfolio.alerts.find((entry) => entry.id === alertId);
      if (!alert) return;
      present({
        app: 'alert',
        title: alert.app,
        subtitle: undefined,
        payload: { alertId },
        resizable: false,
      });
    };

    /**
     * Desktop icons store a `media` target as "<projectId>:<mediaId>" when the
     * item does not carry an explicit projectId, so one string can address a
     * single clip inside a project.
     */
    const openTarget = (target: DesktopTarget) => {
      switch (target.type) {
        case 'folder':
          return openFolder(target.value);
        case 'project':
          return openProject(target.value);
        case 'note':
          return openNote(target.value);
        case 'app':
          return openApp(target.value as AppId);
        case 'media': {
          const [a, b] = target.value.split(':');
          const projectId = target.projectId ?? a;
          const mediaId = b ?? target.value;
          return projectId ? openMedia(projectId, mediaId) : undefined;
        }
        case 'url':
          return openUrl(target.value);
        case 'external':
          return openExternal(target.value);
        case 'alert':
          return openAlert(target.value);
        default:
          return undefined;
      }
    };

    return {
      /**
       * For a caller that has already built a spec — the command palette, whose
       * search index stores one per result. Exposed so that "I know exactly
       * what I want to open" still goes through the surface instead of
       * reaching past it to `openWindow`.
       */
      present,
      openProject,
      openFolder,
      openNote,
      openMedia,
      openApp,
      openUrl,
      openExternal,
      openAlert,
      openTarget,
    };
  }, [openWindow, surface, portfolio]);
}
