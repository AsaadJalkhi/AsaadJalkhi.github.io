/**
 * Capabilities panel.
 *
 * Deliberately grouped lists, not percentage bars — "Photoshop 95%" tells a
 * recruiter nothing. Each group belongs to one discipline, which colours it.
 */
import { disciplines, type SkillGroup } from '@/types/content';
import type { PanelProps } from '../useDraft';
import {
  Choice,
  FoldBar,
  Grid,
  Lines,
  PanelHead,
  Repeater,
  Text,
  opts,
  uniqueSlug,
  useFolds,
} from './parts';

export function SkillsPanel({ draft, update }: PanelProps) {
  // Which entries are open: UI state keyed by id, never content.
  const folds = useFolds();

  return (
    <div className="studio-panel">
      <PanelHead
        title="Capabilities"
        lede="Grouped by discipline. Keep each group to the things you would actually be hired for."
      />

      {draft.skills.length > 0 && (
        <FoldBar
          folds={folds}
          ids={draft.skills.map((group) => group.id)}
          count={`${draft.skills.length} group(s)`}
        />
      )}

      <Repeater
        items={draft.skills}
        onChange={(skills) =>
          update((next) => {
            next.skills = skills;
          })
        }
        create={(): SkillGroup => ({
          id: uniqueSlug(
            draft.skills.map((group) => group.id),
            'new-group',
          ),
          title: 'New Group',
          discipline: 'marketing',
          items: ['First capability'],
        })}
        labelOf={(group) => `${group.title} · ${group.items.length} item(s)`}
        addLabel="Add group"
        fold={{ folds, id: (group) => group.id }}
      >
        {(group, patch) => (
          <>
            <Grid cols={3}>
              <Text label="Title" value={group.title} onChange={(v) => patch({ title: v })} />
              <Choice
                label="Discipline"
                value={group.discipline}
                options={opts(disciplines)}
                onChange={(v) => patch({ discipline: v as SkillGroup['discipline'] })}
              />
              <Text
                label="ID"
                value={group.id}
                mono
                onChange={(v) => {
                  folds.rename(group.id, v);
                  patch({ id: v });
                }}
              />
            </Grid>

            <Text
              label="Caption"
              value={group.caption}
              wide
              onChange={(v) => patch({ caption: v })}
            />

            <Lines
              label="Capabilities"
              value={group.items}
              rows={7}
              hint="One per line — at least one is required"
              onChange={(v) => patch({ items: v })}
            />
          </>
        )}
      </Repeater>
    </div>
  );
}
