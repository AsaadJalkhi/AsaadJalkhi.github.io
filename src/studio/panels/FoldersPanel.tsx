/**
 * Folders panel.
 *
 * A folder is a container: a company, a client, a category. Projects live
 * inside exactly one of them, and the desktop can point a shortcut at one.
 * Renaming a folder is always safe; changing its id is not, because projects
 * and shortcuts reference that id — the validator will say what broke.
 */
import { disciplines, type Folder } from '@/types/content';
import type { PanelProps } from '../useDraft';
import {
  Advanced,
  Choice,
  Grid,
  IconFields,
  IdField,
  Num,
  PanelHead,
  Repeater,
  Text,
  opts,
  slugFromTitle,
} from './parts';

export function FoldersPanel({ draft, update }: PanelProps) {
  const countFor = (folderId: string) =>
    draft.projects.filter((project) => project.folder === folderId).length;

  return (
    <div className="studio-panel">
      <PanelHead
        title="Folders"
        lede="The containers on the desktop and in the Projects window — a company, a client, a category. Every project belongs to exactly one folder."
      />

      <Repeater
        items={draft.folders}
        onChange={(folders) =>
          update((next) => {
            next.folders = folders;
          })
        }
        create={(): Folder => ({
          id: slugFromTitle(
            draft.folders.map((folder) => folder.id),
            'New Folder',
            'folder',
          ),
          name: 'New Folder',
        })}
        labelOf={(folder) => `${folder.name} · ${countFor(folder.id)} project(s)`}
        addLabel="Add folder"
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

            <Advanced hint="Projects and desktop shortcuts reference this id. Change it and you must update them too — the validator will list anything that breaks.">
              <IdField value={folder.id} onChange={(v) => patch({ id: v })} />
            </Advanced>
          </>
        )}
      </Repeater>
    </div>
  );
}
