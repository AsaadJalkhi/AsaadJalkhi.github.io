/**
 * Studio PIN gate.
 *
 * ⚠️ THIS IS NOT SECURITY, AND IT IS NOT TRYING TO BE.
 *
 * ASAAD.OS is a static site. There is no server, no session, no way to check a
 * secret without shipping it: the configured PIN is compiled into the same
 * JavaScript bundle the browser downloads, and anyone who opens devtools can
 * read it in about ten seconds. Treat this as a closed door on a room in your
 * own house — it stops people wandering in, and that is the entire goal.
 *
 * If content genuinely must not be touched, the answer is not a longer PIN —
 * it is to build without the Studio, or to keep the deployed copy read-only and
 * edit `portfolio.json` locally.
 *
 * With no PIN configured the gate is skipped entirely. The unlock is kept in
 * sessionStorage, so it lasts as long as the tab and no longer.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { usePortfolio } from '@/state/portfolio';
import { readSession, sessionKeys, writeSession } from '@/lib/storage';

export function PinGate({ children }: { children: React.ReactNode }) {
  const { settings } = usePortfolio();
  const pin = settings.studioPin;

  const [unlocked, setUnlocked] = useState(() =>
    pin ? readSession(sessionKeys.studioUnlocked, false) : true,
  );
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  // Removing the PIN in the Studio should unlock immediately, not next reload.
  useEffect(() => {
    if (!pin) setUnlocked(true);
  }, [pin]);

  if (unlocked) return <>{children}</>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (entry === pin) {
      writeSession(sessionKeys.studioUnlocked, true);
      setUnlocked(true);
      return;
    }
    setWrong(true);
    setEntry('');
    window.setTimeout(() => setWrong(false), 600);
  };

  return (
    <div className="pin">
      <form className="pin__panel" onSubmit={submit} data-wrong={wrong || undefined}>
        <span className="pin__icon">
          <Lock strokeWidth={1.5} />
        </span>

        <h1 className="pin__title">Studio is locked</h1>
        <p className="pin__lede">Enter the passcode to edit content.</p>

        <input
          ref={inputRef}
          className="pin__input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={entry}
          placeholder="••••"
          aria-label="Studio passcode"
          onChange={(event) => setEntry(event.target.value.replace(/\D/g, ''))}
        />

        <button type="submit" className="pin__submit" disabled={entry.length < 4}>
          Unlock
        </button>

        <p className="pin__note">
          A privacy gate, not real security — this site is static, so the code lives in the page.
        </p>
      </form>
    </div>
  );
}
