import { ArrowUpRight } from 'lucide-react';
import { usePortfolio } from '@/state/portfolio';
import { useOpenTarget } from '@/hooks/useOpenTarget';
import { Btn, Tag } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

export function ExperienceApp(_props: AppProps) {
  const { experience } = usePortfolio();
  const { openProject } = useOpenTarget();

  return (
    <div className="experience">
      <header className="experience__head">
        <p className="experience__lede">Where the work in this portfolio came from.</p>
      </header>

      <ol className="timeline">
        {experience.map((job) => (
          <li key={job.id} className="timeline__item" data-current={job.current || undefined}>
            <div className="timeline__marker" aria-hidden="true" />
            <div className="timeline__body">
              <div className="timeline__top">
                <h2 className="timeline__role">{job.role}</h2>
                <span className="mono timeline__period">{job.period}</span>
              </div>
              <p className="timeline__company">
                {job.company}
                {job.location && <span className="timeline__location"> · {job.location}</span>}
              </p>
              {job.summary && <p className="timeline__summary">{job.summary}</p>}

              {job.highlights.length > 0 && (
                <ul className="timeline__highlights">
                  {job.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              )}

              <div className="timeline__footer">
                <div className="timeline__tags">
                  {job.disciplines.map((discipline) => (
                    <Tag key={discipline} discipline={discipline}>
                      {discipline}
                    </Tag>
                  ))}
                </div>
                {job.projectId && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    iconEnd={<ArrowUpRight />}
                    onClick={() => openProject(job.projectId as string)}
                  >
                    See the work
                  </Btn>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
