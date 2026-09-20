/**
 * Projects panel — the main editing surface.
 *
 * Master list on the left (add / duplicate / reorder / delete), full editor on
 * the right: metadata, case study, media, links and credits.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Btn, Empty, Toggle } from '@/components/ui/Ui';
import type { CaseStudy, MediaItem, Project } from '@/types/content';
import { uid } from '@/lib/utils';
import { MediaRenderer, MEDIA_LABELS } from '@/components/media/MediaRenderer';
import type { PanelProps } from '../useDraft';
import { MediaFields } from './MediaFields';
import {
  Advanced,
  IdField,
  Area,
  Choice,
  DisciplinePicker,
  Grid,
  IconBtn,
  IconFields,
  Lines,
  Num,
  PanelHead,
  Repeater,
  Section,
  Tags,
  slugFromTitle,
  Text,
  opts,
  uniqueSlug,
} from './parts';

/** Mirrors LinkSchema in types/content.ts. Aspect and scene lists live in MediaFields. */
const LINK_KINDS = [
  'website',
  'instagram',
  'linkedin',
  'youtube',
  'vimeo',
  'behance',
  'email',
  'file',
  'other',
] as const;

/*
 * `tile` is the art direction of the Work grid. Exposed as plain-English size
 * and shape rather than as raw JSON, because "how big should this be" is a
 * design decision and nobody should have to remember the enum.
 */
const TILE_SPANS = [
  { value: 'sm', label: 'Small — quarter width' },
  { value: 'md', label: 'Medium — default' },
  { value: 'lg', label: 'Large — half width' },
  { value: 'xl', label: 'Extra large — full width' },
];

const TILE_ASPECTS = [
  { value: 'auto', label: 'Auto — follow the image' },
  { value: '4:3', label: '4:3 — landscape (default)' },
  { value: '16:9', label: '16:9 — wide' },
  { value: '3:2', label: '3:2 — photo' },
  { value: '1:1', label: '1:1 — square' },
  { value: '4:5', label: '4:5 — portrait' },
  { value: '9:16', label: '9:16 — story' },
];


/**
 * Keeps `heroMediaId` pointing at something that exists.
 *
 * Deleting the media item a project uses as its hero used to leave a dangling
 * reference. It is a validation error now — deliberately, because silently
 * losing the hero would be worse — but the person who just pressed Delete on a
 * row should not then have to go and fix an error they did not know they
 * caused. So the reference is cleared here, at the moment it goes stale.
 */
function withHero(project: Project, media: MediaItem[]): Partial<Project> {
  if (project.heroMediaId && !media.some((item) => item.id === project.heroMediaId)) {
    return { media, heroMediaId: undefined };
  }
  return { media };
}

/**
 * Which media item opens the case study.
 *
 * Before this, the hero was implicit: whichever item happened to be `featured`,
 * or failing that whichever happened to be first. That made two unrelated
 * decisions share one switch — "give this a full-width row in the body" also
 * silently meant "put it at the top" — and it meant reordering the media list
 * could change the top of the page by accident.
 *
 * None is a real answer, not an empty state. A case study that opens on its
 * title is a legitimate piece of art direction, and it is what several
 * text-led projects want.
 */
