/**
 * Work — the visual archive.
 *
 * This is the window the portfolio is built around, so it is deliberately the
 * least "app-like" surface in the OS: media laid onto the canvas, a quiet
 * caption under each piece, and one thin row of folder filters. Opening a
 * project spawns its own window rather than navigating inside this one, which
 * is what makes comparing two pieces of work possible.
 *
 * Tile size and ratio come from `project.tile` in the content file — that is
 * where the art direction of the grid lives, not in here.
 */
import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type { Project } from '@/types/content';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { foldersSorted, primaryDiscipline, projectThumb } from '@/lib/contentStore';
import { SmartImage } from '@/components/ui/SmartImage';
import { Empty } from '@/components/ui/Ui';
import { cx } from '@/lib/utils';
import type { AppProps } from '../registry';
import './work.css';

/** Grid columns each tile size occupies, out of 12. */
const SPAN: Record<string, number> = { sm: 3, md: 4, lg: 6, xl: 8 };

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

export function ProjectsApp({ win }: AppProps) {
  const portfolio = usePortfolio();
  const { openProject } = useOpenTarget();
  const folders = useMemo(() => foldersSorted(portfolio), [portfolio]);
  const [activeFolder, setActiveFolder] = useState<string | null>(win.payload.folderId ?? null);

  const projects = useMemo(() => {
    const list = activeFolder
      ? portfolio.projects.filter((p) => p.folder === activeFolder)
      : portfolio.projects;
    return [...list].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (a.order ?? 99) - (b.order ?? 99);
    });
  }, [portfolio.projects, activeFolder]);

  return (
    <div className="work">
      <div className="work__bar">
        <div className="work__filters">
          <button
            type="button"
            className={cx('work__filter', activeFolder === null && 'work__filter--active')}
            onClick={() => setActiveFolder(null)}
            aria-pressed={activeFolder === null}
          >
            All work
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={cx('work__filter', activeFolder === folder.id && 'work__filter--active')}
              onClick={() => setActiveFolder(folder.id)}
              aria-pressed={activeFolder === folder.id}
            >
              {folder.name}
            </button>
          ))}
        </div>
        <span className="work__count">{projects.length}</span>
      </div>

      <div className="work__scroll">
        {projects.length === 0 ? (
          <div className="work__empty">
            <Empty
              title="Nothing here yet"
              hint="Add a project in Portfolio Studio, or edit src/content/portfolio.json."
            />
          </div>
        ) : (
          <div className="work__grid">
            {projects.map((project) => (
              <Tile key={project.id} project={project} onOpen={() => openProject(project.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const discipline = primaryDiscipline(project);
  const span = SPAN[project.tile?.span ?? 'md'] ?? 4;
  const ratio = RATIO[project.tile?.aspect ?? '4:3'] ?? '4 / 3';
  const hasMotion = project.media.some((item) => MOVING.has(item.type));

  return (
    <button
      type="button"
      className="tile"
      style={{ ['--span' as string]: span, ['--ratio' as string]: ratio }}
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
