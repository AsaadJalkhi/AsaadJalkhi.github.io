/**
 * Studio form primitives.
 *
 * Every panel is assembled from these, so the editing UI stays consistent and
 * no panel hand-rolls an input, a reorder control or a chip.
 *
 * Text inputs deliberately keep an internal "raw" string while focused: list
 * fields parse on every keystroke, and without this a trailing comma or blank
 * line would vanish under the cursor as you typed.
 */
import { Component, useId, useState, type ErrorInfo, type HTMLAttributes, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, ImageOff, Plus, Trash2 } from 'lucide-react';
import { Btn, Field } from '@/components/ui/Ui';
import { disciplines, type Discipline, type IconSpec } from '@/types/content';
import { asset } from '@/lib/paths';
import { cx, moveItem, slugify } from '@/lib/utils';

/**
 * The one sentence everybody needs about local files, written once.
 *
 * The Studio CANNOT upload. This is a static GitHub Pages site with no server
 * and no API: the browser cannot write a binary into the repository, and a fake
 * uploader that only held an in-memory blob URL would work in the session and
 * then silently break on deploy. So the workflow is honest — put the file in
 * `public/` yourself, type its path here, export, commit.
 */
export const LOCAL_PATH_HINT =
  "Put the file inside public/, then enter its path without 'public/' and without a leading slash.";

/* -------------------------------------------------------------- resilience */

/**
 * Stops one broken piece of the editor from taking the whole tab with it.
 *
 * A panel is a form drawn over the LIVE draft, and the draft is rendered
 * *before* it is validated — deliberately, because you cannot fix a value you
 * cannot see. So a panel can be handed a shape the schema would reject. Before
 * this boundary existed, one throw during render unmounted the React root and
 * the Studio went white, with the cause visible only in the browser console.
 *
 * Now the failure is named where it happens and everything around it stays
 * editable. `what` is the human name of the thing that failed — a section
 * title, or a panel label — because "something went wrong" helps nobody.
 */
export class StudioBoundary extends Component<
  { what: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Not debug noise: this only ever runs when part of the editor has actually
    // failed, and it is the only record of which part and why.
    console.error(`Studio — "${this.props.what}" failed to render.`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="studio-broken" role="alert">
        <p className="studio-broken__title">{this.props.what} could not be displayed</p>
        <p className="mono studio-broken__body">{error.message}</p>
        <p className="studio-broken__note">
          Nothing has been lost — this is a display problem, and your draft is untouched. The rest
          of this page still works, and the full details are in the browser console. If it does not
          clear, use <strong>Reload from current portfolio</strong> in the sidebar.
        </p>
      </div>
    );
  }
}

/* ------------------------------------------------------------------ layout */

export function PanelHead({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="studio-panel__head">
      <h2 className="studio-panel__title">{title}</h2>
      {lede && <p className="studio-panel__lede">{lede}</p>}
    </header>
  );
}

/* -------------------------------------------------------------- collapsing */

/**
 * Which cards of one collection are open, keyed by a stable id (a media id, a
 * folder id, a section name). Everything starts collapsed. This is UI state
 * only: it lives in the component, resets on reload, and never reaches the
 * draft, the schema or an export.
 */
export interface Folds<K extends string = string> {
  isOpen: (id: K) => boolean;
  toggle: (id: K) => void;
  /** Opens one card and leaves the rest alone — a newly added item, say. */
  reveal: (id: K) => void;
  /** Exactly these open: `set(ids)` is Expand all, `set([])` is Collapse all. */
  set: (ids: Iterable<K>) => void;
  /** Keeps a card open while its id is being edited. */
  rename: (from: K, to: K) => void;
  /** Spread onto a `Section` to fold it: `<Section {...folds.props('cv', '3 sections')}>`. */
  props: (id: K, summary?: string) => { open: boolean; onToggle: () => void; summary?: string };
}

export function useFolds<K extends string = string>(): Folds<K> {
  const [open, setOpen] = useState<Set<K>>(() => new Set());
  const toggle = (id: K) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return {
    isOpen: (id) => open.has(id),
    toggle,
    reveal: (id) => setOpen((prev) => new Set(prev).add(id)),
    set: (ids) => setOpen(new Set(ids)),
    rename: (from, to) =>
      setOpen((prev) => {
        if (!prev.has(from)) return prev;
        const next = new Set(prev);
        next.delete(from);
        next.add(to);
        return next;
      }),
    props: (id, summary) => ({ open: open.has(id), onToggle: () => toggle(id), summary }),
  };
}

