import { Download, FileText } from 'lucide-react';
import { usePortfolio } from '@/state/portfolio';
import { asset } from '@/lib/paths';
import { Btn, DemoBadge } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/**
 * CV. The readable version lives in the content file so it is searchable and
 * always in sync; the PDF is the download.
 */
export function CvApp(_props: AppProps) {
  const { profile } = usePortfolio();
  const href = asset(profile.cv.file);

  return (
    <div className="cv">
      <header className="cv__head">
        <div>
          <h1 className="cv__name">{profile.name}</h1>
          <p className="cv__role">{profile.positioning}</p>
          <p className="cv__contact mono">
            {profile.email}
            {profile.location ? ` · ${profile.location}` : ''}
          </p>
        </div>
        <div className="cv__actions">
          <Btn
            variant="primary"
            icon={<Download />}
            onClick={() => href && window.open(href, '_blank', 'noopener,noreferrer')}
            disabled={!href}
          >
            {profile.cv.label}
          </Btn>
          {profile.cv.updated && (
            <span className="cv__updated mono">
              {profile.cv.updated}
              {profile.cv.updated.toLowerCase().includes('demo') && <DemoBadge />}
            </span>
          )}
        </div>
      </header>

      <div className="cv__sheet">
        {profile.cv.sections.map((section) => (
          <section key={section.heading} className="cv__section">
            <h2 className="mono cv__heading">{section.heading}</h2>
            <ul className="cv__lines">
              {section.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}

        {profile.cv.sections.length === 0 && (
          <p className="cv__empty">
            <FileText strokeWidth={1.5} /> Add CV sections in portfolio.json → profile.cv.sections
          </p>
        )}
      </div>
    </div>
  );
}
