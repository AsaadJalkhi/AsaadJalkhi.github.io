import { usePortfolio } from '@/state/portfolio';
import { Meta } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/**
 * Capabilities.
 *
 * Grouped by discipline, not scored with percentage bars — "Photoshop 92%"
 * tells a reader nothing true.
 */
export function SkillsApp(_props: AppProps) {
  const { skills } = usePortfolio();

  return (
    <div className="skills">
      <header className="skills__head">
        <Meta>Capabilities</Meta>
        <p className="skills__lede">
          Three disciplines that keep overlapping. The overlap is the useful part.
        </p>
      </header>

      <div className="skills__grid">
        {skills.map((group) => (
          <section key={group.id} className="skill-group" data-discipline={group.discipline}>
            <h2 className="skill-group__title">{group.title}</h2>
            {group.caption && <p className="skill-group__caption">{group.caption}</p>}
            <ul className="skill-group__items">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
