/**
 * Quick View — the conventional portfolio.
 *
 * This is the recruiter path, and it is deliberately the least experimental
 * surface in the project: one scrollable page, semantic headings, everything
 * reachable without learning an interface. The only flourish is the entrance,
 * where the scattered desktop resolves into an ordered document.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, Download, Mail, X } from 'lucide-react';
import gsap from 'gsap';
import type { Project } from '@/types/content';
import { usePortfolio } from '@/state/portfolio';
import { useOs } from '@/state/os';
import { asset } from '@/lib/paths';
import { copyText } from '@/lib/utils';
import { featuredProjects, primaryDiscipline, projectThumb } from '@/lib/contentStore';
import { usePrefersReducedMotion } from '@/hooks/useEnvironment';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn, DemoBadge, SectionTitle, Tag } from '@/components/ui/Ui';
import { CaseStudyBody } from '@/components/windows/apps/ProjectApp';
import './quick-view.css';

export function QuickView() {
  const portfolio = usePortfolio();
  const setView = useOs((state) => state.setView);
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<Project | null>(null);

  const { profile, experience, skills } = portfolio;
  const featured = useMemo(() => featuredProjects(portfolio), [portfolio]);
  const cvHref = asset(profile.cv.file);

  // The "organising" entrance: blocks settle into place in document order.
  useLayoutEffect(() => {
    if (reduced || !root.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-settle]', {
        y: 18,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.06,
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div className="qv" ref={root}>
      <header className="qv__bar">
        <Btn size="sm" variant="ghost" icon={<ArrowLeft />} onClick={() => setView('desktop')}>
          Back to {profile.osName}
        </Btn>
        <div className="qv__bar-actions">
          <Btn
            size="sm"
            variant="outline"
            icon={<Download />}
            onClick={() => cvHref && window.open(cvHref, '_blank', 'noopener,noreferrer')}
          >
            {profile.cv.label}
          </Btn>
          <Btn
            size="sm"
            variant="primary"
            icon={<Mail />}
            onClick={() => window.open(`mailto:${profile.email}`, '_self')}
          >
            Get in touch
          </Btn>
        </div>
      </header>

      <main className="qv__main">
        {/* ── Introduction ── */}
        <section className="qv__intro" data-settle>
          <p className="mono qv__eyebrow">{profile.positioning}</p>
          <h1 className="qv__name">{profile.name}</h1>
          <p className="qv__headline">{profile.headline}</p>
          <p className="qv__lede">{profile.about[0]}</p>
        </section>

        {/* ── Selected work ── */}
        <section className="qv__section" id="work" data-settle>
          <SectionTitle index="01">Selected Work</SectionTitle>
          <div className="qv__work">
            {featured.map((project) => (
              <WorkCard key={project.id} project={project} onOpen={() => setReading(project)} />
            ))}
          </div>
        </section>

        {/* ── Experience ── */}
        <section className="qv__section" id="experience" data-settle>
          <SectionTitle index="02">Experience</SectionTitle>
          <ol className="qv__experience">
            {experience.map((job) => (
              <li key={job.id} className="qv-job">
                <div className="qv-job__meta">
                  <span className="mono qv-job__period">{job.period}</span>
                  {job.current && <span className="qv-job__now mono">Current</span>}
                </div>
                <div className="qv-job__body">
                  <h3 className="qv-job__role">{job.role}</h3>
                  <p className="qv-job__company">
                    {job.company}
                    {job.location && <span className="qv-job__where"> · {job.location}</span>}
                  </p>
                  {job.summary && <p className="qv-job__summary">{job.summary}</p>}
                  {job.highlights.length > 0 && (
                    <ul className="qv-job__highlights">
                      {job.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Capabilities ── */}
        <section className="qv__section" id="capabilities" data-settle>
          <SectionTitle index="03">Capabilities</SectionTitle>
          <div className="qv__skills">
            {skills.map((group) => (
              <div key={group.id} className="qv-skill" data-discipline={group.discipline}>
                <h3 className="qv-skill__title">{group.title}</h3>
                {group.caption && <p className="qv-skill__caption">{group.caption}</p>}
                <ul className="qv-skill__items">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── About ── */}
        <section className="qv__section" id="about" data-settle>
          <SectionTitle index="04">About</SectionTitle>
          <div className="qv__about">
            <div className="qv__about-body">
              {profile.about.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {profile.principles.length > 0 && (
              <aside className="qv__principles">
                <p className="mono qv__principles-title">How I work</p>
                <ul>
                  {profile.principles.map((principle) => (
                    <li key={principle}>{principle}</li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="qv__section qv__contact" id="contact" data-settle>
          <SectionTitle index="05">Contact</SectionTitle>
          <p className="qv__contact-line">
            {profile.availability ?? 'Open to new work.'} The fastest way to reach me is email.
          </p>
          <EmailRow email={profile.email} />
          <div className="qv__contact-grid">
            {profile.socials.map((social) => (
              <a
                key={social.url}
                className="qv__social"
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{social.label}</span>
                <span className="mono qv__social-handle">{social.handle ?? ''}</span>
                <ArrowUpRight strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="qv__footer">
        <span className="mono">
          {profile.osName} — {profile.positioning}
        </span>
        <Btn size="sm" variant="ghost" onClick={() => setView('desktop')}>
          Explore the OS
        </Btn>
      </footer>

      {reading && (
        <div className="qv-reader" role="dialog" aria-modal="true" aria-label={reading.title}>
          <button
            type="button"
            className="qv-reader__scrim"
            aria-label="Close case study"
            onClick={() => setReading(null)}
          />
          <div className="qv-reader__panel">
            <button type="button" className="qv-reader__close" onClick={() => setReading(null)}>
              <X strokeWidth={1.5} />
              <span className="sr-only">Close</span>
            </button>
            <div className="qv-reader__scroll">
              <CaseStudyBody project={reading} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const discipline = primaryDiscipline(project);
  return (
    <article className="qv-work" data-discipline={discipline}>
      <button type="button" className="qv-work__hit" onClick={onOpen}>
        <span className="qv-work__art">
          <SmartImage
            src={projectThumb(project)}
            alt=""
            seed={project.id}
            discipline={discipline}
            label={project.shortTitle ?? project.title}
          />
        </span>
        <span className="qv-work__body">
          <span className="qv-work__meta mono">
            {[project.company, project.year].filter(Boolean).join(' · ')}
          </span>
          <span className="qv-work__title">
            {project.title}
            {project.demo && <DemoBadge />}
          </span>
          <span className="qv-work__summary">{project.summary}</span>
          <span className="qv-work__tags">
            {project.disciplines.map((d) => (
              <Tag key={d} discipline={d}>
                {d}
              </Tag>
            ))}
          </span>
          <span className="qv-work__cta mono">
            Read case study <ArrowUpRight strokeWidth={1.5} />
          </span>
        </span>
      </button>
    </article>
  );
}

function EmailRow({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="qv__email">
      <a className="qv__email-link" href={`mailto:${email}`}>
        {email}
      </a>
      <Btn
        size="sm"
        variant={copied ? 'quiet' : 'outline'}
        icon={copied ? <Check /> : <Copy />}
        onClick={async () => {
          if (!(await copyText(email))) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Btn>
    </div>
  );
}
