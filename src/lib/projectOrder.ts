/**
 * The one definition of project order, for the visitor-facing renderers and the Studio.
 *
 * Three fields, and they do not interfere:
 *
 *   - `folder.order`          → the sequence of folders
 *   - `project.order`         → a project's position inside its folder
 *   - `project.quickViewOrder` → a featured project's position in Quick View
 *
 * `featured` is Quick View membership only; it never moves a card in Work.
 * All Work is every folder by `folder.order`, each folder's projects by
 * `project.order`. The raw `projects[]` array is storage: it is the stable
 * tie-break and nothing more, so nothing here reorders it.
 *
 * The readers are pure. The Studio writers mutate order fields on the draft
 * they are given (inside `update`) and touch nothing else.
 */
import type { Folder, Project } from '@/types/content';
import { moveItem } from './utils';

/** A missing `order` sorts after authored ones, as it always has. */
const rank = (order?: number) => order ?? 99;

/** A stable copy sorted by `order`: ties keep their original sequence. */
function byOrder<T extends { order?: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => rank(a.order) - rank(b.order));
}

/* ---------------------------------------------------------------- readers */

export function orderedFolders(folders: readonly Folder[]): Folder[] {
  return byOrder(folders);
}

export function orderedProjectsInFolder(projects: readonly Project[], folderId: string): Project[] {
  return byOrder(projects.filter((project) => project.folder === folderId));
}

/**
 * All Work: folders by `folder.order`, then each folder's projects by
 * `project.order`. A project whose folder is unknown (hand-edited JSON the
 * validator would reject anyway) goes last rather than disappearing.
 */
export function orderedAllWorkProjects(
  folders: readonly Folder[],
  projects: readonly Project[],
): Project[] {
  const known = new Set(folders.map((folder) => folder.id));
  return [
    ...orderedFolders(folders).flatMap((folder) => orderedProjectsInFolder(projects, folder.id)),
    ...byOrder(projects.filter((project) => !known.has(project.folder))),
  ];
}

/**
 * Quick View: featured projects by `quickViewOrder`. Explicit values first;
 * missing ones follow in array order, which is exactly the legacy Quick View
 * when no project has one yet.
 */
export function orderedQuickViewProjects(projects: readonly Project[]): Project[] {
  return projects
    .filter((project) => project.featured)
    .map((project, index) => ({ project, index }))
    .sort(
      (a, b) =>
        (a.project.quickViewOrder ?? Infinity) - (b.project.quickViewOrder ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ project }) => project);
}

/* ------------------------------------------------------ Studio writers */

/** `order` = 1…N along the given sequence. */
function number(list: Project[]): void {
  list.forEach((project, index) => {
    project.order = index + 1;
  });
}

/** `quickViewOrder` = 1…N along the given sequence. */
function numberQuickView(list: Project[]): void {
  list.forEach((project, index) => {
    project.quickViewOrder = index + 1;
  });
}

/** Renumbers one folder 1…N in its current visible order. */
export function renumberFolder(projects: Project[], folderId: string): void {
  number(orderedProjectsInFolder(projects, folderId));
}

/**
 * The one folder reorder: drag and arrows both end here. `from` and `to` are
 * positions in the folder's visible order. Only `order` changes.
 */
export function moveInFolder(projects: Project[], folderId: string, from: number, to: number): boolean {
  const list = orderedProjectsInFolder(projects, folderId);
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
  number(moveItem(list, from, to));
  return true;
}

/** Puts a project (already in `projects`) last in its own folder: a new project. */
export function appendToFolder(projects: Project[], project: Project): void {
  number([...orderedProjectsInFolder(projects, project.folder).filter((p) => p !== project), project]);
}

/** Puts a project last in `folderId`, and renumbers the folder it left. */
export function moveToFolder(projects: Project[], project: Project, folderId: string): void {
  const previous = project.folder;
  if (previous === folderId) return;
  project.folder = folderId;
  appendToFolder(projects, project);
  renumberFolder(projects, previous);
}

/** Places `copy` (already in `projects`) right after `source` in their folder. */
export function placeAfter(projects: Project[], copy: Project, source: Project): void {
  const list = orderedProjectsInFolder(projects, source.folder).filter((p) => p !== copy);
  list.splice(list.indexOf(source) + 1, 0, copy);
  number(list);
}

/** The one Quick View reorder. Only `quickViewOrder` changes. */
export function moveInQuickView(projects: Project[], from: number, to: number): boolean {
  const list = orderedQuickViewProjects(projects);
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
  numberQuickView(moveItem(list, from, to));
  return true;
}

/** Featured on: last in Quick View. Off: its position cleared, the rest renumbered. */
export function setFeatured(projects: Project[], project: Project, on: boolean): void {
  if (project.featured === on) return;
  const others = orderedQuickViewProjects(projects).filter((p) => p !== project);
  if (on) {
    project.featured = true;
    numberQuickView([...others, project]);
  } else {
    project.featured = false;
    delete project.quickViewOrder;
    numberQuickView(others);
  }
}
