/**
 * Where a picture or a video comes from: a file in `public/`, or a URL.
 *
 * These were one text box that accepted either, which sounds friendly and is
 * not: the two have nothing in common. A URL either loads or it does not. A
 * local path has to be written in a particular shape, relative to a folder, and
 * the number of ways to get that shape wrong is large — a leading slash, a
 * `public/` that should not be there, a backslash, or the entire
 * `E:\asaad portifolio\public\media\…` string that Windows' "Copy as path"
 * puts on the clipboard. One box could not tell you which mistake you had made,
 * because it did not know which of the two things you were trying to do.
 *
 * So: say which, and get help with that one.
 *
 * **What this does not do.** It does not open a file picker. A browser file
 * input cannot tell a page where the chosen file lives on disk — the path is
 * deliberately withheld, and the fake `C:\fakepath\name.jpg` it reports instead
 * is not a mistake, it is the security model. A picker here could therefore only
 * *look* like it worked. The honest workflow is the one in the hint: put the
 * file in `public/`, then say where. Making the picker real would mean shipping
 * an Electron app or a server, which is a very large change to the architecture
 * of a static site in exchange for saving one paste.
 *
 * What it does instead is accept every reasonable way of saying it and fix the
 * shape itself — see `normalizeLocalPath` — then go and check the file is
 * actually there.
 */
import { useState } from 'react';
import { AlertCircle, Check, Link2, FolderOpen, Loader2 } from 'lucide-react';
import { cx } from '@/lib/utils';
import { isExternal, normalizeLocalPath, type LocalPath } from '@/lib/paths';
import type { Banner } from '@/types/content';
import { useAssetProbe } from '../useAssetProbe';
import { Choice, Grid, Text } from './parts';

const LOCAL_HELP =
  'A path inside public/ — "media/gaf/reel.mp4". Pasting the full Windows path or a leading /public/ is fine; it gets trimmed to the stored form on its own.';

const URL_HELP = 'A full https:// address to the file itself.';

export function SourceField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  localOnly,
  wide = true,
}: {
  label: string;
  value?: string;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  /** Extra guidance specific to the field, shown after the mode's own help. */
  hint?: string;
  /** Banners and other local-only sources: no URL half at all. */
  localOnly?: boolean;
  wide?: boolean;
}) {
  /*
   * The mode is UI state, not content. It is guessed from the value on first
   * render and then left alone, so switching to URL to look at it and switching
   * back does not touch what is stored — and above all does not clear it. The
   * one thing a source field must never do is lose the source.
   */
  const [mode, setMode] = useState<'local' | 'url'>(() => (isExternal(value) ? 'url' : 'local'));
  const [touched, setTouched] = useState(false);

  const local = localOnly || mode === 'local';
  const { path, error } = local ? normalizeLocalPath(value) : ({} as LocalPath);

  // Nothing is red while someone is still typing it; the field speaks up when
  // they leave it, and keeps speaking until it is right.
  const problem = touched ? error : undefined;
  const probe = useAssetProbe(local && !error ? path : undefined);

  const commit = () => {
    setTouched(true);
    // The canonical form is written back on the way out, so what is stored is
    // always the shape `portfolio.json` wants — never a machine-specific path.
    if (path && path !== value) onChange(path);
  };

  return (
    <label className={cx('field', wide && 'field--wide')}>
      <span className="mono field__label">{label}</span>

      {!localOnly && (
        <span className="studio-source" role="group" aria-label={`${label} source`}>
          <button
            type="button"
            className="studio-source__opt"
            data-on={mode === 'local' || undefined}
            onClick={() => setMode('local')}
          >
            <FolderOpen strokeWidth={1.6} />
            Local file
          </button>
          <button
            type="button"
            className="studio-source__opt"
            data-on={mode === 'url' || undefined}
            onClick={() => setMode('url')}
          >
            <Link2 strokeWidth={1.6} />
            URL
          </button>
        </span>
      )}

      <input
        type="text"
        className={cx('mono', problem && 'studio-input--bad')}
        value={value ?? ''}
        placeholder={local ? (placeholder ?? 'media/gaf/reel.mp4') : 'https://…'}
        aria-invalid={problem ? true : undefined}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={commit}
      />

      {problem ? (
        <span className="studio-source__status studio-source__status--bad">
          <AlertCircle strokeWidth={1.6} />
          {problem}
        </span>
      ) : (
        local &&
        path && (
          <span
            className={cx(
              'studio-source__status',
              probe === 'missing' && 'studio-source__status--warn',
              probe === 'found' && 'studio-source__status--ok',
            )}
          >
            {probe === 'checking' && (
              <>
                <Loader2 strokeWidth={1.6} />
                Looking for public/{path}…
              </>
            )}
            {probe === 'found' && (
              <>
                <Check strokeWidth={1.6} />
                Found public/{path}
              </>
            )}
            {probe === 'missing' && (
              <>
                <AlertCircle strokeWidth={1.6} />
                No file at public/{path} yet. Copy it there and this will clear.
              </>
            )}
          </span>
        )
      )}

      <span className="field__hint">
        {local ? LOCAL_HELP : URL_HELP}
        {hint ? ` ${hint}` : ''}
      </span>
    </label>
  );
}

/**
 * Type, alt text and local file for a `Banner` — the project banner's fields,
 * shared by the folder intro so both banners are edited (and normalised) the
 * same way. `None` clears the field entirely rather than leaving an empty
 * object behind.
 */
export function BannerSource({
  banner,
  onChange,
}: {
  banner?: Banner;
  onChange: (next: Banner | undefined) => void;
}) {
  return (
    <>
      <Grid>
        <Choice
          label="Banner type"
          value={banner?.type ?? ''}
          options={[
            { value: '', label: 'None — start with the title' },
            { value: 'image', label: 'Image' },
            { value: 'video', label: 'Video — silent, looping' },
          ]}
          hint="A video banner plays on its own with no controls. It is decoration behind the title, not something to watch."
          onChange={(v) => {
            if (!v) {
              onChange(undefined);
              return;
            }
            onChange({ type: v as Banner['type'], src: banner?.src ?? '', alt: banner?.alt });
          }}
        />
        {banner && (
          <Text
            label="Alt text"
            value={banner.alt}
            hint="Optional. Leave empty and the banner is treated as decoration, which is usually right."
            onChange={(v) => onChange({ ...banner, alt: v || undefined })}
          />
        )}
      </Grid>

      {banner && (
        <SourceField
          localOnly
          label={banner.type === 'video' ? 'Banner video' : 'Banner image'}
          value={banner.src}
          placeholder={banner.type === 'video' ? 'media/gaf/banner.mp4' : 'media/gaf/banner.jpg'}
          hint="Any shape works — it is cropped to the band. 1920 × 700 is the size the band was designed around."
          onChange={(v) => onChange({ ...banner, src: v ?? '' })}
        />
      )}
    </>
  );
}
