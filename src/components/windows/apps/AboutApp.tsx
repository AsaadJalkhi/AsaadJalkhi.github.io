/**
 * About.
 *
 * A person, not a dashboard. The stat blocks that used to sit here counted
 * projects per discipline, which told a visitor nothing they could not see by
 * opening the Work window — and made the page read like an analytics panel.
 *
 * Everything below comes from `profile.aboutPage` in the content file, with a
 * fall back to the older `profile.about` / `profile.principles` fields so the
 * page is never empty while that content is being written.
 */
import { usePortfolio } from '@/state/portfolio';
import { Poster } from '@/components/ui/Poster';
import { asset } from '@/lib/paths';
import type { AppProps } from '../registry';
import './apps.css';

export function AboutApp(_props: AppProps) {
  const { profile } = usePortfolio();
  const page = profile.aboutPage;

  const lede = page.lede ?? profile.positioning;
  const paragraphs = page.paragraphs.length > 0 ? page.paragraphs : profile.about;
  const portrait = asset(page.portrait);

  // Legacy `principles` become one more list rather than being dropped.
  const lists =
    page.lists.length > 0
      ? page.lists
      : profile.principles.length > 0
        ? [{ title: 'How I work', items: profile.principles }]
        : [];

  return (
    <div className="about">
      <header className="about__hero">
        <div className="about__portrait">
          {portrait ? (
            <img src={portrait} alt={profile.name} />
          ) : (
            <Poster
              seed={`${profile.name}-portrait`}
              label={profile.name}
              discipline="creative"
              bare
            />
          )}
        </div>

        <div className="about__intro">
          <h1 className="about__name">{profile.name}</h1>
          {lede && <p className="about__positioning">{lede}</p>}
          {profile.availability && <p className="about__availability">{profile.availability}</p>}
        </div>
      </header>

      {page.statement && <p className="about__statement">{page.statement}</p>}

      {paragraphs.length > 0 && (
        <div className="about__body">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}

      {page.images.length > 0 && (
        <div className="about__gallery">
          {page.images.map((image) => (
            <figure key={image.src} className="about__figure">
              <img src={asset(image.src)} alt={image.alt ?? ''} loading="lazy" />
              {image.caption && <figcaption>{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {lists.length > 0 && (
        <div className="about__lists">
          {lists.map((list) => (
            <section key={list.title} className="about__list">
              <h2 className="about__list-title">{list.title}</h2>
              <ul>
                {list.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {page.footnote && <p className="about__footnote">{page.footnote}</p>}
    </div>
  );
}
