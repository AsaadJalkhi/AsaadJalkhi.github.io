/**
 * Reaction-time widget.
 *
 * The one game on the desktop, and it is kept deliberately tiny: press start,
 * wait for the panel to turn blue, press it again, see how many milliseconds
 * that took. Best score is remembered in localStorage. That is the entire
 * feature — no levels, no sound, no leaderboard, no network, no dependencies.
 *
 * It reads as an OS widget rather than a browser game because it never leaves
 * its own 200px card and never animates beyond a colour change.
 *
 * Interaction notes:
 *  - Pointer Events, so mouse, touch and pen all work from one handler.
 *  - The whole card is the target, because a small button is a test of aiming
 *    rather than of reacting.
 *  - `pointerdown` is the trigger, not `click`: click waits for the release and
 *    would add ~50ms of the visitor's own finger to every score.
 *  - Pressing during the wait is a false start, and says so.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { readStore, storageKeys, writeStore } from '@/lib/storage';

type Phase = 'idle' | 'waiting' | 'ready' | 'scored' | 'early';

const MIN_WAIT_MS = 900;
const MAX_WAIT_MS = 2600;

const COPY: Record<Phase, { hint: string; action: string }> = {
  idle: { hint: 'Wait for blue, then tap.', action: 'Start' },
  waiting: { hint: 'Wait for it…', action: '—' },
  ready: { hint: 'Now.', action: 'Tap' },
  scored: { hint: 'Nicely done.', action: 'Again' },
  early: { hint: 'Too early — wait for blue.', action: 'Again' },
};

export function ReactionWidget({ title }: { title?: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(() =>
    readStore<number | null>(storageKeys.reactionBest, null),
  );

  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => clear, [clear]);

  const arm = useCallback(() => {
    clear();
    setScore(null);
    setPhase('waiting');
    const wait = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
    timer.current = window.setTimeout(() => {
      startedAt.current = performance.now();
      setPhase('ready');
    }, wait);
  }, [clear]);

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    // The widget sits on a draggable surface; a press here is a move in the
    // game, not the start of a drag.
    event.stopPropagation();

    if (phase === 'waiting') {
      clear();
      setPhase('early');
      return;
    }

    if (phase === 'ready') {
      const ms = Math.round(performance.now() - startedAt.current);
      setScore(ms);
      setPhase('scored');
      if (best === null || ms < best) {
        setBest(ms);
        writeStore(storageKeys.reactionBest, ms);
      }
      return;
    }

    arm();
  };

  const copy = COPY[phase];

  return (
    <>
      <span className="widget__label">{title ?? 'Reaction'}</span>

      <button
        type="button"
        className="reaction"
        data-phase={phase}
        onPointerDown={press}
        aria-live="polite"
        aria-label={
          phase === 'scored' && score !== null
            ? `Reaction time ${score} milliseconds. Press to try again.`
            : `Reaction test. ${copy.hint}`
        }
      >
        <span className="reaction__read">
          {phase === 'scored' && score !== null ? `${score} ms` : copy.action}
        </span>
        <span className="reaction__hint">{copy.hint}</span>
      </button>

      {best !== null && <span className="reaction__best">Best {best} ms</span>}
    </>
  );
}
