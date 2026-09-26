/**
 * Appearance — theme, wallpapers, and the Studio's privacy gate.
 *
 * Small panel, but it is the one that changes how the whole site feels, so it
 * gets its own tab rather than being buried at the bottom of Profile.
 */
import { Toggle } from '@/components/ui/Ui';
import type { FontSpec, TypeRole, TypographySettings } from '@/types/content';
import type { PanelProps } from '../useDraft';
import { Choice, FoldBar, Grid, Num, PanelHead, Section, Text, useFolds } from './parts';

/** The collapsible sections of this tab, in page order. */
const FOLDS = ['theme', 'wallpapers', 'typography', 'pin'] as const;
type Fold = (typeof FOLDS)[number];

/**
 * The type system: three roles, each of which can have its own typeface.
 *
 * **Shared font** is the one most sites want — set it once and every role uses
 * it. Each role can then override it with a font of its own, which is how you
 * pair a display face with a different text face. Empty inherits, so nobody has
 * to fill in three fields to change one.
 *
 * What is not here, on purpose: a slot per weight, a folder per family, a
 * mapping table. That is a font manager. One file per role is a typographic
 * choice; four files per role is inventory.
 *
 * Leave everything alone and the site uses the native system stack at the sizes
 * it already used. That is a finished answer, not an unfinished one: the system
 * stack is most of what makes this feel like an OS rather than a web page
 * imitating one.
 *
 * No Google Fonts, no font CDN, no external service — see useTypography.
 */
const FONT_FILE_HINT =
  'Place the font file inside public/fonts/ and reference it without public/ or a leading slash. WOFF2 is recommended.';

/** The two font fields, used for the shared face and for each role's override. */
function FontPair({
  spec,
  nameHint,
  fileHint,
  namePlaceholder,
  onChange,
}: {
  spec?: FontSpec;
  nameHint: string;
  fileHint: string;
  namePlaceholder: string;
  onChange: (next: FontSpec | undefined) => void;
}) {
  const patch = (part: Partial<FontSpec>) => {
    const next: FontSpec = { ...spec, ...part };
    // Both empty means absent, so an untouched export gains no new keys.
    onChange(!next.family && !next.file ? undefined : next);
  };

  return (
    <>
      <Text
        label="Font name"
        value={spec?.family}
        placeholder={namePlaceholder}
        hint={nameHint}
        onChange={(v) => patch({ family: v || undefined })}
      />
      <Text
        label="Font file"
        value={spec?.file}
        mono
        placeholder="fonts/asaad-font.woff2"
        hint={fileHint}
        onChange={(v) => patch({ file: v || undefined })}
      />
    </>
  );
}

