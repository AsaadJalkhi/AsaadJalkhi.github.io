/**
 * Profile, CV, contact details and site settings.
 *
 * This is the panel to visit first when replacing the demo identity with your
 * own — the placeholder email and URL live here.
 *
 * "Identity" is the short version used all over the site (menu bar, Quick View,
 * search). "The About window" is the long, human version: it has no counters
 * and no statistics by design — About is where a person speaks, not where the
 * site reports on itself.
 */
import { Toggle } from '@/components/ui/Ui';
import type { PanelProps } from '../useDraft';
import {
  Area,
  FoldBar,
  Grid,
  Lines,
  Num,
  PanelHead,
  Repeater,
  Section,
  Text,
  useFolds,
} from './parts';

/** The collapsible sections of this tab, in page order. */
const FOLDS = ['identity', 'about', 'contact', 'cv', 'site'] as const;
type Fold = (typeof FOLDS)[number];

export function ProfilePanel({ draft, update }: PanelProps) {
  const { profile, settings } = draft;

  const patchProfile = (changes: Partial<typeof profile>) =>
    update((next) => {
      Object.assign(next.profile, changes);
    });

  const about = profile.aboutPage;
  const patchAbout = (changes: Partial<typeof about>) =>
    update((next) => {
      Object.assign(next.profile.aboutPage, changes);
    });

  const patchContact = (changes: Partial<typeof profile.contact>) =>
    update((next) => {
      Object.assign(next.profile.contact, changes);
    });

  const patchCv = (changes: Partial<typeof profile.cv>) =>
    update((next) => {
      Object.assign(next.profile.cv, changes);
    });

  // Which sections are open: UI state only, never content.
  const folds = useFolds<Fold>();
  const summary: Record<Fold, string> = {
    identity: [profile.name, profile.headline].filter(Boolean).join(' · '),
    about: `${about.images.length} image(s) · ${about.lists.length} list(s)`,
    contact: [profile.email, `${profile.socials.length} link(s)`].filter(Boolean).join(' · '),
    cv: `${profile.cv.sections.length} section(s)`,
    site: settings.seo.title,
  };

  return (
    <div className="studio-panel">
      <PanelHead
        title="Profile & CV"
        lede="Who you are, how to reach you, and what the CV window shows."
      />

      <FoldBar folds={folds} ids={FOLDS} />

      <Section title="Identity" {...folds.props('identity', summary.identity)}>
        <Grid>
          <Text label="Name" value={profile.name} onChange={(v) => patchProfile({ name: v })} />
          <Text
            label="OS name"
            value={profile.osName}
            hint="Shown during boot and in the menu bar"
            onChange={(v) => patchProfile({ osName: v })}
          />
          <Text
            label="Positioning"
            value={profile.positioning}
            hint="e.g. Marketing / Creative / Digital"
            onChange={(v) => patchProfile({ positioning: v })}
          />
          <Text
            label="Location"
            value={profile.location}
            onChange={(v) => patchProfile({ location: v })}
          />
          <Text
            label="Availability"
            value={profile.availability}
            onChange={(v) => patchProfile({ availability: v })}
          />
        </Grid>

        <Text
          label="Headline"
          value={profile.headline}
          wide
          onChange={(v) => patchProfile({ headline: v })}
        />
        <Text
          label="Subheadline"
          value={profile.subheadline}
          wide
          onChange={(v) => patchProfile({ subheadline: v })}
        />

        <Lines
          label="About paragraphs"
          value={profile.about}
          rows={6}
          hint="One paragraph per line. At least one is required."
          onChange={(v) => patchProfile({ about: v })}
        />
        <Lines
          label="Principles"
          value={profile.principles}
          rows={5}
          hint="Short “what I actually do” lines"
          onChange={(v) => patchProfile({ principles: v })}
        />
      </Section>

      <Section
        title="The About window"
        {...folds.props('about', summary.about)}
        hint="The long version. Leave it all empty and the window falls back to the About paragraphs above."
      >
        <Text
          label="Opening line"
          value={about.lede}
          wide
          hint="One strong sentence, set large at the top"
          onChange={(v) => patchAbout({ lede: v || undefined })}
        />
        <Text
          label="Positioning statement"
          value={about.statement}
          wide
          hint="A short line under the opening — what you do, in your own words"
          onChange={(v) => patchAbout({ statement: v || undefined })}
        />

        <Lines
          label="Paragraphs"
          value={about.paragraphs}
          rows={8}
          hint="One paragraph per line. How you work, what you care about, what you are like to work with."
          onChange={(v) => patchAbout({ paragraphs: v })}
        />

        <Grid>
          <Text
            label="Portrait"
            value={about.portrait}
            mono
            placeholder="media/portrait.jpg"
            hint="A photo of you, from /public. Optional."
            onChange={(v) => patchAbout({ portrait: v || undefined })}
          />
          <Text
            label="Closing footnote"
            value={about.footnote}
            hint="A last quiet line at the bottom. Good place for a joke."
            onChange={(v) => patchAbout({ footnote: v || undefined })}
          />
        </Grid>

        <p className="studio-sub">Image strip</p>
        <Repeater
          items={about.images}
          onChange={(images) => patchAbout({ images })}
          create={() => ({ src: 'media/' })}
          labelOf={(image) => image.caption ?? image.src}
          addLabel="Add image"
          empty="Optional — a workspace, a set, a shelf. Anything true."
        >
          {(image, patch) => (
            <Grid cols={3}>
              <Text label="File" value={image.src} mono onChange={(v) => patch({ src: v })} />
              <Text label="Alt text" value={image.alt} onChange={(v) => patch({ alt: v })} />
              <Text label="Caption" value={image.caption} onChange={(v) => patch({ caption: v })} />
            </Grid>
          )}
        </Repeater>

        <p className="studio-sub">Short lists</p>
        <Repeater
          items={about.lists}
          onChange={(lists) => patchAbout({ lists })}
          create={() => ({ title: 'Currently', items: ['Something true'] })}
          labelOf={(list) => `${list.title} · ${list.items.length} item(s)`}
          addLabel="Add list"
          empty={'Small columns at the end — "Currently", "Tools I live in", "Off the clock".'}
        >
          {(list, patch) => (
            <>
              <Text label="Title" value={list.title} onChange={(v) => patch({ title: v })} />
              <Lines
                label="Items"
                value={list.items}
                rows={5}
                hint="One per line. At least one required."
                onChange={(v) => patch({ items: v })}
              />
            </>
          )}
        </Repeater>
      </Section>

      <Section
        title="Contact"
        {...folds.props('contact', summary.contact)}
        hint="The email and links here feed the Contact window, the menu bar, and Quick View."
      >
        <Text
          label="Contact headline"
          value={profile.contact.headline}
          wide
          placeholder="Open to new work."
          hint="The line at the top of the Contact window. Defaults to Availability above."
          onChange={(v) => patchContact({ headline: v || undefined })}
        />
        <Text
          label="Contact note"
          value={profile.contact.note}
          wide
          hint="One friendly line under it — how you prefer to be reached, how fast you reply."
          onChange={(v) => patchContact({ note: v || undefined })}
        />

        <Grid>
          <Text
            label="Email"
            value={profile.email}
            mono
            hint="Must be a valid address"
            onChange={(v) => patchProfile({ email: v })}
          />
          <Text label="Phone" value={profile.phone} onChange={(v) => patchProfile({ phone: v })} />
        </Grid>

        <Repeater
          items={profile.socials}
          onChange={(socials) => patchProfile({ socials })}
          create={() => ({ label: 'LinkedIn', url: 'https://' })}
          labelOf={(social) => social.label}
          addLabel="Add social link"
        >
          {(social, patch) => (
            <Grid cols={3}>
              <Text label="Label" value={social.label} onChange={(v) => patch({ label: v })} />
              <Text label="Handle" value={social.handle} onChange={(v) => patch({ handle: v })} />
              <Text label="URL" value={social.url} mono onChange={(v) => patch({ url: v })} />
            </Grid>
          )}
        </Repeater>
      </Section>

      <Section
        title="CV"
        {...folds.props('cv', summary.cv)}
        hint="Put the PDF in public/cv/ and reference it without a leading slash."
      >
        <Grid>
          <Text
            label="PDF path"
            value={profile.cv.file}
            mono
            placeholder="cv/asaad-cv.pdf"
            onChange={(v) => patchCv({ file: v })}
          />
          <Text
            label="Download label"
            value={profile.cv.label}
            onChange={(v) => patchCv({ label: v })}
          />
          <Text
            label="Updated"
            value={profile.cv.updated}
            hint="e.g. September 2026"
            onChange={(v) => patchCv({ updated: v })}
          />
          <Text
            label="Preview image"
            value={profile.cv.preview}
            mono
            onChange={(v) => patchCv({ preview: v })}
          />
        </Grid>

        <p className="mono studio-sub">Text version (rendered inside the CV window)</p>
        <Repeater
          items={profile.cv.sections}
          onChange={(sections) => patchCv({ sections })}
          create={() => ({ heading: 'Section', lines: ['First line'] })}
          labelOf={(section) => section.heading}
          addLabel="Add CV section"
          empty="Without this the CV window only offers the download."
        >
          {(section, patch) => (
            <>
              <Text
                label="Heading"
                value={section.heading}
                onChange={(v) => patch({ heading: v })}
              />
              <Lines
                label="Lines"
                value={section.lines}
                rows={5}
                onChange={(v) => patch({ lines: v })}
              />
            </>
          )}
        </Repeater>
      </Section>

      <Section title="Site settings" {...folds.props('site', summary.site)}>
        <Grid cols={1}>
          <Text
            label="SEO title"
            value={settings.seo.title}
            onChange={(v) =>
              update((next) => {
                next.settings.seo.title = v;
              })
            }
          />
          <Area
            label="SEO description"
            value={settings.seo.description}
            rows={2}
            onChange={(v) =>
              update((next) => {
                next.settings.seo.description = v;
              })
            }
          />
          <Text
            label="Site URL"
            value={settings.seo.url}
            mono
            hint="Also update the canonical + og:url tags in index.html"
            onChange={(v) =>
              update((next) => {
                next.settings.seo.url = v;
              })
            }
          />
        </Grid>

        <Grid>
          <Num
            label="Boot duration (ms)"
            value={settings.boot.duration}
            min={300}
            max={4000}
            step={100}
            onChange={(v) =>
              update((next) => {
                next.settings.boot.duration = v ?? 1400;
              })
            }
          />
        </Grid>

        <div className="studio-toggles">
          <Toggle
            label="Boot sequence"
            hint="The short initialisation animation"
            checked={settings.boot.enabled}
            onChange={(v) =>
              update((next) => {
                next.settings.boot.enabled = v;
              })
            }
          />
          <Toggle
            label="Shorten after first visit"
            checked={settings.boot.shortenAfterFirstVisit}
            onChange={(v) =>
              update((next) => {
                next.settings.boot.shortenAfterFirstVisit = v;
              })
            }
          />
          <Toggle
            label="Custom cursor"
            hint="Desktop only"
            checked={settings.customCursor}
            onChange={(v) =>
              update((next) => {
                next.settings.customCursor = v;
              })
            }
          />
        </div>
      </Section>
    </div>
  );
}
