/**
 * Shared primitives. Everything visual in ASAAD.OS is built from these plus
 * the design tokens — no ad-hoc button or chip markup anywhere else.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Discipline } from '@/types/content';
import { cx } from '@/lib/utils';
import './ui.css';

/* ------------------------------------------------------------------ button */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'quiet' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  block?: boolean;
}

export function Btn({
  variant = 'outline',
  size = 'md',
  icon,
  iconEnd,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: BtnProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className)}
      {...rest}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      {children && <span className="btn__label">{children}</span>}
      {iconEnd && <span className="btn__icon btn__icon--end">{iconEnd}</span>}
    </button>
  );
}

/* -------------------------------------------------------------------- tags */

export function Tag({
  children,
  discipline,
  subtle,
}: {
  children: ReactNode;
  discipline?: Discipline;
  subtle?: boolean;
}) {
  return (
    <span
      className={cx('tag', discipline && `tag--${discipline}`, subtle && 'tag--subtle')}
      data-discipline={discipline}
    >
      {children}
    </span>
  );
}

/** Small mono label used for section headers and metadata rows. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('mono meta', className)}>{children}</span>;
}

export function SectionTitle({
  index,
  children,
  action,
}: {
  index?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2 className="section-title__text">
        {index && <span className="section-title__index mono">{index}</span>}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="divider" role="separator">
      <span className="divider__line" />
      {label && <span className="mono divider__label">{label}</span>}
      {label && <span className="divider__line" />}
    </div>
  );
}

/** Marks sample content honestly without shouting about it. */
export function DemoBadge({ label = 'Sample' }: { label?: string }) {
  return (
    <span className="demo-badge" title="Demo content shipped with ASAAD.OS — not a real result">
      {label}
    </span>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="toggle__input"
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={cx('field', wide && 'field--wide')}>
      <span className="mono field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
