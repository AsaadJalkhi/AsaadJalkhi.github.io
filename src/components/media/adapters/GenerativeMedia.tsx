import { useMemo } from 'react';
import { usePrefersReducedMotion } from '@/hooks/useEnvironment';
import { seededRandom } from '@/lib/utils';
import { MediaFrame } from '../MediaFrame';
import type { AdapterProps } from '../types';

/**
 * Built-in animated scenes.
 *
 * Demo placeholders that move — used where a real film would sit, so the
 * portfolio feels alive before any footage is attached. Pure SVG + CSS: no
 * downloads, no decode cost, and it pauses under prefers-reduced-motion.
 *
 * This adapter also exists as the worked example for "how to add a new media
 * type": one entry in `mediaTypes`, one component, one line in the registry.
 */
export function GenerativeMedia({ media, seed, mode }: AdapterProps) {
  const reduced = usePrefersReducedMotion();
  const scene = media.scene ?? 'signal';

  const body = (
    <div className="media-scene" data-scene={scene} data-static={reduced || undefined}>
      <Scene name={scene} seed={`${seed}-${media.id}`} />
      <span className="media-scene__label mono">Generated scene · {scene}</span>
    </div>
  );

  if (mode === 'card' || mode === 'focus') return body;

  return (
    <MediaFrame
      aspect={media.aspect ?? '16:9'}
      title={media.title}
      caption={media.caption}
      credit={media.credit}
      demo={media.demo}
      kindLabel="Motion"
    >
      {body}
    </MediaFrame>
  );
}

function Scene({ name, seed }: { name: NonNullable<AdapterProps['media']['scene']>; seed: string }) {
  const rand = useMemo(() => seededRandom(seed), [seed]);
  const bars = useMemo(() => Array.from({ length: 9 }, () => 20 + rand() * 120), [rand]);

  if (name === 'marquee') {
    return (
      <svg viewBox="0 0 320 180" className="scene" role="img" aria-label="Animated billboard scene">
        <rect width="320" height="180" fill="#0a0a0c" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} className="scene__col" style={{ animationDelay: `${i * -1.6}s` }}>
            <rect x={12 + i * 62} y="0" width="52" height="180" fill="rgba(242,237,228,0.03)" />
            <rect x={12 + i * 62} y={i % 2 ? 20 : 60} width="52" height="46" fill="var(--c-creative)" opacity="0.85" />
            <rect x={12 + i * 62} y={i % 2 ? 78 : 118} width="52" height="10" fill="rgba(242,237,228,0.5)" />
            <rect x={12 + i * 62} y={i % 2 ? 94 : 134} width="34" height="6" fill="rgba(242,237,228,0.22)" />
          </g>
        ))}
        <rect x="0" y="150" width="320" height="30" fill="#050506" />
        <g className="scene__ticker">
          <text x="0" y="170" className="scene__type" fill="rgba(242,237,228,0.55)">
            TIMES SQUARE · BILLBOARD CUT · 06s · SILENT · TIMES SQUARE · BILLBOARD CUT · 06s · SILENT ·
          </text>
        </g>
      </svg>
    );
  }

  if (name === 'campaign') {
    return (
      <svg viewBox="0 0 320 180" className="scene" role="img" aria-label="Animated typographic scene">
        <rect width="320" height="180" fill="#0a0a0c" />
        <g className="scene__slide">
          <rect x="20" y="34" width="180" height="18" fill="var(--c-marketing)" opacity="0.9" />
          <rect x="20" y="62" width="120" height="18" fill="rgba(242,237,228,0.22)" />
          <rect x="20" y="90" width="224" height="18" fill="rgba(242,237,228,0.1)" />
        </g>
        <g className="scene__slide scene__slide--alt">
          <rect x="20" y="124" width="86" height="6" fill="rgba(242,237,228,0.4)" />
          <rect x="118" y="124" width="46" height="6" fill="var(--c-creative)" />
        </g>
        <circle cx="268" cy="66" r="28" fill="none" stroke="var(--c-creative)" strokeWidth="2" className="scene__pulse" />
      </svg>
    );
  }

  if (name === 'grid') {
    return (
      <svg viewBox="0 0 320 180" className="scene" role="img" aria-label="Animated grid scene">
        <rect width="320" height="180" fill="#0a0a0c" />
        {Array.from({ length: 24 }, (_, i) => (
          <rect
            key={i}
            className="scene__cell"
            x={20 + (i % 8) * 36}
            y={24 + Math.floor(i / 8) * 46}
            width="28"
            height="34"
            fill="var(--c-digital)"
            opacity="0.12"
            style={{ animationDelay: `${(i % 8) * 0.12 + Math.floor(i / 8) * 0.2}s` }}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 180" className="scene" role="img" aria-label="Animated waveform scene">
      <rect width="320" height="180" fill="#0a0a0c" />
      {bars.map((height, i) => (
        <rect
          key={i}
          className="scene__bar"
          x={22 + i * 32}
          y={(180 - height) / 2}
          width="14"
          height={height}
          fill={i === 4 ? 'var(--c-creative)' : 'rgba(242,237,228,0.2)'}
          style={{ animationDelay: `${i * 0.09}s` }}
        />
      ))}
      <circle cx="160" cy="90" r="64" fill="none" stroke="rgba(242,237,228,0.1)" strokeWidth="1" className="scene__pulse" />
    </svg>
  );
}
