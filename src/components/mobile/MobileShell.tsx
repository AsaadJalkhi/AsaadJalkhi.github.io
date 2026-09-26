/**
 * ASAAD.OS Mobile — the home screen.
 *
 * Not a squeezed desktop: windows, dragging and the custom cursor are gone.
 * Apps are cards, and opening one pushes a full-screen sheet. Every piece of
 * content the desktop exposes is reachable here, and Quick View sits at the top
 * because on a phone that is usually what someone actually wants.
 *
 * Opening is not this component's business. Its cards go through
 * `useOpenTarget` exactly like every tile inside a folder does, and
 * `MobileSurface` — which wraps the whole app — turns that into a sheet. Being
 * the shell is not a licence to take a shortcut: the shortcut is what the
 * folder bug was made of.
 */
import { ArrowRight, LayoutList, Moon, Search, Sun } from 'lucide-react';
import { useOs } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { useResolvedTheme } from '@/hooks/useTheme';
import { foldersSorted, featuredProjects, primaryDiscipline, projectThumb } from '@/lib/contentStore';
import { DOCK_APPS } from '@/components/windows/registry';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn, Tag } from '@/components/ui/Ui';
import './mobile.css';

export function MobileShell() {
  const portfolio = usePortfolio();
  const setView = useOs((state) => state.setView);
  const setPalette = useOs((state) => state.setPalette);
  const toggleTheme = useOs((state) => state.toggleTheme);
  const theme = useResolvedTheme();
  const { openProject, openFolder, openNote, openApp } = useOpenTarget();

  const { profile, settings } = portfolio;
  const folders = foldersSorted(portfolio);
  const featured = featuredProjects(portfolio);

  return (
    <div className="m-shell">
      <header className="m-top">
        <span className="m-top__mark">{profile.osName}</span>
        <div className="m-top__actions">
          {settings.theme.allowToggle && (
            <button
              type="button"
              className="m-top__icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`}
            >
              {theme === 'dark' ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />}
            </button>
          )}
          <button
            type="button"
            className="m-top__icon"
            onClick={() => setPalette(true)}
            aria-label="Search"
          >
            <Search strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <main className="m-scroll">
        <section className="m-hero">
          <p className="mono m-hero__positioning">{profile.positioning}</p>
          <h1 className="m-hero__name">{profile.name}</h1>
          <p className="m-hero__line">{profile.headline}</p>

          <div className="m-hero__actions">
            <Btn block size="lg" variant="primary" iconEnd={<LayoutList />} onClick={() => setView('quickview')}>
              Quick View
            </Btn>
            <p className="mono m-hero__hint">The full portfolio as one page</p>
          </div>
        </section>

        <section className="m-section">
          <h2 className="mono m-section__title">Selected work</h2>
          <div className="m-work">
            {featured.map((project) => (
              <button
                key={project.id}
                type="button"
                className="m-card"
                data-discipline={primaryDiscipline(project)}
                onClick={() => openProject(project.id)}
              >
                <span className="m-card__art">
                  <SmartImage
                    src={projectThumb(project)}
                    alt=""
                    seed={project.id}
                    discipline={primaryDiscipline(project)}
                    label={project.shortTitle ?? project.title}
                  />
                </span>
                <span className="m-card__body">
                  <span className="m-card__title">{project.title}</span>
                  <span className="m-card__summary">{project.summary}</span>
                  <span className="m-card__tags">
                    {project.disciplines.map((d) => (
                      <Tag key={d} discipline={d}>
                        {d}
                      </Tag>
                    ))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="m-section">
          <h2 className="mono m-section__title">Folders</h2>
          <div className="m-grid">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className="m-tile"
                data-discipline={folder.discipline}
                onClick={() => openFolder(folder.id)}
              >
                <span className="m-tile__label">{folder.name}</span>
                <span className="m-tile__count mono">
                  {portfolio.projects.filter((p) => p.folder === folder.id).length}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="m-section">
          <h2 className="mono m-section__title">Apps</h2>
          <div className="m-grid">
            {DOCK_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  className="m-tile m-tile--app"
                  onClick={() => openApp(app.id)}
                >
                  <Icon strokeWidth={1.4} />
                  <span className="m-tile__label">{app.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="m-section">
          <h2 className="mono m-section__title">Files</h2>
          <ul className="m-files">
            {portfolio.notes.map((note) => (
              <li key={note.id}>
                <button type="button" className="m-file" onClick={() => openNote(note.id)}>
                  <span>{note.title}</span>
                  <ArrowRight strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <footer className="m-foot">
          <p className="mono">
            {profile.osName} — {profile.positioning}
          </p>
          <p className="m-foot__note">
            The full desktop experience — draggable windows and all — is on a larger screen.
          </p>
        </footer>
      </main>
    </div>
  );
}