function HeroPicker({
  project,
  patch,
}: {
  project: Project;
  patch: (changes: Partial<Project>) => void;
}) {
  const options = [
    { value: '', label: 'None — start with the title' },
    ...project.media.map((item, i) => ({
      value: item.id,
      label: `${String(i + 1).padStart(2, '0')} · ${MEDIA_LABELS[item.type] ?? item.type} — ${
        item.caption ?? item.alt ?? item.id
      }`,
    })),
  ];

  const hero = project.media.find((item) => item.id === project.heroMediaId);

  if (!project.media.length) {
    return (
      <p className="studio-rep__empty">
        Add some media above and you can choose one of them to open the case study.
      </p>
    );
  }

  return (
    <>
      <Grid>
        <Choice
          label="Hero media"
          value={project.heroMediaId ?? ''}
          options={options}
          hint="Shown full-bleed at the top of the case study, at its own aspect ratio."
          onChange={(v) => patch({ heroMediaId: v || undefined })}
        />
        <div className="studio-hero-preview">
          {hero ? (
            <MediaRenderer
              media={hero}
              seed={`${project.id}-hero-preview`}
              discipline={project.disciplines[0]}
              mode="card"
            />
          ) : (
            <span className="studio-hero-preview__none mono">no hero</span>
          )}
        </div>
      </Grid>
      {hero && (
        <div className="studio-toggles">
          <Toggle
            label="Also show the hero in the media below"
            hint="Off by default — the hero is already at the top, and repeating it makes the page look like a mistake."
            checked={project.showHeroInMedia ?? false}
            onChange={(v) => patch({ showHeroInMedia: v || undefined })}
          />
        </div>
      )}
    </>
  );
}

function blankProject(id: string, folder: string): Project {
  return {
    id,
    title: 'New project',
    folder,
    summary: 'One line describing this project.',
    disciplines: [],
    categories: [],
    tags: [],
    responsibilities: [],
    tools: [],
    credits: [],
    media: [],
    links: [],
    featured: false,
    demo: false,
  };
}

