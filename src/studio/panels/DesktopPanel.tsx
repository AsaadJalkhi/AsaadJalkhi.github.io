/**
 * Desktop panel — everything that lives on the desktop surface.
 *
 * Five groups, in the order you would actually build a desktop: the shortcuts,
 * the widgets, the external links in the dock, the joke alerts those shortcuts
 * can open, the windows that are already open at launch, and the notes.
 *
 * Positions are deliberately absent from the normal flow. The desktop places
 * new items itself (a seeded scatter — see hooks/useDesktopLayout), and anyone
 * can drag them where they want at runtime. Typing percentages is an override,
 * not a workflow, so it lives under Advanced.
 */
import { disciplines, type SystemAlert, type DesktopItem, type DockLink, type Note, type Widget } from '@/types/content';
import { APP_IDS } from '@/state/os';
import type { PanelProps } from '../useDraft';
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
  uniqueSlug,
  useFolds,
} from './parts';

/** The collapsible sections of this tab, in page order. */
const FOLDS = ['shortcuts', 'widgets', 'dock', 'alerts', 'launch', 'notes'] as const;
type Fold = (typeof FOLDS)[number];

/** Mirrors the enums in types/content.ts. */
const ICON_KINDS = [
  'folder',
  'document',
  'note',
  'video',
  'image',
  'link',
  'pdf',
  'app',
  'design',
] as const;

const TARGET_TYPES: Array<{ value: DesktopItem['target']['type']; label: string }> = [
  { value: 'folder', label: 'A folder' },
  { value: 'project', label: 'A project' },
  { value: 'note', label: 'A note' },
  { value: 'app', label: 'An app window' },
  { value: 'media', label: 'One media file' },
  { value: 'url', label: 'A page inside the browser window' },
  { value: 'external', label: 'An external site (new tab)' },
  { value: 'alert', label: 'A system alert (the jokes)' },
];

const ZONES: Array<{ value: string; label: string }> = [
  { value: 'any', label: 'Anywhere' },
  { value: 'left', label: 'Left side' },
  { value: 'right', label: 'Right side' },
];

const LINK_ICONS = ['mail', 'instagram', 'linkedin', 'github', 'link'] as const;
const TONES = ['info', 'caution', 'error'] as const;
const NOTE_TONES = ['plain', 'accent', 'easter-egg'] as const;