const WEIGHTS = [
  { value: '300', label: '300 — Light' },
  { value: '400', label: '400 — Regular' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — Semibold' },
  { value: '700', label: '700 — Bold' },
  { value: '800', label: '800 — Extrabold' },
];

/**
 * One role: its own typeface, plus four controls in plain numbers.
 *
 * Nothing here asks for CSS. Letter spacing is a small signed number (negative
 * tightens), line height is a multiple of the font size, and size is the
 * desktop size in pixels — small screens scale down from it automatically.
 */
function RoleBlock({
  name,
  title,
  lede,
  sample,
  role,
  onChange,
}: {
  name: string;
  title: string;
  lede: string;
  sample: string;
  role?: TypeRole;
  onChange: (next: TypeRole | undefined) => void;
}) {
  const patch = (part: Partial<TypeRole>) => {
    const next: TypeRole = { ...role, ...part };
    // Everything empty means absent, so an untouched export gains no new keys.
    const empty = Object.values(next).every((value) => value === undefined);
    onChange(empty ? undefined : next);
  };

  return (
    <div className="studio-font">
      <p className="mono studio-font__role">{title}</p>
      <p className="studio-font__lede">{lede}</p>
      <Grid>
        <FontPair
          spec={role?.font}
          namePlaceholder="Leave empty to use the shared font"
          nameHint={`Optional. Give ${title} its own typeface, or leave both empty and it uses the shared font above.`}
          fileHint={FONT_FILE_HINT}
          onChange={(next) => patch({ font: next })}
        />
        <Num
          label="Size"
          value={role?.size}
          min={8}
          max={200}
          step={1}
          hint="Pixels, on a desktop screen. Smaller screens scale down from this."
          onChange={(v) => patch({ size: v })}
        />
        <Choice
          label="Weight"
          value={role?.weight === undefined ? undefined : String(role.weight)}
          options={WEIGHTS}
          placeholder="Default"
          hint="A variable font uses this directly; a single-weight file may be synthesised."
          onChange={(v) => patch({ weight: v ? Number(v) : undefined })}
        />
        <Num
          label="Letter spacing"
          value={role?.tracking}
          min={-0.08}
          max={0.15}
          step={0.005}
          hint="Negative is tighter, positive is looser. 0 is the font's own spacing."
          onChange={(v) => patch({ tracking: v })}
        />
        <Num
          label="Line height"
          value={role?.leading}
          min={0.8}
          max={2}
          step={0.05}
          hint="A multiple of the font size. 1.5 is comfortable for reading; 1.0 is tight for big titles."
          onChange={(v) => patch({ leading: v })}
        />
      </Grid>
      {/*
       * Live, and honest: the preview reads the same CSS variables the site
       * does, so a font file that failed to load shows its fallback here too
       * rather than being told everything is fine.
       */}
      <p className="studio-font__sample" data-role={name}>
        {sample}
      </p>
    </div>
  );
}

function TypographyFields({ draft, update }: PanelProps) {
  const typography = draft.settings.typography;

  /**
   * Writes one key and drops the whole object when nothing is left in it —
   * the same rule every optional field in the Studio follows, and what keeps a
   * no-edit export byte-identical.
   */
  const set = <K extends keyof TypographySettings>(key: K, value: TypographySettings[K]) =>
    update((state) => {
      const next: TypographySettings = { ...state.settings.typography, [key]: value };
      const used = Object.values(next).some((v) => v !== undefined);
      state.settings.typography = used ? next : undefined;
    });

  return (
    <>
      <div className="studio-font">
        <p className="mono studio-font__role">Shared font</p>
        <p className="studio-font__lede">
          Used by every role that does not name its own. Set this one and stop, or give Display,
          Heading and Body different faces below. Leave it empty to keep the system font.
        </p>
        <Grid>
          <FontPair
            spec={typography?.font}
            namePlaceholder="Söhne"
            nameHint="Any name you like. On its own, with no file, it selects a font already installed on the visitor's machine."
            fileHint={FONT_FILE_HINT}
            onChange={(next) => set('font', next)}
          />
        </Grid>
      </div>

      <RoleBlock
        name="display"
        title="Display"
        lede="Rare and large: a major project title, the About statement, a hero heading."
        sample="Brand Marketing & Campaigns"
        role={typography?.display}
        onChange={(next) => set('display', next)}
      />
      <RoleBlock
        name="heading"
        title="Heading"
        lede="Media titles, ordinary project titles, section and window headings, strong labels."
        sample="French Toast — Behind the Scenes"
        role={typography?.heading}
        onChange={(next) => set('heading', next)}
      />
      <RoleBlock
        name="body"
        title="Body"
        lede="Captions, paragraphs, descriptions, metadata — everything you actually read."
        sample="The campaign ran for six weeks across three cities, and the work had to hold up at billboard scale and at thumb scale on the same day."
        role={typography?.body}
        onChange={(next) => set('body', next)}
      />

      <div className="studio-font">
        <p className="mono studio-font__role">Global type scale</p>
        <p className="studio-font__lede">
          Every size at once, nudged. Two fonts set at the same size can read visibly
          differently — this is the one control that fixes that without touching the rest.
        </p>
        <Grid>
          <Num
            label="Type scale (%)"
            value={typography?.scale}
            min={50}
            max={200}
            step={1}
            hint="100% is the sizes as configured. 85–120% is the useful range. Text only: icons, media, the dock, windows and spacing do not move."
            onChange={(v) => set('scale', v)}
          />
        </Grid>
      </div>
    </>
  );
}

export function AppearancePanel({ draft, update }: PanelProps) {
  const { theme } = draft.settings;

  // Which sections are open: UI state only, never content.
  const folds = useFolds<Fold>();
  const summary: Record<Fold, string> = {
    theme: `${theme.default === 'dark' ? 'Dark' : 'Light'} by default · toggle ${theme.allowToggle ? 'on' : 'off'}`,
    wallpapers:
      [theme.wallpaperLight && 'Light', theme.wallpaperDark && 'Dark'].filter(Boolean).join(' + ') ||
      'Built-in gradients',
    typography: draft.settings.typography ? 'Custom typography' : 'System font',
    pin: draft.settings.studioPin ? 'PIN set' : 'No PIN',
  };

  return (
    <div className="studio-panel">
      <PanelHead
        title="Appearance"
        lede="Light and dark mode, the desktop wallpapers, and who can open this Studio."
      />

      <FoldBar folds={folds} ids={FOLDS} />

      <Section
        title="Theme"
        {...folds.props('theme', summary.theme)}
        hint="The default is what a first-time visitor sees. If the toggle is on, their choice is remembered on their device."
      >
        <Grid>
          <div className="studio-toggles">
            <Toggle
              label="Start in dark mode"
              hint="Off means the site opens light, which is the default"
              checked={theme.default === 'dark'}
              onChange={(v) =>
                update((next) => {
                  next.settings.theme.default = v ? 'dark' : 'light';
                })
              }
            />
            <Toggle
              label="Let visitors switch"
              hint="Adds the sun/moon toggle to the menu bar"
              checked={theme.allowToggle}
              onChange={(v) =>
                update((next) => {
                  next.settings.theme.allowToggle = v;
                })
              }
            />
          </div>
        </Grid>
      </Section>

      <Section
        title="Wallpapers"
        {...folds.props('wallpapers', summary.wallpapers)}
        hint="Optional. Drop the images in /public and reference them without a leading slash — e.g. wallpapers/light.jpg. Leave either one empty and that mode uses its built-in gradient. Switching theme cross-fades between the two."
      >
        <Grid>
          <Text
            label="Light wallpaper"
            value={theme.wallpaperLight}
            mono
            placeholder="wallpapers/light.jpg"
            onChange={(v) =>
              update((next) => {
                next.settings.theme.wallpaperLight = v || undefined;
              })
            }
          />
          <Text
            label="Dark wallpaper"
            value={theme.wallpaperDark}
            mono
            placeholder="wallpapers/dark.jpg"
            onChange={(v) =>
              update((next) => {
                next.settings.theme.wallpaperDark = v || undefined;
              })
            }
          />
        </Grid>
      </Section>

      <Section
        title="Typography"
        {...folds.props('typography', summary.typography)}
        hint="Three roles — Display, Heading and Body — each with its own typeface, size, weight, letter spacing and line height. Set the shared font and every role uses it; give a role its own font and it overrides the shared one. Change nothing and the site keeps the system font at the sizes it already uses."
      >
        <TypographyFields draft={draft} update={update} />
      </Section>

      <Section
        title="Studio PIN"
        {...folds.props('pin', summary.pin)}
        hint="A privacy gate, not security. This is a static site with no server: the PIN is part of the JavaScript bundle, so anyone determined enough can read it in devtools. It keeps casual visitors out of the Studio — treat it as a closed door, not a lock."
      >
        <Grid>
          <Text
            label="PIN"
            value={draft.settings.studioPin}
            mono
            placeholder="leave empty for no gate"
            hint="4–8 digits. Empty means the Studio opens straight away."
            onChange={(v) =>
              update((next) => {
                next.settings.studioPin = v.replace(/\D/g, '').slice(0, 8) || undefined;
              })
            }
          />
        </Grid>
        <p className="studio-note">
          The Studio is already invisible to visitors — it has no dock icon, no desktop icon and no
          search result, and the only way here is typing <code>#/studio</code>. The PIN is what stops
          someone who knows that address. For a real lock, edit content locally and deploy without it.
        </p>
      </Section>
    </div>
  );
}