export function ProjectsPanel({ draft, update }: PanelProps) {
  const [selected, setSelected] = useState<string | null>(draft.projects[0]?.id ?? null);

  const index = draft.projects.findIndex((project) => project.id === selected);
  const project = index >= 0 ? draft.projects[index] : draft.projects[0];
  const activeIndex = project ? draft.projects.findIndex((p) => p.id === project.id) : -1;

  const folderOptions = draft.folders.map((folder) => ({ value: folder.id, label: folder.name }));

  /** Apply changes to the selected project. */
  const patch = (changes: Partial<Project>) =>
    update((next) => {
      const target = next.projects[activeIndex];
      if (target) Object.assign(target, changes);
    });

  const patchCase = (changes: Partial<CaseStudy>) =>
    update((next) => {
      const target = next.projects[activeIndex];
      if (!target) return;
      target.caseStudy = { ...(target.caseStudy ?? { metrics: [], sections: [] }), ...changes };
    });

  const addProject = () => {
    const id = uniqueSlug(
      draft.projects.map((p) => p.id),
      'new-project',
    );
    update((next) => {
      next.projects.push(blankProject(id, next.folders[0]?.id ?? 'web'));
    });
    setSelected(id);
  };

  const duplicateProject = () => {
    if (!project) return;
    const id = uniqueSlug(
      draft.projects.map((p) => p.id),
      `${project.id}-copy`,
    );
    update((next) => {
      const source = next.projects[activeIndex];
      if (!source) return;
      const clone = structuredClone(source);
      clone.id = id;
      clone.title = `${source.title} (copy)`;
      next.projects.splice(activeIndex + 1, 0, clone);
    });
    setSelected(id);
  };

  const deleteProject = () => {
    if (!project) return;
    const fallback = draft.projects.find((p) => p.id !== project.id)?.id ?? null;
    update((next) => {
      next.projects = next.projects.filter((p) => p.id !== project.id);
    });
    setSelected(fallback);
  };

  const moveProject = (direction: -1 | 1) => {
    update((next) => {
      const to = activeIndex + direction;
      if (to < 0 || to >= next.projects.length) return;
      const [moved] = next.projects.splice(activeIndex, 1);
      if (moved) next.projects.splice(to, 0, moved);
    });
  };

  return (
    <div className="studio-panel">
      <PanelHead
        title="Projects"
        lede="Everything a case study shows. Fields left blank are simply not rendered — only title, summary, folder and id are required."
      />

      <div className="studio-split">
        <aside className="studio-list">
          <header className="studio-list__head">
            <span className="mono">{draft.projects.length} project(s)</span>
            <Btn variant="quiet" size="sm" icon={<Plus />} onClick={addProject}>
              New
            </Btn>
          </header>

          <div className="studio-list__scroll">
            {draft.projects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`studio-list__item${item.id === project?.id ? ' studio-list__item--active' : ''}`}
                onClick={() => setSelected(item.id)}
              >
                <span className="studio-list__title">
                  {item.title}
                  {item.featured && <span className="studio-list__star">★</span>}
                </span>
                <span className="mono studio-list__meta">
                  {item.folder}
                  {item.year ? ` · ${item.year}` : ''}
                  {item.demo ? ' · demo' : ''}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="studio-detail">
          {!project ? (
            <Empty
              title="No projects yet"
              hint="Create one with the New button — it will appear on the desktop and in Quick View."
            />
          ) : (
            <>
              <header className="studio-detail__head">
                <h3 className="studio-detail__title">{project.title}</h3>
                <div className="studio-detail__tools">
                  <IconBtn
                    label="Move up"
                    disabled={activeIndex <= 0}
                    onClick={() => moveProject(-1)}
                  >
                    <ArrowUp strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn
                    label="Move down"
                    disabled={activeIndex >= draft.projects.length - 1}
                    onClick={() => moveProject(1)}
                  >
                    <ArrowDown strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn label="Duplicate" onClick={duplicateProject}>
                    <Copy strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn label="Delete" danger onClick={deleteProject}>
                    <Trash2 strokeWidth={1.5} />
                  </IconBtn>
                </div>
              </header>

              <Section title="Identity">
                <Grid>
                  <Text
                    label="Title"
                    value={project.title}
                    onChange={(v) => {
                      // A project that still has its generated id follows the
                      // title, so nobody has to think about slugs. Once the id
                      // has been set deliberately it is left alone — links and
                      // references out in the world depend on it.
                      if (project.id.startsWith('new-project')) {
                        const id = slugFromTitle(
                          draft.projects.filter((p) => p.id !== project.id).map((p) => p.id),
                          v,
                          'project',
                        );
                        patch({ title: v, id });
                        setSelected(id);
                        return;
                      }
                      patch({ title: v });
                    }}
                  />
                  <Text
                    label="Short title"
                    value={project.shortTitle}
                    hint="Used in tight spots"
                    onChange={(v) => patch({ shortTitle: v })}
                  />
                  <Choice
                    label="Folder"
                    value={project.folder}
                    options={folderOptions}
                    onChange={(v) => patch({ folder: v })}
                  />
                  <Text
                    label="Company"
                    value={project.company}
                    onChange={(v) => patch({ company: v })}
                  />
                  <Text label="Year" value={project.year} onChange={(v) => patch({ year: v })} />
                  <Text label="Role" value={project.role} onChange={(v) => patch({ role: v })} />
                  <Text
                    label="Location"
                    value={project.location}
                    onChange={(v) => patch({ location: v })}
                  />
                  <Num
                    label="Order"
                    value={project.order}
                    hint="Lower sorts first inside the folder"
                    onChange={(v) => patch({ order: v })}
                  />
                  <Text
                    label="Thumbnail"
                    value={project.thumbnail}
                    hint="Falls back to the first media item"
                    onChange={(v) => patch({ thumbnail: v })}
                  />
                </Grid>

                <Area
                  label="Summary"
                  value={project.summary}
                  rows={2}
                  hint="One line. Shown on cards and list rows."
                  onChange={(v) => patch({ summary: v })}
                />
                <Area
                  label="Description"
                  value={project.description}
                  hint="Optional longer intro for the case study header"
                  onChange={(v) => patch({ description: v })}
                />

                <DisciplinePicker
                  value={project.disciplines}
                  onChange={(v) => patch({ disciplines: v })}
                />

                <Grid cols={1}>
                  <Tags
                    label="Categories"
                    value={project.categories}
                    onChange={(v) => patch({ categories: v })}
                  />
                  <Tags label="Tags" value={project.tags} onChange={(v) => patch({ tags: v })} />
                  <Tags label="Tools" value={project.tools} onChange={(v) => patch({ tools: v })} />
                </Grid>

                <Lines
                  label="Responsibilities"
                  value={project.responsibilities}
                  onChange={(v) => patch({ responsibilities: v })}
                />

                <div className="studio-toggles">
                  <Toggle
                    label="Featured"
                    hint="Appears in Quick View → Selected Work"
                    checked={project.featured}
                    onChange={(v) => patch({ featured: v })}
                  />
                  <Toggle
                    label="Demo content"
                    hint="Labels this as sample work. Turn off for your real projects."
                    checked={project.demo}
                    onChange={(v) => patch({ demo: v })}
                  />
                </div>
              </Section>

              <Section
                title="Tile in the Work grid"
                hint="How big this project is and what shape it takes. Vary these across projects so the grid reads as composed rather than as a wall of identical cards."
              >
                <Grid>
                  <Choice
                    label="Size"
                    value={project.tile?.span ?? 'md'}
                    options={TILE_SPANS}
                    onChange={(v) =>
                      patch({
                        tile: {
                          span: v as NonNullable<Project['tile']>['span'],
                          aspect: project.tile?.aspect ?? '4:3',
                        },
                      })
                    }
                  />
                  <Choice
                    label="Shape"
                    value={project.tile?.aspect ?? '4:3'}
                    options={TILE_ASPECTS}
                    onChange={(v) =>
                      patch({
                        tile: {
                          span: project.tile?.span ?? 'md',
                          aspect: v as NonNullable<Project['tile']>['aspect'],
                        },
                      })
                    }
                  />
                </Grid>

                {/*
                 * One icon editor, shared with folders and shortcuts. This used
                 * to be three loose text fields here — including a second tint
                 * input that duplicated the one in IconFields and could disagree
                 * with it.
                 */}
                <IconFields
                  icon={project.icon}
                  fallbackText={project.title}
                  onChange={(icon) => patch({ icon })}
                />

                <Advanced hint="The internal slug used in the #/project/… link, in search and wherever this project is referenced. Changing it breaks links people already have.">
                  <IdField
                    value={project.id}
                    onChange={(v) => {
                      patch({ id: v });
                      setSelected(v);
                    }}
                  />
                </Advanced>
              </Section>

              <Section
                title="Case study"
                hint="Leave a field empty to hide that section entirely."
              >
                {!project.caseStudy ? (
                  <Btn
                    variant="quiet"
                    size="sm"
                    icon={<Plus />}
                    onClick={() => patchCase({})}
                  >
                    Add a case study
                  </Btn>
                ) : (
                  <>
                    <Area
                      label="Context"
                      value={project.caseStudy.context}
                      onChange={(v) => patchCase({ context: v })}
                    />
                    <Area
                      label="Challenge"
                      value={project.caseStudy.challenge}
                      onChange={(v) => patchCase({ challenge: v })}
                    />
                    <Area
                      label="Objective"
                      value={project.caseStudy.objective}
                      onChange={(v) => patchCase({ objective: v })}
                    />
                    <Area
                      label="Approach"
                      value={project.caseStudy.approach}
                      onChange={(v) => patchCase({ approach: v })}
                    />
                    <Area
                      label="Execution"
                      value={project.caseStudy.execution}
                      onChange={(v) => patchCase({ execution: v })}
                    />
                    <Area
                      label="Results"
                      value={project.caseStudy.results}
                      onChange={(v) => patchCase({ results: v })}
                    />

                    <p className="mono studio-sub">Metrics</p>
                    <Repeater
                      items={project.caseStudy.metrics}
                      onChange={(metrics) => patchCase({ metrics })}
                      create={() => ({ label: 'Metric', value: '0' })}
                      labelOf={(metric) => `${metric.value} — ${metric.label}`}
                      addLabel="Add metric"
                      empty="No headline numbers. If you add invented ones, keep Demo content on."
                    >
                      {(metric, patchMetric) => (
                        <Grid cols={3}>
                          <Text
                            label="Value"
                            value={metric.value}
                            onChange={(v) => patchMetric({ value: v })}
                          />
                          <Text
                            label="Label"
                            value={metric.label}
                            onChange={(v) => patchMetric({ label: v })}
                          />
                          <Text
                            label="Note"
                            value={metric.note}
                            onChange={(v) => patchMetric({ note: v })}
                          />
                        </Grid>
                      )}
                    </Repeater>

                    <p className="mono studio-sub">Extra sections</p>
                    <Repeater
                      items={project.caseStudy.sections}
                      onChange={(sections) => patchCase({ sections })}
                      create={() => ({ label: 'Section', body: 'Body copy.' })}
                      labelOf={(section) => section.label}
                      addLabel="Add section"
                      empty="Anything the fixed fields above don't cover."
                    >
                      {(section, patchSection) => (
                        <>
                          <Text
                            label="Label"
                            value={section.label}
                            onChange={(v) => patchSection({ label: v })}
                          />
                          <Area
                            label="Body"
                            value={section.body}
                            onChange={(v) => patchSection({ body: v })}
                          />
                        </>
                      )}
                    </Repeater>
                  </>
                )}
              </Section>

              <Section
                title="Media"
                hint="Choose a media type first, then fill in the fields it asks for. A project with no media at all is completely valid — only add an item when you have something to show."
              >
                <Repeater
                  items={project.media}
                  onChange={(media) => patch(withHero(project, media))}
                  create={(): MediaItem => ({ id: uid('m'), type: 'image' })}
                  labelOf={(item) =>
                    `${item.type} — ${item.title ?? item.caption ?? item.alt ?? item.id}`
                  }
                  addLabel="Add media"
                  empty="No media yet — that is fine. Add one when you have a file or a link."
                >
                  {(item, patchMedia) => <MediaFields item={item} patch={patchMedia} />}
                </Repeater>
              </Section>

              <Section
                title="Project hero"
                hint="The single piece of media that opens the case study, above the writing. This is a different thing from the tile in the Work grid and from the media further down the page — one project can want a still on the grid, a Reel at the top, and neither of them repeated in the body."
              >
                <HeroPicker project={project} patch={patch} />
              </Section>

              <Section title="Links">
                <Repeater
                  items={project.links}
                  onChange={(links) => patch({ links })}
                  create={() => ({ label: 'Live site', url: 'https://', kind: 'website' as const })}
                  labelOf={(link) => link.label}
                  addLabel="Add link"
                  empty="External links shown at the end of the case study."
                >
                  {(link, patchLink) => (
                    <Grid cols={3}>
                      <Text
                        label="Label"
                        value={link.label}
                        onChange={(v) => patchLink({ label: v })}
                      />
                      <Text label="URL" value={link.url} mono onChange={(v) => patchLink({ url: v })} />
                      <Choice
                        label="Kind"
                        value={link.kind}
                        options={opts(LINK_KINDS)}
                        onChange={(v) => patchLink({ kind: v as (typeof LINK_KINDS)[number] })}
                      />
                    </Grid>
                  )}
                </Repeater>
              </Section>

              <Section title="Credits">
                <Repeater
                  items={project.credits}
                  onChange={(credits) => patch({ credits })}
                  create={() => ({ role: 'Role', name: 'Name' })}
                  labelOf={(credit) => `${credit.role} — ${credit.name}`}
                  addLabel="Add credit"
                  empty="Who else worked on this."
                >
                  {(credit, patchCredit) => (
                    <Grid>
                      <Text
                        label="Role"
                        value={credit.role}
                        onChange={(v) => patchCredit({ role: v })}
                      />
                      <Text
                        label="Name"
                        value={credit.name}
                        onChange={(v) => patchCredit({ name: v })}
                      />
                    </Grid>
                  )}
                </Repeater>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