/**
 * The row above one collection: its count, then Expand all / Collapse all for
 * that collection only. `children` go first (the media List/Grid switch, the
 * project Preview button).
 */
export function FoldBar<K extends string>({
  folds,
  ids,
  count,
  bulk = true,
  children,
}: {
  folds: Folds<K>;
  ids: readonly K[];
  count?: string;
  bulk?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="studio-media__bar">
      {children}
      {count && <span className="mono studio-media__count">{count}</span>}
      {bulk && (
        <div className="studio-media__bulk">
          <Btn variant="quiet" size="sm" onClick={() => folds.set(ids)}>
            Expand all
          </Btn>
          <Btn variant="quiet" size="sm" onClick={() => folds.set([])}>
            Collapse all
          </Btn>
        </div>
      )}
    </div>
  );
}

/**
 * The one collapsible card in the Studio: project sections, media items,
 * folders, experience entries, panel sections all draw through here.
 *
 * The head is a real button (`aria-expanded`, `aria-controls`) holding the
 * index, tag, title and one-line summary. `lead` (a drag grip) and `actions`
 * (reorder, duplicate, delete) are its *siblings*, never inside it, so using
 * one can never open or close the card. The body only mounts while open.
 *
 * Controlled with `open` + `onToggle` (so a collection can Expand all), or on
 * its own from `defaultOpen`. Extra attributes land on the card (drag data).
 */
