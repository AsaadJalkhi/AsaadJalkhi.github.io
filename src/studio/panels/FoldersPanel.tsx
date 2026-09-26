/**
 * Folders panel.
 *
 * A folder is a container: a company, a client, a category. Projects live
 * inside exactly one of them, and the desktop can point a shortcut at one.
 * Renaming a folder is always safe; changing its id is not, because projects
 * and shortcuts reference that id — the validator will say what broke.
 */
import { useState } from 'react';
import { disciplines, type Folder } from '@/types/content';
import type { PanelProps } from '../useDraft';
import { BannerSource } from './SourceField';
import {
  Advanced,
  Area,
  Choice,
  FoldBar,
  Grid,
  IconFields,
  IdField,
  Num,
  PanelHead,
  Repeater,
  Section,
  Text,
  opts,
  slugFromTitle,
  useFolds,
} from './parts';

/**
 * The optional masthead shown above the folder's project cards — banner, large
 * title, description — folded like the project editor's sections. Empty means
 * no intro at all: the folder opens straight onto its cards, as it always did.
 */
function FolderIntroFields({
  folder,
  patch,
}: {
  folder: Folder;
  patch: (changes: Partial<Folder>) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    [
      folder.introTitle?.trim() && 'Title',
      folder.description?.trim() && 'Description',
      folder.banner && (folder.banner.type === 'video' ? 'Video banner' : 'Image banner'),
    ]
      .filter(Boolean)
      .join(' · ') || 'None';

  return (
    <Section
      title="Folder intro"
      hint="Opens the folder like a case study opens a project: an optional banner, a large title and a description, above the project cards. Leave all three empty and the folder opens straight onto its cards."
      open={open}
      onToggle={() => setOpen((value) => !value)}
      summary={summary}
    >
      <Text
        label="Intro title"
        value={folder.introTitle}
        placeholder={folder.name}
        hint="Optional. Leave empty to use the folder name."
        onChange={(v) => patch({ introTitle: v || undefined })}
      />
      <Area
        label="Description"
        value={folder.description}
        hint="About the brand, company or body of work — not about the folder. Line breaks are kept."
        onChange={(v) => patch({ description: v || undefined })}
      />
      <BannerSource banner={folder.banner} onChange={(banner) => patch({ banner })} />
    </Section>
  );
}

export function FoldersPanel({ draft, update }: PanelProps) {
  // Which folder cards are open: UI state keyed by folder id, never content.
  // Collapsed on every visit to the panel, like the media cards.
  const folds = useFolds();

  const countFor = (folderId: string) =>
    draft.projects.filter((project) => project.folder === folderId).length;

  return (
    <div className="studio-panel">
      <PanelHead
        title="Folders"
        lede="The containers on the desktop and in the Projects window — a company, a client, a category. Every project belongs to exactly one folder."
      />

      {draft.folders.length > 0 && (
        <FoldBar
          folds={folds}
          ids={draft.folders.map((folder) => folder.id)}
          count={`${draft.folders.length} folder(s)`}
        />
      )}

      <Repeater
        items={draft.folders}
        onChange={(folders) =>
          update((next) => {
            next.folders = folders;
          })
        }
        create={(): Folder => {
          const id = slugFromTitle(
            draft.folders.map((folder) => folder.id),
            'New Folder',
            'folder',
          );
          return { id, name: 'New Folder' };
        }}
        labelOf={(folder) => `${folder.name} · ${countFor(folder.id)} project(s)`}
        addLabel="Add folder"
        fold={{ folds, id: (folder) => folder.id }}
      >
        {(folder, patch) => (
          <>
            <Grid>
              <Text
                label="Name"
                value={folder.name}
                hint="What visitors see"
                onChange={(v) => patch({ name: v })}
              />
              <Text
                label="Caption"
                value={folder.caption}
                hint="Short line under the name"
                onChange={(v) => patch({ caption: v })}
              />
              <Choice
                label="Discipline"
                value={folder.discipline}
                options={opts(disciplines)}
                placeholder="none"
                onChange={(v) => patch({ discipline: (v || undefined) as Folder['discipline'] })}
                hint="Drives the folder's accent colour"
              />
              <Num
                label="Order"
                value={folder.order}
                hint="Lower sorts first"
                onChange={(v) => patch({ order: v })}
              />
            </Grid>

            <IconFields
              icon={folder.icon}
              fallbackText={folder.name}
              onChange={(icon) => patch({ icon })}
            />

            <FolderIntroFields folder={folder} patch={patch} />

            <Advanced hint="Projects and desktop shortcuts reference this id. Change it and you must update them too — the validator will list anything that breaks.">
              <IdField
                value={folder.id}
                onChange={(v) => {
                  // Renaming the id from Advanced must not collapse the card being edited.
                  folds.rename(folder.id, v);
                  patch({ id: v });
                }}
              />
            </Advanced>
          </>
        )}
      </Repeater>
    </div>
  );
}
