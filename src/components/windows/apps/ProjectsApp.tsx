/**
 * Work — the visual archive.
 *
 * This is the window the portfolio is built around, so it is deliberately the
 * least "app-like" surface in the OS: media laid onto the canvas, a quiet
 * caption under each piece, and one thin row of folder filters. Opening a
 * project spawns its own window rather than navigating inside this one, which
 * is what makes comparing two pieces of work possible.
 *
 * **One layout, every collection.** All work, a brand tab, and a folder opened
 * from the desktop or from mobile are the same component with a different array
 * — a folder is this window carrying `payload.folderId`, never a second grid.
 * So `ProjectGrid` below is the only thing that positions project cards, and
 * fixing it fixes all of them at once. The Studio's Folder preview is the same
 * `WorkView` again, handed the unsaved draft instead of the published content.
 *
 * **Masonry, not rows.** Cards are packed shortest-column-first
 * (`lib/masonry.ts`), because tiles keep their own aspect ratio and a row-based
 * grid makes every card in a row as tall as the tallest — which left a white
 * gap under every card that was not. Column count comes from the container's
 * width, not the viewport's, since this window is resizable.
 *
 * Tile ratio comes from `project.tile.aspect` in the content file — that is
 * where the art direction of the grid lives, not in here. `tile.span` no longer
 * sets a card's width: masonry needs equal columns, or the packing degenerates
 * back into rows.
 */
import { useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { Folder, Portfolio, Project } from '@/types/content';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { useColumnCount } from '@/hooks/useColumnCount';
import { foldersSorted, primaryDiscipline, projectThumb } from '@/lib/contentStore';
import { packColumns } from '@/lib/masonry';
import { SmartImage } from '@/components/ui/SmartImage';
import { cx } from '@/lib/utils';
import type { AppProps } from '../registry';
import { ProjectBanner } from './ProjectBanner';
// The intro borrows `.case__banner` / `.case__head` from the case study sheet.
import './apps.css';
import './work.css';

/** CSS aspect-ratio values for the tile frame. */
const RATIO: Record<string, string> = {
  '16:9': '16 / 9',
  '4:5': '4 / 5',
  '1:1': '1 / 1',
  '9:16': '9 / 16',
  '3:2': '3 / 2',
  '4:3': '4 / 3',
  auto: '4 / 3',
};

const MOVING = new Set(['video', 'youtube', 'vimeo']);

/**
 * Content widths at which a third and a second column become available.
 *
 * Deliberately wider than the window's own container queries (900 / 560, which
 * only move padding around): a project card carries a three-line label under
 * its media, so it needs more room to stay readable than a bare picture does.
 * Three is the ceiling — a fourth column makes the work thumbnail-sized.
 */
const COLUMN_STEPS = [700, 1150] as const;

export function ProjectsApp({ win }: AppProps) {
  const portfolio = usePortfolio();
  const { openProject } = useOpenTarget();
  const [activeFolder, setActiveFolder] = useState<string | null>(win.payload.folderId ?? null);

  return (
    <WorkView
      portfolio={portfolio}
      activeFolder={activeFolder}
      onFilter={setActiveFolder}
      onOpen={openProject}
    />
  );
}

/**
 * The Work window's content, given everything it shows.
 *
 * Split out of `ProjectsApp` so the Studio preview can draw an unsaved draft
 * with the real filter row, ordering and grid: the window supplies the
 * published portfolio and `openProject`, the Studio supplies its draft and a
 * local callback. Nothing in here reads global state, routes or opens windows.
 */
export function WorkView({
  portfolio,
  activeFolder,
  onFilter,
  onOpen,
}: {
  portfolio: Portfolio;
  activeFolder: string | null;
  onFilter: (folderId: string | null) => void;
  onOpen: (projectId: string) => void;
}) {
  const folders = useMemo(() => foldersSorted(portfolio), [portfolio]);

  const projects = useMemo(() => {
    const list = activeFolder
      ? portfolio.projects.filter((p) => p.folder === activeFolder)
      : portfolio.projects;
    return [...list].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (a.order ?? 99) - (b.order ?? 99);
    });
  }, [portfolio.projects, activeFolder]);

  const open = activeFolder ? folders.find((folder) => folder.id === activeFolder) : undefined;
  const intro = open && hasIntro(open) ? open : undefined;

  return (
    <div className="work">
      <div className="work__bar">
        <div className="work__filters">
          <button
            type="button"
            className={cx('work__filter', activeFolder === null && 'work__filter--active')}
            onClick={() => onFilter(null)}
            aria-pressed={activeFolder === null}
          >
            All work
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={cx('work__filter', activeFolder === folder.id && 'work__filter--active')}
              onClick={() => onFilter(folder.id)}
              aria-pressed={activeFolder === folder.id}
            >
              {folder.name}
            </button>
          ))}
        </div>
        <span className="work__count">{projects.length}</span>
      </div>

      <div className="work__scroll">
        {intro && <FolderIntro folder={intro} />}
        {/* An empty folder stays empty: no placeholder, no editor instructions. */}
        {projects.length > 0 && <ProjectGrid projects={projects} onOpen={onOpen} />}
      </div>
    </div>
  );
}

