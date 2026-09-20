/**
 * Startup.
 *
 * A product start-up, not a fake operating-system boot: the wordmark settles,
 * a hairline fills once, the screen hands over. Well under a second, skipped
 * entirely on `prefers-reduced-motion`, and interruptible by any key or click.
 * There are no boot logs, no terminal text and no progress percentage, because
 * none of that is true — the app is already loaded by the time you see this.
 *
 * The last `EXIT_MS` of the budget are the exit, not extra waiting: the layer
 * eases away while the timer is still running, so the total cost is `duration`.
 */
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/useEnvironment';

/** How much of the budget the fade-out takes. */
const EXIT_MS = 200;

export function BootSequence({
  osName,
  duration,
  onDone,
}: {
  osName: string;
  duration: number;
  onDone: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };

    if (reduced || duration <= 0) {
      finish();
      return;
    }

    const exitAt = Math.max(0, duration - EXIT_MS);
    const exit = window.setTimeout(() => setLeaving(true), exitAt);
    const timer = window.setTimeout(finish, duration);
    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);

    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(timer);
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
    };
  }, [duration, onDone, reduced]);

  return (
    <div
      className="boot"
      data-leaving={leaving || undefined}
      style={{ '--boot-ms': `${duration}ms` } as React.CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div className="boot__stack">
        <p className="boot__mark">{osName}</p>
        <span className="boot__line" aria-hidden="true" />
      </div>
    </div>
  );
}
