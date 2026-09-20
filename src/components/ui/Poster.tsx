/**
 * Generated artwork.
 *
 * Stand-in visuals for work that has no media yet, and the fallback when an
 * image fails to load — the UI degrades to something art-directed rather than
 * to a broken-image icon. Compositions are deterministic from the seed, so a
 * tile never flickers or reshuffles between renders.
 *
 * These are meant to read as design objects — a type poster, a layout study, a
 * screen mockup, a soft photographic field — not as abstract "AI art".
 */
import { useMemo } from 'react';
import type { Discipline } from '@/types/content';
import { seededRandom, hashString, cx } from '@/lib/utils';
import './poster.css';

const TONES: Record<Discipline, string> = {
  marketing: 'var(--c-marketing)',
  creative: 'var(--c-creative)',
  digital: 'var(--c-digital)',
};

interface PosterProps {
  seed: string;
  label?: string;
  discipline?: Discipline;
  className?: string;
  /** Hide the small caption baked into the artwork. */
  bare?: boolean;
}

export function Poster({ seed, label, discipline = 'creative', className, bare }: PosterProps) {
  const art = useMemo(() => composition(seed, label), [seed, label]);
  const tone = TONES[discipline];

  return (
    <svg
      className={cx('poster', className)}
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label ? `${label} — placeholder artwork` : 'Placeholder artwork'}
    >
      <defs>
        <linearGradient id={`pg-${art.key}`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#1b1d20" />
          <stop offset="100%" stopColor="#101113" />
        </linearGradient>
        <linearGradient id={`pt-${art.key}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={tone} stopOpacity="0.55" />
          <stop offset="100%" stopColor={tone} stopOpacity="0.08" />
        </linearGradient>
        <clipPath id={`pc-${art.key}`}>
          <rect width="320" height="240" />
        </clipPath>
      </defs>

      <rect width="320" height="240" fill={`url(#pg-${art.key})`} />

      <g clipPath={`url(#pc-${art.key})`}>
        {/* 0 — type poster: the work's own initials, set large. */}
        {art.variant === 0 && (
          <>
            <rect x="0" y={art.y} width="320" height="88" fill={`url(#pt-${art.key})`} opacity="0.5" />
            <text
              x="26"
              y="150"
              className="poster__mark"
              fill="rgba(255,255,255,0.9)"
              fontSize="86"
              letterSpacing="-4"
            >
              {art.initials}
            </text>
            <rect x="26" y="172" width="52" height="3" fill={tone} />
            <rect x="26" y="192" width="150" height="1" fill="rgba(255,255,255,0.14)" />
          </>
        )}

        {/* 1 — layout study: a brand system laid out on a page. */}
        {art.variant === 1 && (
          <>
            <rect x="26" y="30" width="150" height="98" rx="2" fill="rgba(255,255,255,0.07)" />
            <rect x="186" y="30" width="108" height="46" rx="2" fill={`url(#pt-${art.key})`} />
            <rect x="186" y="86" width="108" height="42" rx="2" fill="rgba(255,255,255,0.05)" />
            <rect x="26" y="146" width="96" height="6" rx="3" fill="rgba(255,255,255,0.22)" />
            <rect x="26" y="162" width="182" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
            <rect x="26" y="174" width="140" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
            <circle cx="278" cy="170" r="16" fill={tone} opacity="0.75" />
          </>
        )}

        {/* 2 — screen mockup: the digital side of the work. */}
        {art.variant === 2 && (
          <>
            <rect x="40" y="34" width="240" height="150" rx="7" fill="#0b0c0d" stroke="rgba(255,255,255,0.12)" />
            <rect x="40" y="34" width="240" height="20" rx="7" fill="rgba(255,255,255,0.05)" />
            <circle cx="52" cy="44" r="2.6" fill="rgba(255,255,255,0.22)" />
            <circle cx="61" cy="44" r="2.6" fill="rgba(255,255,255,0.16)" />
            <rect x="54" y="68" width="120" height="40" rx="2" fill={`url(#pt-${art.key})`} />
            <rect x="54" y="118" width="86" height="5" rx="2.5" fill="rgba(255,255,255,0.2)" />
            <rect x="54" y="132" width="140" height="4" rx="2" fill="rgba(255,255,255,0.09)" />
            <rect x="188" y="68" width="78" height="68" rx="2" fill="rgba(255,255,255,0.06)" />
            <rect x="40" y="196" width="240" height="4" rx="2" fill="rgba(255,255,255,0.06)" />
          </>
        )}

        {/* 3 — soft field: a photographic stand-in. */}
        {art.variant === 3 && (
          <>
            <circle cx={art.blob.x} cy={art.blob.y} r={art.blob.r} fill={tone} opacity="0.4" />
            <circle
              cx={art.blob.x + 70}
              cy={art.blob.y + 44}
              r={art.blob.r * 0.72}
              fill="rgba(255,255,255,0.06)"
            />
            <rect x="0" y="168" width="320" height="72" fill="rgba(0,0,0,0.28)" />
            <rect x="26" y="198" width="64" height="3" fill={tone} opacity="0.8" />
          </>
        )}
      </g>

      {!bare && art.variant !== 0 && (
        <text x="26" y="222" className="poster__caption" fill="rgba(255,255,255,0.38)">
          {(label ?? seed).slice(0, 28)}
        </text>
      )}
    </svg>
  );
}

function composition(seed: string, label?: string) {
  const rand = seededRandom(seed);
  const hash = hashString(seed);

  // Initials from the label, so the type poster says something real.
  const initials = (label ?? seed)
    .replace(/[^a-zA-Z0-9 &]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return {
    key: hash.toString(36).slice(0, 6),
    variant: hash % 4,
    initials: initials || 'A',
    y: Math.round(20 + rand() * 60),
    blob: {
      x: Math.round(90 + rand() * 140),
      y: Math.round(70 + rand() * 60),
      r: Math.round(52 + rand() * 44),
    },
  };
}