/** Whether a folder has any intro content at all. None means no intro section. */
function hasIntro(folder: Folder): boolean {
  return Boolean(folder.introTitle?.trim() || folder.description?.trim() || folder.banner);
}

/**
 * The folder's masthead, above its cards: the project banner, then a title and
 * description in the case study's own header classes, so a folder opens with
 * the same weight a project does. `name` stays the tab label; `introTitle`
 * only replaces the heading.
 */
function FolderIntro({ folder }: { folder: Folder }) {
  const title = folder.introTitle?.trim() || folder.name;
  const description = folder.description?.trim();

  return (
    <section className="work__intro" data-bannerless={folder.banner ? undefined : true}>
      {folder.banner && <ProjectBanner banner={folder.banner} />}
      <header className="case__head">
        <h1 className="case__title">{title}</h1>
        {description && <p className="case__intro">{description}</p>}
      </header>
    </section>
  );
}

/** The `aspect-ratio` this project's frame is drawn with. */
function tileRatio(project: Project): string {
  return RATIO[project.tile?.aspect ?? '4:3'] ?? '4 / 3';
}

/**
 * How tall this card will be, in multiples of one column's width.
 *
 * The picture is its ratio, inverted; the rest is the label — title, company ·
 * year, and the discipline line that only shows on hover but always occupies
 * its row. A long title wraps, so it is charged for the extra line. Estimated
 * rather than measured, on purpose: see `lib/masonry.ts`.
 */
function estimateTileHeight(project: Project): number {
  const [w, h] = tileRatio(project).split('/').map(Number);
  const picture = h / w;
  const titleLines = Math.max(1, Math.ceil((project.title?.length ?? 0) / 30));
  return picture + 0.13 + (titleLines - 1) * 0.045;
}

/**
 * A collection of project cards, packed into as many columns as there is room
 * for. The only thing that differs between All work, a brand tab and an opened
 * folder is the array handed in.
 */
function ProjectGrid({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (projectId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const columns = useColumnCount(host, COLUMN_STEPS);

  return (
    <div className="work__grid" ref={host} data-columns={columns}>
      {packColumns(projects, columns, estimateTileHeight).map((column, index) => (
        <div className="work__col" key={index}>
          {column.map((project) => (
            <Tile key={project.id} project={project} onOpen={() => onOpen(project.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Tile({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const discipline = primaryDiscipline(project);
  const hasMotion = project.media.some((item) => MOVING.has(item.type));

  return (
    <button
      type="button"
      className="tile"
      style={{ ['--ratio' as string]: tileRatio(project) }}
      onClick={onOpen}
    >
      <span className="tile__media">
        <SmartImage
          src={projectThumb(project)}
          alt=""
          seed={project.id}
          discipline={discipline}
          label={project.shortTitle ?? project.title}
        />
        {hasMotion && (
          <span className="tile__play" aria-hidden="true">
            <Play strokeWidth={2} fill="currentColor" />
          </span>
        )}
      </span>

      <span className="tile__label">
        <span className="tile__title">
          {project.title}
          {project.demo && <i className="tile__sample">sample</i>}
        </span>
        <span className="tile__meta">
          {[project.company, project.year].filter(Boolean).join(' · ')}
        </span>
        <span className="tile__kind">{project.role ?? discipline}</span>
      </span>
    </button>
  );
}
