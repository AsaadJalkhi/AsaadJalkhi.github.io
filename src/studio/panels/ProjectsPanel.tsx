/**
 * Projects panel — the main editing surface.
 *
 * The list on the left is grouped by folder (folder.order), each folder's
 * projects in their visible order, reordered by grip or arrows. A second mode
 * lists only the featured projects, in Quick View order. Both write through
 * `lib/projectOrder` — the same definitions Work and Quick View read — and
 * never reorder the `projects[]` array itself.
 *
 * The full editor is on the right: metadata, case study, media, links and
 * credits. Each top-level section is collapsed until opened, with a one-line
 * summary, and Preview draws the unsaved draft with the live renderers (see
 * ProjectPreview).
 */
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, FolderTree, Plus, Star, Trash2 } from 'lucide-react';
import { Btn, Empty, Toggle } from '@/components/ui/Ui';
import type { CaseStudy, MediaItem, Project } from '@/types/content';
import { cx, uid } from '@/lib/utils';
import {
  appendToFolder,
  moveInFolder,
  moveInQuickView,
  moveToFolder,
  orderedFolders,
  orderedProjectsInFolder,
  orderedQuickViewProjects,
  placeAfter,
  renumberFolder,
  setFeatured,
} from '@/lib/projectOrder';
import type { PanelProps } from '../useDraft';
import { MediaFields } from './MediaFields';
import { MediaList } from './MediaList';
import { ProjectOrderList } from './ProjectOrderList';
import { ProjectPreview } from './ProjectPreview';
import { BannerSource, SourceField } from './SourceField';
import {
  Advanced,
  Collapsible,
  IdField,
  Area,
  Choice,
  DisciplinePicker,
  FoldBar,
  Grid,
  IconBtn,
  IconFields,
  Lines,
  PanelHead,
  Repeater,
  Section,
  Tags,
  slugFromTitle,
  Text,
  opts,
  uniqueSlug,
  useFolds,
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
 * The banner editor.
 *
 * Not a picker any more. The old control asked you to choose one of the
 * project's media items to act as the lead visual, which meant you could not
 * have a lead visual unless it was also a piece of work in the list, and you
 * could not have a piece of work in the list without deciding whether it was
 * also the lead visual. Those are two questions and they now have two answers:
 * `project.banner` is its own field with its own file, and the media list below
 * is just the work.
 *
 * Local only, and image or video only. A banner is cropped to a fixed shallow
 * band — an Instagram embed, a YouTube player or a PDF cannot be cropped to a
 * band, so offering them would be offering something that cannot work.
 */
function BannerFields({
  project,
  patch,
}: {
  project: Project;
  patch: (changes: Partial<Project>) => void;
}) {
  const banner = project.banner;

  /*
   * The old hero, if this project still has one and has not been converted.
   *
   * It is still rendering — `resolveBanner` falls back to it, so nothing went
   * blank when the field changed — and it is converted only when asked. A
   * migration that runs on its own, over content someone spent a long time on,
   * while they are looking at a different panel, is exactly the kind of thing
   * that cost this project a portfolio once already.
   */
  const legacy = project.heroMediaId
    ? project.media.find((item) => item.id === project.heroMediaId)
    : undefined;
  const convertible =
    legacy && (legacy.type === 'image' || legacy.type === 'video') && (legacy.src ?? legacy.url);

  const adopt = () => {
    if (!legacy || !convertible) return;
    patch({
      banner: { type: legacy.type as 'image' | 'video', src: convertible, alt: legacy.alt },
      heroMediaId: undefined,
      showHeroInMedia: undefined,
    });
  };

  return (
    <>
      {!banner && legacy && (
        <div className="studio-note">
          <p>
            This project still uses the old <span className="mono">Project hero</span> —{' '}
            <strong>{legacy.caption ?? legacy.alt ?? legacy.id}</strong>. It is still being shown at
            the top of the case study, so nothing is broken and nothing has been changed.
          </p>
          {convertible ? (
            <Btn size="sm" variant="outline" onClick={adopt}>
              Use it as the banner
            </Btn>
          ) : (
            <p className="studio-hint">
              It is not a local image or video, so it cannot become a banner. Set a banner file
              below and the old hero goes back to being an ordinary media item.
            </p>
          )}
        </div>
      )}

      <BannerSource banner={banner} onChange={(next) => patch({ banner: next })} />
    </>
  );
}

/** The collapsible top-level sections of the project editor, in page order. */
const FOLDS = ['identity', 'tile', 'case', 'media', 'banner', 'links', 'credits'] as const;
type Fold = (typeof FOLDS)[number];

const SPAN_SHORT: Record<string, string> = { sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' };

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The one-line digest beside each collapsed section title. Short values only —
 * counts and names, never a URL or a paragraph; CSS truncates what is left.
 */
function foldSummaries(project: Project): Record<Fold, string> {
  const cs = project.caseStudy;
  const written = cs
    ? [cs.context, cs.challenge, cs.objective, cs.approach, cs.execution, cs.results].filter(
        (text) => text?.trim(),
      ).length
    : 0;
  const banner = project.banner
    ? project.banner.type === 'video'
      ? 'Video'
      : 'Image'
    : project.heroMediaId
      ? 'Legacy hero'
      : 'None';

  return {
    identity: [project.title, project.company, project.year].filter(Boolean).join(' · '),
    tile: `${SPAN_SHORT[project.tile?.span ?? 'md']} · ${project.tile?.aspect ?? '4:3'}`,
    case: cs
      ? [count(written, 'field'), count(cs.metrics.length, 'metric'), count(cs.sections.length, 'section')].join(
          ' · ',
        )
      : 'None',
    media: count(project.media.length, 'item'),
    banner,
    links: count(project.links.length, 'link'),
    credits: count(project.credits.length, 'credit'),
  };
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

/** The sidebar: folders and their projects, or the Quick View sequence. */
type ListMode = 'folder' | 'quick';

export function ProjectsPanel({ draft, update }: PanelProps) {
  const [selected, setSelected] = useState<string | null>(draft.projects[0]?.id ?? null);
  const [mode, setMode] = useState<ListMode>('folder');
  /** Which folder groups are open in the sidebar, by folder id. UI state only. */
  const groups = useFolds();
  /*
   * Which sections are open, and whether the preview is. UI state only — never
   * in the draft. Folds are reset when a *different project* is chosen (see
   * `choose`), not whenever the id changes: typing a new project's title
   * renames its id, and collapsing Identity under the cursor would be absurd.
   */
  const folds = useFolds<Fold>();
  const [previewing, setPreviewing] = useState(false);

  const index = draft.projects.findIndex((project) => project.id === selected);
  const project = index >= 0 ? draft.projects[index] : draft.projects[0];
  const activeIndex = project ? draft.projects.findIndex((p) => p.id === project.id) : -1;

  const choose = (id: string | null, open: Fold[] = []) => {
    setSelected(id);
    folds.set(open);
  };

  /*
   * The sidebar groups. Folders by folder.order; a folder id no folder has
   * (hand-edited JSON) still gets a group, so its projects stay reachable.
   */
  const known = new Set(draft.folders.map((folder) => folder.id));
  const groupList = [
    ...orderedFolders(draft.folders).map((folder) => ({ id: folder.id, name: folder.name })),
    ...[...new Set(draft.projects.map((p) => p.folder))]
      .filter((id) => !known.has(id))
      .map((id) => ({ id, name: `Unknown folder · ${id}` })),
  ];
  const folderName = (id: string) => draft.folders.find((folder) => folder.id === id)?.name ?? id;
  const quickView = orderedQuickViewProjects(draft.projects);

  // The selected project's folder starts open, so the list shows where you are.
  useEffect(() => {
    if (project) groups.reveal(project.folder);
    // Mount only: afterwards the groups are the user's to open and close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Where the selected project sits in its folder's visible order. */
  const siblings = project ? orderedProjectsInFolder(draft.projects, project.folder) : [];
  const position = project ? siblings.findIndex((p) => p.id === project.id) : -1;

  /** The one folder reorder — sidebar drag, sidebar arrows and header arrows. */
  const moveWithin = (folderId: string) => (from: number, to: number) =>
    update((next) => {
      moveInFolder(next.projects, folderId, from, to);
    });

  /** The one Quick View reorder. Touches `quickViewOrder` only. */
  const moveQuick = (from: number, to: number) =>
    update((next) => {
      moveInQuickView(next.projects, from, to);
    });

  const select = (id: string) => {
    if (id !== project?.id) choose(id);
  };

  /** Props for one collapsible section. */
  const summaries = project ? foldSummaries(project) : undefined;
  const fold = (id: Fold) => folds.props(id, summaries?.[id]);

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
    const folder = draft.folders[0]?.id ?? 'web';
    update((next) => {
      const created = blankProject(id, folder);
      next.projects.push(created);
      appendToFolder(next.projects, created);
    });
    // A new project is empty, so it opens on the section that needs filling in.
    choose(id, ['identity']);
    groups.reveal(folder);
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
      // Right after the original in its folder's visible order, not wherever the array put it.
      placeAfter(next.projects, clone, source);
    });
    choose(id);
  };

  const deleteProject = () => {
    if (!project) return;
    const fallback = draft.projects.find((p) => p.id !== project.id)?.id ?? null;
    update((next) => {
      next.projects = next.projects.filter((p) => p.id !== project.id);
      renumberFolder(next.projects, project.folder);
    });
    choose(fallback);
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

          <div className="studio-media__view studio-list__mode" role="group" aria-label="Organise projects">
            <button
              type="button"
              className={cx('studio-media__view-btn', mode === 'folder' && 'is-on')}
              aria-pressed={mode === 'folder'}
              onClick={() => setMode('folder')}
            >
              <FolderTree strokeWidth={1.5} /> By folder
            </button>
            <button
              type="button"
              className={cx('studio-media__view-btn', mode === 'quick' && 'is-on')}
              aria-pressed={mode === 'quick'}
              onClick={() => setMode('quick')}
            >
              <Star strokeWidth={1.5} /> Quick View
            </button>
          </div>

          <div className="studio-list__scroll">
            {mode === 'folder' ? (
              <>
                <FoldBar folds={groups} ids={groupList.map((group) => group.id)} />
                {groupList.map((group) => {
                  const items = orderedProjectsInFolder(draft.projects, group.id);
                  return (
                    <Collapsible
                      key={group.id}
                      title={group.name}
                      summary={count(items.length, 'project')}
                      open={groups.isOpen(group.id)}
                      onToggle={() => groups.toggle(group.id)}
                    >
                      {items.length ? (
                        <ProjectOrderList
                          projects={items}
                          selectedId={project?.id}
                          onSelect={select}
                          onMove={moveWithin(group.id)}
                          meta={(p) => [p.year, p.demo && 'demo'].filter(Boolean).join(' · ')}
                          what="in this folder"
                        />
                      ) : (
                        <p className="studio-rep__empty">No projects in this folder.</p>
                      )}
                    </Collapsible>
                  );
                })}
              </>
            ) : quickView.length ? (
              <ProjectOrderList
                projects={quickView}
                selectedId={project?.id}
                onSelect={select}
                onMove={moveQuick}
                meta={(p) => [folderName(p.folder), p.year].filter(Boolean).join(' · ')}
                what="in Quick View"
              />
            ) : (
              <p className="studio-rep__empty">
                Nothing in Quick View yet. Turn on Show in Quick View in a project's Identity.
              </p>
            )}
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
                    label="Move up in folder"
                    disabled={position <= 0}
                    onClick={() => moveWithin(project.folder)(position, position - 1)}
                  >
                    <ArrowUp strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn
                    label="Move down in folder"
                    disabled={position < 0 || position >= siblings.length - 1}
                    onClick={() => moveWithin(project.folder)(position, position + 1)}
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

              <FoldBar folds={folds} ids={FOLDS}>
                <Btn size="sm" variant="outline" icon={<Eye />} onClick={() => setPreviewing(true)}>
                  Preview
                </Btn>
              </FoldBar>

              {/* Mounted only while open, so no preview media loads behind the editor. */}
              {previewing && (
                <ProjectPreview
                  draft={draft}
                  projectId={project.id}
                  onClose={() => setPreviewing(false)}
                />
              )}

              <Section title="Identity" {...fold('identity')}>
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
                    hint={`Position #${String(position + 1).padStart(2, '0')} of ${siblings.length} — reorder in the list`}
                    onChange={(v) => {
                      // Leaves the old folder renumbered and lands last in the new one.
                      update((next) => {
                        const target = next.projects[activeIndex];
                        if (target) moveToFolder(next.projects, target, v);
                      });
                      groups.reveal(v);
                    }}
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
                </Grid>

                {/* Same source field as media and banners, so "Copy as path" is cleaned the same way. */}
                <SourceField
                  label="Thumbnail"
                  value={project.thumbnail}
                  placeholder="media/gaf/thumbnail.jpg"
                  hint="The card image in the Work grid. Falls back to the first media item."
                  onChange={(v) => patch({ thumbnail: v })}
                />

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
                    label="Show in Quick View"
                    hint="Adds it last in Quick View → Selected Work. Order it under Projects → Quick View. Does not change Work order."
                    checked={project.featured}
                    onChange={(v) =>
                      update((next) => {
                        const target = next.projects[activeIndex];
                        if (target) setFeatured(next.projects, target, v);
                      })
                    }
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
                {...fold('tile')}
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
                {...fold('case')}
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
                {...fold('media')}
              >
                {/* Keyed by project, so opening another project starts with every card collapsed. */}
                <MediaList
                  key={project.id}
                  items={project.media}
                  onChange={(media) => patch(withHero(project, media))}
                  create={(): MediaItem => ({ id: uid('m'), type: 'image' })}
                >
                  {(item, patchMedia) => <MediaFields item={item} patch={patchMedia} />}
                </MediaList>
              </Section>

              <Section
                title="Project banner"
                hint="The wide strip that opens the case study. Its own file — an image or a silent looping video from public/ — not one of the media items below. Every project's banner is the same height, so any shape of file is fine; it is cropped to fit. 1920 × 700 is what the band was designed around. Leave it as None and the case study opens on its title, with no empty space."
                {...fold('banner')}
              >
                <BannerFields project={project} patch={patch} />
              </Section>

              <Section title="Links" {...fold('links')}>
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

              <Section title="Credits" {...fold('credits')}>
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