export function DesktopPanel({ draft, update }: PanelProps) {
  /*
   * These four run BEFORE any section, so unlike everything below them they sit
   * outside the per-section error boundaries: a throw here takes the entire tab,
   * not one section. This panel is the only one that builds dropdowns out of
   * *other* collections, which is why it is the only one exposed that way.
   *
   * The schema gives all four a default of `[]`, so a validated portfolio always
   * has them — but the Studio renders the live draft before validating it (you
   * cannot fix a value you cannot see), and a draft can hold a shape the schema
   * would reject. `?? []` costs nothing and hides nothing: these are lists of
   * choices, and an absent collection genuinely offers no choices. The items
   * themselves are edited in their own sections, which report their own problems.
   */
  const list = <T,>(value: T[] | undefined): T[] => (Array.isArray(value) ? value : []);

  const folderOptions = list(draft.folders).map((f) => ({ value: f.id, label: f.name }));
  const projectOptions = list(draft.projects).map((p) => ({ value: p.id, label: p.title }));
  const noteOptions = list(draft.notes).map((n) => ({ value: n.id, label: n.title }));
  const alertOptions = list(draft.alerts).map((a) => ({
    value: a.id,
    label: `${a.app} — ${a.title}`,
  }));
  const appOptions = opts(APP_IDS);

  // Which sections are open: UI state only, never content.
  const folds = useFolds<Fold>();
  const summary: Record<Fold, string> = {
    shortcuts: `${list(draft.desktop.items).length} item(s)`,
    widgets: `${list(draft.desktop.widgets).length} widget(s)`,
    dock: `${list(draft.desktop.dockLinks).length} link(s)`,
    alerts: `${list(draft.alerts).length} alert(s)`,
    launch: `${list(draft.desktop.autoOpen).length} window(s)`,
    notes: `${list(draft.notes).length} note(s)`,
  };

  /** The value field changes shape with the target type. */
  const targetOptionsFor = (type: DesktopItem['target']['type']) => {
    if (type === 'folder') return folderOptions;
    if (type === 'project') return projectOptions;
    if (type === 'note') return noteOptions;
    if (type === 'app') return appOptions;
    if (type === 'alert') return alertOptions;
    return null; // url, external and media are free text
  };

  const targetHintFor = (type: DesktopItem['target']['type']) => {
    if (type === 'external') return 'Full URL, e.g. https://instagram.com/…';
    if (type === 'url') return 'Full URL — opens in the in-site browser window';
    return 'projectId:mediaId';
  };

  return (
    <div className="studio-panel">
      <PanelHead
        title="Desktop"
        lede="What a visitor sees first: shortcuts, widgets, the dock's external links, and the windows that open at launch. Positions are handled for you — drag anything on the desktop itself to move it."
      />

      <FoldBar folds={folds} ids={FOLDS} />

      <Section
        title="Desktop apps & shortcuts"
        {...folds.props('shortcuts', summary.shortcuts)}
        hint="Every icon on the desktop — folders, projects, notes, files and the creative-app jokes. Each one opens something; pointing at an item that doesn't exist is caught by the validator before you can export."
      >
        <Repeater
          items={draft.desktop.items}
          onChange={(items) =>
            update((next) => {
              next.desktop.items = items;
            })
          }
          create={(): DesktopItem => ({
            id: uniqueSlug(
              draft.desktop.items.map((item) => item.id),
              'new-shortcut',
            ),
            label: 'New shortcut',
            kind: 'document',
            target: { type: 'folder', value: draft.folders[0]?.id ?? 'web' },
            zone: 'any',
            rotate: 0,
          })}
          labelOf={(item) => `${item.label} → ${item.target.type}:${item.target.value}`}
          addLabel="Add shortcut"
        >
          {(item, patch) => {
            const options = targetOptionsFor(item.target.type);
            return (
              <>
                <Grid>
                  <Text
                    label="Label"
                    value={item.label}
                    hint="What appears under the icon"
                    onChange={(v) => patch({ label: v })}
                  />
                  <Choice
                    label="Opens"
                    value={item.target.type}
                    options={TARGET_TYPES}
                    onChange={(v) => {
                      const type = v as DesktopItem['target']['type'];
                      const first = targetOptionsFor(type)?.[0]?.value ?? '';
                      patch({ target: { type, value: first } as DesktopItem['target'] });
                    }}
                  />
                  {options ? (
                    <Choice
                      label="Target"
                      value={item.target.value}
                      options={options}
                      onChange={(v) =>
                        patch({ target: { ...item.target, value: v } as DesktopItem['target'] })
                      }
                    />
                  ) : (
                    <Text
                      label="Target"
                      value={item.target.value}
                      mono
                      hint={targetHintFor(item.target.type)}
                      onChange={(v) =>
                        patch({ target: { ...item.target, value: v } as DesktopItem['target'] })
                      }
                    />
                  )}
                  <Choice
                    label="Side of the screen"
                    value={item.zone}
                    options={ZONES}
                    hint="Keeps the middle clear for windows"
                    onChange={(v) => patch({ zone: v as DesktopItem['zone'] })}
                  />
                </Grid>

                <IconFields
                  icon={item.icon}
                  fallbackText={item.label}
                  onChange={(icon) => patch({ icon })}
                />

                <Grid cols={3}>
                  <Choice
                    label="Icon style"
                    value={item.kind}
                    options={opts(ICON_KINDS)}
                    hint="The default glyph, used when there's no custom artwork"
                    onChange={(v) => patch({ kind: v as DesktopItem['kind'] })}
                  />
                  <Text
                    label="Badge"
                    value={item.badge}
                    hint="Tiny label on the corner"
                    onChange={(v) => patch({ badge: v })}
                  />
                  <Choice
                    label="Accent"
                    value={item.accent}
                    options={opts(disciplines)}
                    placeholder="default"
                    onChange={(v) => patch({ accent: (v || undefined) as DesktopItem['accent'] })}
                  />
                </Grid>

                <Advanced hint="Leave these empty and the desktop arranges the icon for you. Dragging it on the desktop always wins over both.">
                  <Grid cols={3}>
                    <Num
                      label="X (%)"
                      value={item.x}
                      min={0}
                      max={100}
                      onChange={(v) => patch({ x: v })}
                    />
                    <Num
                      label="Y (%)"
                      value={item.y}
                      min={0}
                      max={100}
                      onChange={(v) => patch({ y: v })}
                    />
                    <Num
                      label="Rotate (°)"
                      value={item.rotate}
                      min={-12}
                      max={12}
                      onChange={(v) => patch({ rotate: v ?? 0 })}
                    />
                  </Grid>
                  <IdField value={item.id} onChange={(v) => patch({ id: v })} />
                </Advanced>
              </>
            );
          }}
        </Repeater>
      </Section>

      <Section
        title="Widgets"
        {...folds.props('widgets', summary.widgets)}
        hint="Small panels on the desktop: a clock, a short note in your own voice, or the reaction-time test. Two is plenty."
      >
        <Repeater
          items={draft.desktop.widgets}
          onChange={(widgets) =>
            update((next) => {
              next.desktop.widgets = widgets;
            })
          }
          create={(): Widget => ({
            id: uniqueSlug(
              draft.desktop.widgets.map((w) => w.id),
              'new-widget',
            ),
            type: 'note',
            title: 'Currently',
            body: 'Write one line.',
            zone: 'any',
          })}
          labelOf={(widget) => `${widget.type} · ${widget.title ?? 'untitled'}`}
          addLabel="Add widget"
          empty="No widgets — the desktop shows only shortcuts."
        >
          {(widget, patch) => (
            <>
              <Grid cols={3}>
                <Choice
                  label="Type"
                  value={widget.type}
                  options={[
                    { value: 'clock', label: 'Clock & date' },
                    { value: 'note', label: 'Sticky note' },
                    { value: 'reaction', label: 'Reaction time test' },
                  ]}
                  onChange={(v) => patch({ type: v as Widget['type'] })}
                />
                <Text
                  label="Title"
                  value={widget.title}
                  hint={widget.type === 'note' ? 'Small heading' : 'Label above the widget'}
                  onChange={(v) => patch({ title: v })}
                />
                <Choice
                  label="Side of the screen"
                  value={widget.zone}
                  options={ZONES}
                  onChange={(v) => patch({ zone: v as Widget['zone'] })}
                />
              </Grid>

              {widget.type === 'note' && (
                <Area
                  label="Body"
                  value={widget.body}
                  rows={3}
                  hint="Keep it to a sentence or two"
                  onChange={(v) => patch({ body: v })}
                />
              )}

              <Advanced hint="Left empty, the desktop places the widget itself.">
                <Grid cols={3}>
                  <Num label="X (%)" value={widget.x} min={0} max={100} onChange={(v) => patch({ x: v })} />
                  <Num label="Y (%)" value={widget.y} min={0} max={100} onChange={(v) => patch({ y: v })} />
                </Grid>
                <IdField value={widget.id} onChange={(v) => patch({ id: v })} />
              </Advanced>
            </>
          )}
        </Repeater>
      </Section>

      <Section
        title="Dock links"
        {...folds.props('dock', summary.dock)}
        hint="Email and social shortcuts pinned to the right of the dock. These leave the site and open in a new tab."
      >
        <Repeater
          items={draft.desktop.dockLinks}
          onChange={(dockLinks) =>
            update((next) => {
              next.desktop.dockLinks = dockLinks;
            })
          }
          create={(): DockLink => ({
            id: uniqueSlug(
              draft.desktop.dockLinks.map((l) => l.id),
              'new-link',
            ),
            label: 'LinkedIn',
            url: 'https://',
            icon: 'linkedin',
          })}
          labelOf={(link) => `${link.label} → ${link.url}`}
          addLabel="Add dock link"
          empty="No external shortcuts in the dock."
        >
          {(link, patch) => (
            <>
              <Grid cols={3}>
                <Text label="Label" value={link.label} onChange={(v) => patch({ label: v })} />
                <Choice
                  label="Icon"
                  value={link.icon}
                  options={opts(LINK_ICONS)}
                  onChange={(v) => patch({ icon: v as DockLink['icon'] })}
                />
                <Text
                  label="URL"
                  value={link.url}
                  mono
                  hint="mailto: works too"
                  onChange={(v) => patch({ url: v })}
                />
              </Grid>
              <Advanced>
                <IdField value={link.id} onChange={(v) => patch({ id: v })} />
              </Advanced>
            </>
          )}
        </Repeater>
      </Section>

      <Section
        title="System alerts"
        {...folds.props('alerts', summary.alerts)}
        hint="The joke dialogs behind the Photoshop / After Effects / Blender / VS Code icons. Point a shortcut at one by setting its “Opens” to “A system alert”."
      >
        <Repeater
          items={draft.alerts}
          onChange={(alerts) =>
            update((next) => {
              next.alerts = alerts;
            })
          }
          create={(): SystemAlert => ({
            id: uniqueSlug(
              draft.alerts.map((a) => a.id),
              'new-alert',
            ),
            app: 'Application',
            title: 'Not installed.',
            body: 'Write one witty line here.',
            tone: 'info',
            buttons: [{ label: 'OK', primary: true }],
          })}
          labelOf={(alert) => `${alert.app} — ${alert.title}`}
          addLabel="Add alert"
          empty="No alerts configured."
        >
          {(alert, patch) => (
            <>
              <Grid cols={3}>
                <Text
                  label="App name"
                  value={alert.app}
                  hint="Shown in the window's title bar"
                  onChange={(v) =>
                    patch({
                      app: v,
                      id: slugFromTitle(
                        draft.alerts.filter((a) => a.id !== alert.id).map((a) => a.id),
                        v,
                        'alert',
                      ),
                    })
                  }
                />
                <Text label="Title" value={alert.title} onChange={(v) => patch({ title: v })} />
                <Choice
                  label="Tone"
                  value={alert.tone}
                  options={opts(TONES)}
                  hint="Changes the icon and its colour"
                  onChange={(v) => patch({ tone: v as SystemAlert['tone'] })}
                />
              </Grid>

              <Area
                label="Message"
                value={alert.body}
                rows={2}
                hint="One or two lines. Short is funnier."
                onChange={(v) => patch({ body: v })}
              />

              <Repeater
                items={alert.buttons}
                onChange={(buttons) => patch({ buttons })}
                create={() => ({ label: 'OK', primary: false })}
                labelOf={(button) => button.label}
                addLabel="Add button (max 2)"
                empty="No buttons — an OK button is added automatically."
              >
                {(button, patchButton) => (
                  <Grid>
                    <Text
                      label="Button label"
                      value={button.label}
                      onChange={(v) => patchButton({ label: v })}
                    />
                    <Choice
                      label="Style"
                      value={button.primary ? 'primary' : 'secondary'}
                      options={[
                        { value: 'primary', label: 'Filled' },
                        { value: 'secondary', label: 'Outline' },
                      ]}
                      onChange={(v) => patchButton({ primary: v === 'primary' })}
                    />
                  </Grid>
                )}
              </Repeater>

              <Advanced>
                <IdField value={alert.id} onChange={(v) => patch({ id: v })} />
              </Advanced>
            </>
          )}
        </Repeater>
      </Section>

      <Section
        title="Windows open at launch"
        {...folds.props('launch', summary.launch)}
        hint="Keep this to two or three. X/Y/width/height are pixels; values between 0 and 1 are treated as a share of the viewport."
      >
        <Repeater
          items={draft.desktop.autoOpen}
          onChange={(autoOpen) =>
            update((next) => {
              next.desktop.autoOpen = autoOpen;
            })
          }
          create={() => ({
            app: 'projects',
            x: 0.2,
            y: 0.2,
            width: 720,
            height: 480,
            order: 0,
          })}
          labelOf={(item) => `${item.app}${item.payloadId ? ` · ${item.payloadId}` : ''}`}
          addLabel="Open another window at launch"
          empty="The desktop will load with no windows open."
        >
          {(item, patch) => (
            <>
              <Grid>
                <Choice
                  label="App"
                  value={item.app}
                  options={appOptions}
                  onChange={(v) => patch({ app: v })}
                />
                <Text
                  label="Payload id"
                  value={item.payloadId}
                  mono
                  hint="Project, note, media or alert id, when the app needs one"
                  onChange={(v) => patch({ payloadId: v })}
                />
              </Grid>
              <Advanced label="Size and position">
                <Grid cols={3}>
                  <Num label="X" value={item.x} step={0.05} onChange={(v) => patch({ x: v ?? 0 })} />
                  <Num label="Y" value={item.y} step={0.05} onChange={(v) => patch({ y: v ?? 0 })} />
                  <Num
                    label="Stack order"
                    value={item.order}
                    hint="Higher is on top"
                    onChange={(v) => patch({ order: v ?? 0 })}
                  />
                  <Num label="Width" value={item.width} onChange={(v) => patch({ width: v ?? 640 })} />
                  <Num
                    label="Height"
                    value={item.height}
                    onChange={(v) => patch({ height: v ?? 440 })}
                  />
                </Grid>
              </Advanced>
            </>
          )}
        </Repeater>
      </Section>

      <Section
        title="Notes"
        {...folds.props('notes', summary.notes)}
        hint="The plain-text files on the desktop. This is where the personality lives — keep it brief."
      >
        <Repeater
          items={draft.notes}
          onChange={(notes) =>
            update((next) => {
              next.notes = notes;
            })
          }
          create={(): Note => ({
            id: uniqueSlug(
              draft.notes.map((note) => note.id),
              'new-note',
            ),
            title: 'notes.txt',
            body: 'Write something short.',
            tone: 'plain',
          })}
          labelOf={(note) => note.title}
          addLabel="Add note"
        >
          {(note, patch) => (
            <>
              <Grid>
                <Text label="Title" value={note.title} onChange={(v) => patch({ title: v })} />
                <Choice
                  label="Tone"
                  value={note.tone}
                  options={opts(NOTE_TONES)}
                  onChange={(v) => patch({ tone: v as Note['tone'] })}
                />
              </Grid>
              <Area label="Body" value={note.body} rows={5} onChange={(v) => patch({ body: v })} />
              <Advanced>
                <IdField value={note.id} onChange={(v) => patch({ id: v })} />
              </Advanced>
            </>
          )}
        </Repeater>
      </Section>
    </div>
  );
}
