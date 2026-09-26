/**
 * A project.
 *
 * Media first, words second: the banner fills the top of the window before any
 * text appears, and the narrative sections render only for the fields the
 * content file actually fills in — so a one-line project and a full case study
 * both come out looking deliberate.
 */
import { ArrowUpRight } from 'lucide-react';
import type { CaseStudy, Project } from '@/types/content';
import { usePortfolio } from '@/state/portfolio';
import { findProject, primaryDiscipline } from '@/lib/contentStore';
import { MediaGallery } from '@/components/media/MediaGallery';
import { Btn, DemoBadge, Empty, Meta, Tag } from '@/components/ui/Ui';
import { ProjectBanner, bodyMedia, resolveBanner } from './ProjectBanner';
import type { AppProps } from '../registry';
import './apps.css';

export function ProjectApp({ win }: AppProps) {
  const portfolio = usePortfolio();
  const project = findProject(portfolio, win.payload.projectId);

  if (!project) {
    return <Empty title="Project not found" hint="It may have been renamed in the content file." />;
  }

  return <CaseStudyBody project={project} />;
}

export function CaseStudyBody({ project, compact }: { project: Project; compact?: boolean }) {
  const discipline = primaryDiscipline(project);
  const cs = project.caseStudy;

  /*
   * The lead visual is a banner: its own field, its own local file, its own
   * fixed band. It is not one of the media items below and cannot be — see
   * `ProjectBanner`. Leave it unset and the case study opens on its title, with
   * no empty strip where one might have been.
   */
  const banner = resolveBanner(project);
  const rest = bodyMedia(project);

  const facts = [
    ['Company', project.company],
    ['Role', project.role],
    ['Year', project.year],
    ['Categories', project.categories.length ? project.categories.join(', ') : undefined],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <article
      className="case"
      data-discipline={discipline}
      data-compact={compact || undefined}
      data-bannerless={banner ? undefined : true}
    >
      {banner && <ProjectBanner banner={banner} />}

      <header className="case__head">
        <h1 className="case__title">{project.title}</h1>

        <p className="case__meta">
          {[project.company, project.year].filter(Boolean).join(' · ')}
          {project.demo && <DemoBadge label="Sample project" />}
        </p>

        {project.role && <p className="case__role">{project.role}</p>}
        {project.summary && <p className="case__intro">{project.summary}</p>}
      </header>

      {facts.length > 0 && (
        <dl className="case__facts">
          {facts.map(([label, value]) => (
            <div key={label} className="fact">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {project.description && <p className="case__lede">{project.description}</p>}

      {cs?.metrics.length ? (
        <section className="case__metrics" aria-label="Results">
          {cs.metrics.map((metric) => (
            <div key={metric.label} className="metric">
              <span className="metric__value">{metric.value}</span>
              <span className="metric__label">{metric.label}</span>
              {metric.note && <span className="metric__note">{metric.note}</span>}
            </div>
          ))}
        </section>
      ) : null}

      {cs && <Narrative cs={cs} />}

      {rest.length > 0 && (
        <section className="case__section">
          <div className="case__media">
            <MediaGallery
              media={rest}
              seed={project.id}
              discipline={discipline}
              /*
               * Provenance only. `project.tools` is deliberately NOT passed: it
               * is the tool list for the whole case study and belongs to the
               * footer below, not beside each individual image. Focus Mode reads
               * each item's own `media.tools` — see FocusContext.
               */
              context={{
                title: project.title,
                company: project.company,
                year: project.year,
              }}
            />
          </div>
        </section>
      )}

      {(project.responsibilities.length > 0 ||
        project.tools.length > 0 ||
        project.tags.length > 0 ||
        project.credits.length > 0) && (
        <section className="case__grid">
          {project.responsibilities.length > 0 && (
            <div className="case__col">
              <Meta>What I did</Meta>
              <ul className="case__bullets">
                {project.responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="case__col">
            {project.tools.length > 0 && (
              <>
                <Meta>Tools</Meta>
                <div className="case__chips">
                  {project.tools.map((tool) => (
                    <Tag key={tool} subtle>
                      {tool}
                    </Tag>
                  ))}
                </div>
              </>
            )}

            {project.tags.length > 0 && (
              <>
                <Meta>Tags</Meta>
                <div className="case__chips">
                  {project.tags.map((tag) => (
                    <Tag key={tag} subtle>
                      {tag}
                    </Tag>
                  ))}
                </div>
              </>
            )}

            {project.credits.length > 0 && (
              <>
                <Meta>Credits</Meta>
                <ul className="case__credits">
                  {project.credits.map((credit) => (
                    <li key={`${credit.role}-${credit.name}`}>
                      <span className="case__credit-role">{credit.role}</span>
                      <span>{credit.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}

      {project.links.length > 0 && (
        <footer className="case__links">
          {project.links.map((link) => (
            <Btn
              key={link.url}
              size="sm"
              variant="outline"
              iconEnd={<ArrowUpRight />}
              onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
            >
              {link.label}
            </Btn>
          ))}
        </footer>
      )}

      {project.demo && (
        <p className="case__disclaimer">
          Sample project. The narrative and any figures shown are illustrative content shipped with
          ASAAD.OS to demonstrate the layout — not reported results.
        </p>
      )}
    </article>
  );
}

function Narrative({ cs }: { cs: CaseStudy }) {
  const blocks: Array<[string, string | undefined]> = [
    ['Context', cs.context],
    ['Challenge', cs.challenge],
    ['Objective', cs.objective],
    ['Approach', cs.approach],
    ['Execution', cs.execution],
    ['Results', cs.results],
  ];
  const filled = blocks.filter((block): block is [string, string] => Boolean(block[1]));
  if (!filled.length && !cs.sections.length) return null;

  return (
    <section className="case__narrative">
      {filled.map(([label, body]) => (
        <div key={label} className="case__block">
          <h2 className="case__block-label">{label}</h2>
          <p className="case__block-body">{body}</p>
        </div>
      ))}
      {cs.sections.map((section) => (
        <div key={section.label} className="case__block">
          <h2 className="case__block-label">{section.label}</h2>
          <p className="case__block-body">{section.body}</p>
        </div>
      ))}
    </section>
  );
}