export function Collapsible({
  title,
  summary,
  tag,
  index,
  lead,
  actions,
  hint,
  open,
  onToggle,
  defaultOpen = false,
  className,
  children,
  ...rest
}: {
  title: string;
  summary?: string;
  tag?: string;
  /** Zero-based; drawn as #01, #02… */
  index?: number;
  lead?: ReactNode;
  actions?: ReactNode;
  hint?: string;
  open?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'title' | 'children' | 'className'>) {
  const [own, setOwn] = useState(defaultOpen);
  const expanded = onToggle ? Boolean(open) : own;
  const toggle = onToggle ?? (() => setOwn((was) => !was));
  const bodyId = useId();

  return (
    <section
      {...rest}
      className={cx('studio-rep__item', 'studio-media-card', expanded && 'is-open', className)}
    >
      <header className="studio-rep__head studio-media-card__head">
        {lead}
        <button
          type="button"
          className="studio-media-card__summary"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={toggle}
        >
          {index !== undefined && (
            <span className="mono studio-rep__index">#{String(index + 1).padStart(2, '0')}</span>
          )}
          {tag && <span className="mono studio-media-card__kind">{tag}</span>}
          <span className={cx('studio-rep__label', summary && 'studio-fold__title')}>{title}</span>
          {summary && <span className="studio-fold__summary">{summary}</span>}
        </button>
        <div className="studio-rep__tools">
          {actions}
          <IconBtn label={expanded ? 'Collapse' : 'Expand'} onClick={toggle}>
            {expanded ? <ChevronDown strokeWidth={1.5} /> : <ChevronRight strokeWidth={1.5} />}
          </IconBtn>
        </div>
      </header>
      {expanded && (
        <div className="studio-rep__body" id={bodyId}>
          {hint && <p className="studio-section__hint">{hint}</p>}
          <StudioBoundary what={title}>{children}</StudioBoundary>
        </div>
      )}
    </section>
  );
}

/**
 * A titled block of fields.
 *
 * Pass `onToggle` and it becomes a `Collapsible` card, with `summary` as its
 * one-line digest. The caller owns `open`, so a panel can offer Expand all /
 * Collapse all.
 */
export function Section({
  title,
  hint,
  children,
  open,
  onToggle,
  summary,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  summary?: string;
}) {
  if (onToggle) {
    return (
      <Collapsible title={title} hint={hint} summary={summary} open={open} onToggle={onToggle}>
        {children}
      </Collapsible>
    );
  }

  return (
    <section className="studio-section">
      <h3 className="mono studio-section__title">{title}</h3>
      {hint && <p className="studio-section__hint">{hint}</p>}
      {/* Per-section, so a bad value in Widgets cannot blank out Dock links. */}
      <StudioBoundary what={title}>{children}</StudioBoundary>
    </section>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div className="studio-grid" data-cols={cols}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ fields */

export function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
  wide,
  mono,
}: {
  label: string;
  value?: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <Field label={label} hint={hint} wide={wide}>
      <input
        type="text"
        className={cx(mono && 'mono')}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/**
 * Live preview of an icon path.
 *
 * Shows the real file if it resolves, and the monogram/tint fallback if it does
 * not — which is exactly what the desktop itself will do, so what you see here
 * is what visitors get. A missing file is a normal state, not an error: the
 * portfolio never breaks over one, and the preview says so quietly rather than
 * turning red.
 */
function IconPreview({
  src,
  theme,
  icon,
  fallbackText,
}: {
  src?: string;
  theme: 'light' | 'dark';
  icon?: IconSpec;
  fallbackText?: string;
}) {
  const resolved = asset(src);
  const [broken, setBroken] = useState(false);
  const monogram = (icon?.text || fallbackText || '?').slice(0, 3);

  // Re-test when the path changes — otherwise one typo latches "broken" forever.
  const [lastSrc, setLastSrc] = useState(resolved);
  if (lastSrc !== resolved) {
    setLastSrc(resolved);
    setBroken(false);
  }

  return (
    <div
      className="studio-icon-preview"
      data-preview-theme={theme}
      title={src || 'No image set'}
    >
      {resolved && !broken ? (
        // Bare, on the theme's own background — exactly as the desktop draws it.
        // No plate, no tint, no rounded container: what you see here is what the
        // transparent PNG will actually look like.
        <img src={resolved} alt="" onError={() => setBroken(true)} />
      ) : (
        // Letters, not letters on a coloured square — the desktop stopped
        // plating its fallbacks in session 10, and `tint` colours the mark
        // itself now. This preview has to agree with it or it is lying.
        <span
          className="studio-icon-preview__mono"
          style={icon?.tint ? { color: icon.tint } : undefined}
        >
          {monogram}
        </span>
      )}
      {resolved && broken && (
        <span className="studio-icon-preview__missing" title="File not found in public/">
          <ImageOff strokeWidth={1.5} />
        </span>
      )}
      <span className="studio-icon-preview__label mono">{theme}</span>
    </div>
  );
}

/**
 * The icon editor — one image per theme, a monogram fallback, and a preview of
 * both modes side by side.
 *
 * Used by every icon-bearing thing (desktop shortcuts, folders, projects) so
 * the fields and the explanation exist in one place.
 *
 * **Two images, because one is frequently wrong.** A logo drawn in black
 * disappears on a dark desktop and a white one disappears on a light one. Give
 * it both and each theme uses the right file; give it one and that file is used
 * for both, which is correct for anything full-colour.
 *
 * **There is no tint field here any more.** Tint only ever coloured the
 * monogram tile, but sitting in the icon editor it read as something you were
 * supposed to set for your logo — and a custom image is now drawn bare, with
 * its transparency intact and no plate behind it, so a tint has nothing to
 * apply to. Existing `tint` values in content still colour existing monograms;
 * see IconSchema.
 */
export function IconFields({
  icon,
  onChange,
  fallbackText,
}: {
  icon?: IconSpec;
  onChange: (next: IconSpec | undefined) => void;
  fallbackText?: string;
}) {
  // An icon whose every field is empty should be absent, not `{}` — that keeps
  // the exported JSON clean and the round-trip diff honest. `tint` is included
  // in the emptiness test even though it is no longer editable here, so an old
  // tint-only icon is not silently resurrected as `{}`.
  const patch = (part: Partial<IconSpec>) => {
    const next: IconSpec = { ...icon, ...part };
    const empty = !next.image && !next.imageLight && !next.imageDark && !next.text && !next.tint;
    onChange(empty ? undefined : next);
  };

  // Legacy single `image` stands in for whichever theme has nothing of its own.
  const light = icon?.imageLight ?? icon?.image;
  const dark = icon?.imageDark ?? icon?.image;

  return (
    <div className="studio-icon-row">
      <div className="studio-icon-previews">
        <IconPreview src={light} theme="light" icon={icon} fallbackText={fallbackText} />
        <IconPreview src={dark} theme="dark" icon={icon} fallbackText={fallbackText} />
      </div>
      <Grid cols={3}>
        <Text
          label="Light mode image"
          value={icon?.imageLight ?? icon?.image}
          mono
          placeholder="icons/logo-dark.png"
          hint={`${LOCAL_PATH_HINT} A transparent PNG or SVG. Used for both modes if you leave the dark one empty.`}
          onChange={(v) => patch({ imageLight: v || undefined })}
        />
        <Text
          label="Dark mode image"
          value={icon?.imageDark ?? icon?.image}
          mono
          placeholder="icons/logo-light.png"
          hint="Optional. Use this when the light-mode logo disappears against a dark desktop."
          onChange={(v) => patch({ imageDark: v || undefined })}
        />
        <Text
          label="Fallback monogram"
          value={icon?.text}
          placeholder="Bl"
          hint="Up to 3 characters. Shown if there is no image, or the file is missing."
          onChange={(v) => patch({ text: v.slice(0, 3) || undefined })}
        />
      </Grid>
    </div>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
}: {
  label: string;
  value?: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} wide>
      <textarea
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function Num({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value?: number;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
      />
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

/** Turn a list of enum values into <option> data. */
export function opts(values: readonly string[]): Option[] {
  return values.map((value) => ({ value, label: value }));
}

export function Choice({
  label,
  value,
  options,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value?: string;
  options: readonly Option[];
  onChange: (next: string) => void;
  hint?: string;
  /** Adds an empty first entry — use for optional fields. */
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {/*
         * Keyed by position as well as value. Option lists are built from other
         * people's ids (folders, projects, notes, alerts), and two of those can
         * briefly share an id — while one is being retyped, or straight after a
         * Duplicate. Keying on value alone collides there, and React is explicit
         * that duplicate keys may duplicate or omit children, which is not a
         * state to leave a <select> in.
         */}
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Comma-separated string array (tags, categories, tools…). */
export function Tags({
  label,
  value,
  onChange,
  hint = 'Separate with commas',
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);

  return (
    <Field label={label} hint={hint} wide>
      <input
        type="text"
        value={raw ?? value.join(', ')}
        placeholder={placeholder}
        onChange={(event) => {
          setRaw(event.target.value);
          onChange(splitList(event.target.value));
        }}
        onBlur={() => setRaw(null)}
      />
    </Field>
  );
}

/** One-per-line string array (paragraphs, highlights, bullet lists). */
export function Lines({
  label,
  value,
  onChange,
  rows = 4,
  hint = 'One per line',
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  rows?: number;
  hint?: string;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);

  return (
    <Field label={label} hint={hint} wide>
      <textarea
        rows={rows}
        value={raw ?? value.join('\n')}
        placeholder={placeholder}
        onChange={(event) => {
          setRaw(event.target.value);
          onChange(
            event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          );
        }}
        onBlur={() => setRaw(null)}
      />
    </Field>
  );
}

export function DisciplinePicker({
  value,
  onChange,
  label = 'Disciplines',
}: {
  value: Discipline[];
  onChange: (next: Discipline[]) => void;
  label?: string;
}) {
  return (
    <div className="studio-field-group">
      <span className="mono field__label">{label}</span>
      <div className="studio-chips">
        {disciplines.map((discipline) => {
          const on = value.includes(discipline);
          return (
            <button
              key={discipline}
              type="button"
              className={cx('studio-chip', on && 'studio-chip--on')}
              data-discipline={discipline}
              aria-pressed={on}
              onClick={() =>
                onChange(on ? value.filter((item) => item !== discipline) : [...value, discipline])
              }
            >
              {discipline}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- advanced */

/**
 * A collapsed drawer for the fields that exist but should not be the first
 * thing anyone sees — ids, coordinates, overrides. Native <details> so it is
 * keyboard-accessible and needs no state.
 */
export function Advanced({
  children,
  label = 'Advanced',
  hint,
}: {
  children: ReactNode;
  label?: string;
  hint?: string;
}) {
  return (
    <details className="studio-advanced">
      <summary className="studio-advanced__summary">{label}</summary>
      {hint && <p className="studio-advanced__hint">{hint}</p>}
      <div className="studio-advanced__body">{children}</div>
    </details>
  );
}

/* --------------------------------------------------------------------- ids */

/**
 * The id field.
 *
 * Ids are internal: they are the slug used in links, search and the references
 * between folders and projects. Nobody should have to invent one, so callers
 * generate it from the title on create (see `slugFromTitle`) and this field
 * sits behind `Advanced` for the rare case where it has to be corrected.
 */
export function IdField({
  value,
  onChange,
  hint = 'The internal name used in links and in the references between items. It only needs to be unique — visitors never see it.',
}: {
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  return <Text label="ID" value={value} mono wide hint={hint} onChange={(v) => onChange(slugify(v))} />;
}

/* ----------------------------------------------------------------- actions */

export function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx('studio-icon-btn', danger && 'studio-icon-btn--danger')}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- repeater */

interface RepeaterProps<T> {
  items: T[];
  onChange: (next: T[]) => void;
  create: () => NoInfer<T>;
  labelOf: (item: T, index: number) => string;
  children: (item: T, patch: (changes: Partial<T>) => void, index: number) => ReactNode;
  addLabel?: string;
  empty?: string;
  duplicable?: boolean;
  /** Names the list when it sits inside a larger form (gallery images, screenshots). */
  label?: string;
  /**
   * Draws every row as a `Collapsible` card, keyed by `id(item)` in the
   * caller's `folds`. Without it, rows are always open.
   */
  fold?: { folds: Folds; id: (item: T) => string };
}

/**
 * Editable list with reorder / duplicate / delete. Used for every nested
 * collection in the content model (media, links, metrics, socials, notes…).
 */
export function Repeater<T extends object>({
  items,
  onChange,
  create,
  labelOf,
  children,
  addLabel = 'Add',
  empty,
  duplicable = true,
  label,
  fold,
}: RepeaterProps<T>) {
  const patchAt = (index: number) => (changes: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const keyOf = (item: T, index: number) => {
    const id = (item as { id?: unknown }).id;
    return typeof id === 'string' && id ? `${id}-${index}` : `row-${index}`;
  };

  const tools = (item: T, index: number) => (
    <>
      <IconBtn
        label="Move up"
        disabled={index === 0}
        onClick={() => onChange(moveItem(items, index, index - 1))}
      >
        <ArrowUp strokeWidth={1.5} />
      </IconBtn>
      <IconBtn
        label="Move down"
        disabled={index === items.length - 1}
        onClick={() => onChange(moveItem(items, index, index + 1))}
      >
        <ArrowDown strokeWidth={1.5} />
      </IconBtn>
      {duplicable && (
        <IconBtn
          label="Duplicate"
          onClick={() => {
            const copy = structuredClone(item);
            // A copy must not inherit the original's id. Two rows sharing
            // one id is invalid content, it makes every reference to that
            // id ambiguous, and it puts duplicate values into every
            // dropdown built from this list.
            const id = (copy as { id?: unknown }).id;
            if (typeof id === 'string' && id) {
              const taken = items
                .map((other) => (other as { id?: unknown }).id)
                .filter((other): other is string => typeof other === 'string');
              (copy as { id?: unknown }).id = uniqueSlug(taken, `${id}-copy`);
            }
            const next = [...items];
            next.splice(index + 1, 0, copy);
            onChange(next);
          }}
        >
          <Copy strokeWidth={1.5} />
        </IconBtn>
      )}
      <IconBtn label="Delete" danger onClick={() => onChange(items.filter((_, i) => i !== index))}>
        <Trash2 strokeWidth={1.5} />
      </IconBtn>
    </>
  );

  return (
    <div className="studio-rep">
      {label && <span className="mono studio-rep__title">{label}</span>}
      {items.length === 0 && empty && <p className="studio-rep__empty">{empty}</p>}

      {items.map((item, index) =>
        fold ? (
          <Collapsible
            key={keyOf(item, index)}
            index={index}
            title={labelOf(item, index)}
            actions={tools(item, index)}
            open={fold.folds.isOpen(fold.id(item))}
            onToggle={() => fold.folds.toggle(fold.id(item))}
          >
            {children(item, patchAt(index), index)}
          </Collapsible>
        ) : (
          <section className="studio-rep__item" key={keyOf(item, index)}>
            <header className="studio-rep__head">
              <span className="mono studio-rep__index">{String(index + 1).padStart(2, '0')}</span>
              <span className="studio-rep__label">{labelOf(item, index)}</span>
              <div className="studio-rep__tools">{tools(item, index)}</div>
            </header>
            <div className="studio-rep__body">{children(item, patchAt(index), index)}</div>
          </section>
        ),
      )}

      <Btn
        variant="quiet"
        size="sm"
        icon={<Plus />}
        onClick={() => {
          const item = create();
          onChange([...items, item]);
          // A new row is empty and needs filling in, so a folded one opens itself.
          if (fold) fold.folds.reveal(fold.id(item));
        }}
      >
        {addLabel}
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------------------ ids */

/**
 * Builds the id a new item should get, from whatever the user typed as its
 * title. This is why the Studio never asks anyone to make an id up.
 */
export function slugFromTitle(existing: string[], title: string, fallback: string): string {
  return uniqueSlug(existing, slugify(title) || fallback);
}

/** A slug that doesn't collide with anything already in the list. */
export function uniqueSlug(existing: string[], base: string): string {
  const root = slugify(base) || 'item';
  if (!existing.includes(root)) return root;
  let n = 2;
  while (existing.includes(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
