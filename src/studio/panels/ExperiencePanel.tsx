/**
 * Experience panel — the work history shown in the Experience window and in
 * Quick View. Newest first is the convention; use the arrows to reorder.
 */
import { Toggle } from '@/components/ui/Ui';
import type { Experience } from '@/types/content';
import type { PanelProps } from '../useDraft';
import {
  Area,
  Choice,
  DisciplinePicker,
  FoldBar,
  Grid,
  Lines,
  PanelHead,
  Repeater,
  Text,
  uniqueSlug,
  useFolds,
} from './parts';

export function ExperiencePanel({ draft, update }: PanelProps) {
  const projectOptions = draft.projects.map((project) => ({
    value: project.id,
    label: project.title,
  }));

  // Which entries are open: UI state keyed by id, never content.
  const folds = useFolds();

  return (
    <div className="studio-panel">
      <PanelHead
        title="Experience"
        lede="Roles, in the order they should appear. Linking a project adds a “see the work” action."
      />

      {draft.experience.length > 0 && (
        <FoldBar
          folds={folds}
          ids={draft.experience.map((item) => item.id)}
          count={`${draft.experience.length} role(s)`}
        />
      )}

      <Repeater
        items={draft.experience}
        onChange={(experience) =>
          update((next) => {
            next.experience = experience;
          })
        }
        create={(): Experience => ({
          id: uniqueSlug(
            draft.experience.map((item) => item.id),
            'new-role',
          ),
          company: 'Company',
          role: 'Role',
          period: '2026 — Present',
          highlights: [],
          disciplines: [],
          current: false,
        })}
        labelOf={(item) => `${item.role} · ${item.company}`}
        addLabel="Add role"
        fold={{ folds, id: (item) => item.id }}
      >
        {(item, patch) => (
          <>
            <Grid>
              <Text label="Company" value={item.company} onChange={(v) => patch({ company: v })} />
              <Text label="Role" value={item.role} onChange={(v) => patch({ role: v })} />
              <Text
                label="Period"
                value={item.period}
                hint="e.g. 2024 — Present"
                onChange={(v) => patch({ period: v })}
              />
              <Text
                label="Location"
                value={item.location}
                onChange={(v) => patch({ location: v })}
              />
              <Text
                label="ID"
                value={item.id}
                mono
                onChange={(v) => {
                  // Editing the id must not collapse the card being edited.
                  folds.rename(item.id, v);
                  patch({ id: v });
                }}
              />
              <Choice
                label="Linked project"
                value={item.projectId}
                options={projectOptions}
                placeholder="none"
                onChange={(v) => patch({ projectId: v || undefined })}
              />
            </Grid>

            <Area
              label="Summary"
              value={item.summary}
              rows={3}
              onChange={(v) => patch({ summary: v })}
            />
            <Lines
              label="Highlights"
              value={item.highlights}
              rows={5}
              hint="One achievement per line"
              onChange={(v) => patch({ highlights: v })}
            />

            <DisciplinePicker
              value={item.disciplines}
              onChange={(v) => patch({ disciplines: v })}
            />

            <div className="studio-toggles">
              <Toggle
                label="Current role"
                checked={item.current}
                onChange={(v) => patch({ current: v })}
              />
            </div>
          </>
        )}
      </Repeater>
    </div>
  );
}
