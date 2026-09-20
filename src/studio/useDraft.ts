/**
 * Studio draft state.
 *
 * The draft starts as a clone of the shipped content, lives in memory (with a
 * localStorage backup so a refresh doesn't lose work), and is validated on
 * every change. Nothing here talks to a network: the Studio's only outputs are
 * a downloaded file and the clipboard.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SAVED DRAFT CARRIES A SIGNATURE (session 7 — read before simplifying)
 * ---------------------------------------------------------------------------
 * This file used to restore the localStorage draft whenever it merely *parsed*:
 *
 *     const saved = readStore(storageKeys.studioDraft, null);
 *     if (saved) { const p = validatePortfolio(saved); if (p.ok) return p.data; }
 *
 * That silently lost real content. A draft saved weeks earlier still validates
 * perfectly — it is just *old*. So after `portfolio.json` gained wallpapers,
 * widgets and the creative-app shortcuts, opening the Studio restored the stale
 * draft on top of the newer file, one unrelated edit was made, and Export wrote
 * the old state back over the new one. Nothing errored; the data was simply gone.
 *
 * The fix is to record WHAT the draft was based on. Every save is wrapped in an
 * envelope carrying a `baseSignature` — a stable fingerprint of the canonical
 * `portfolio.json` at the time the draft was started. On open:
 *
 *   no envelope                   → load the current portfolio
 *   baseSignature matches         → resume the draft (safe: same ancestor)
 *   baseSignature differs         → DO NOT LOAD IT. Hand the decision to a human
 *                                   via the recovery screen in StudioApp.
 *
 * The signature is computed from the *validated* portfolio, not the raw file, so
 * cosmetic reformatting of the JSON (whitespace, key order) does not spuriously
 * invalidate a good draft. Never make the stale case auto-load or auto-merge.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { rawPortfolio } from '@/lib/contentStore';
import { readStore, removeStore, storageKeys, writeStore } from '@/lib/storage';
import { validatePortfolio, type Portfolio, type ValidationResult } from '@/types/content';

export interface PanelProps {
  draft: Portfolio;
  update: Updater;
}

/** Mutate a structural clone — panels read like plain assignments. */
export type Updater = (mutate: (draft: Portfolio) => void) => void;

function baseline(): Portfolio {
  const parsed = validatePortfolio(rawPortfolio());
  if (!parsed.ok) {
    // Should be impossible: the app refuses to render with invalid content.
    throw new Error('Shipped content is invalid — fix portfolio.json first.');
  }
  return parsed.data;
}

/* ------------------------------------------------------------- signature */

/**
 * Stable JSON: object keys sorted at every depth, arrays left in order.
 *
 * Array order is meaningful content here (project order, desktop items), so it
 * is deliberately NOT sorted — reordering projects genuinely is a different
 * portfolio and should invalidate a draft based on the old order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => {
      const inner = (value as Record<string, unknown>)[key];
      return inner === undefined ? null : `${JSON.stringify(key)}:${stableStringify(inner)}`;
    })
    .filter(Boolean);
  return `{${entries.join(',')}}`;
}

/**
 * FNV-1a, 32-bit, hex. Not cryptographic and does not need to be — this only
 * has to answer "is this the same content I started from?", and a collision
 * would at worst resume a draft the human could still inspect and discard.
 * Chosen over SubtleCrypto because that is async and this runs in `useState`.
 */
function fingerprint(portfolio: Portfolio): string {
  const text = stableStringify(portfolio);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0') + `-${text.length.toString(36)}`;
}

/** What actually goes into localStorage. */
interface DraftEnvelope {
  /** Fingerprint of the canonical portfolio this draft was started from. */
  baseSignature: string;
  /** ISO timestamp of the last autosave. */
  savedAt: string;
  draft: unknown;
}

function isEnvelope(value: unknown): value is DraftEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DraftEnvelope).baseSignature === 'string' &&
    'draft' in value
  );
}

/**
 * A draft that exists but cannot be trusted. The Studio must show this to the
 * human and let them choose; it must never be loaded automatically.
 */
export interface StaleDraft {
  savedAt: string | null;
  /** Serialised draft, ready to download or adopt. */
  data: Portfolio;
}

export interface DraftApi {
  draft: Portfolio;
  update: Updater;
  validation: ValidationResult;
  dirty: boolean;
  json: string;
  reset: () => void;
  replace: (next: Portfolio) => void;
  importJson: (text: string) => { ok: true } | { ok: false; message: string };
  /** Set when a saved draft was based on a different portfolio.json. */
  staleDraft: StaleDraft | null;
  /** Discard the stale draft and keep the current portfolio (the safe default). */
  discardStaleDraft: () => void;
  /** Deliberately adopt the stale draft, at the human's request. */
  adoptStaleDraft: () => void;
  /** Throw the draft away and re-read src/content/portfolio.json. */
  reloadFromPortfolio: () => void;
}

/** Resolved once per mount: what we should open with, and what we must ask about. */
interface InitialState {
  draft: Portfolio;
  stale: StaleDraft | null;
  /** True when we resumed a matching saved draft (so autosave keeps going). */
  resumed: boolean;
}

function initialState(base: Portfolio, baseSignature: string): InitialState {
  const saved = readStore<unknown>(storageKeys.studioDraft, null);
  if (!saved) return { draft: base, stale: null, resumed: false };

  // Legacy saves (pre-session-7) are bare portfolios with no envelope. We cannot
  // know what they were based on, so they are stale by definition.
  const envelope = isEnvelope(saved)
    ? saved
    : ({ baseSignature: '', savedAt: '', draft: saved } satisfies DraftEnvelope);

  const parsed = validatePortfolio(envelope.draft);
  if (!parsed.ok) {
    // Unreadable draft: nothing to recover, and keeping it would re-prompt forever.
    removeStore(storageKeys.studioDraft);
    return { draft: base, stale: null, resumed: false };
  }

  if (envelope.baseSignature === baseSignature) {
    return { draft: parsed.data, stale: null, resumed: true };
  }

  return {
    draft: base,
    stale: { savedAt: envelope.savedAt || null, data: parsed.data },
    resumed: false,
  };
}

export function useDraft(): DraftApi {
  // The canonical file, and its fingerprint. Both are constant for the session:
  // portfolio.json is a build-time import and cannot change under us.
  const base = useMemo(baseline, []);
  const baseSignature = useMemo(() => fingerprint(base), [base]);

  const [initial] = useState(() => initialState(base, baseSignature));

  const [draft, setDraft] = useState<Portfolio>(initial.draft);
  const [staleDraft, setStaleDraft] = useState<StaleDraft | null>(initial.stale);
  const [dirty, setDirty] = useState(initial.resumed);

  const update = useCallback<Updater>((mutate) => {
    setDraft((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
    setDirty(true);
  }, []);

  const replace = useCallback((next: Portfolio) => {
    setDraft(next);
    setDirty(true);
  }, []);

  const reset = useCallback(() => {
    removeStore(storageKeys.studioDraft);
    setDraft(baseline());
    setStaleDraft(null);
    setDirty(false);
  }, []);

  /** "Reload from current portfolio" — same as reset, named for what it means. */
  const reloadFromPortfolio = reset;

  const discardStaleDraft = useCallback(() => {
    removeStore(storageKeys.studioDraft);
    setStaleDraft(null);
    setDirty(false);
  }, []);

  const adoptStaleDraft = useCallback(() => {
    setStaleDraft((current) => {
      if (current) setDraft(current.data);
      return null;
    });
    // Adopting re-bases the draft on the CURRENT portfolio signature, so the
    // human is asked once and not on every reload afterwards.
    setDirty(true);
  }, []);

  const importJson = useCallback(
    (text: string): { ok: true } | { ok: false; message: string } => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch (error) {
        return { ok: false, message: `Not valid JSON — ${(error as Error).message}` };
      }
      const result = validatePortfolio(parsedJson);
      if (!result.ok) {
        const list = result.issues.slice(0, 4).map((i) => `${i.path}: ${i.message}`).join(' · ');
        return { ok: false, message: `${result.issues.length} schema problem(s). ${list}` };
      }
      setDraft(result.data);
      setStaleDraft(null);
      setDirty(true);
      return { ok: true };
    },
    [],
  );

  // Keep a backup so an accidental refresh mid-edit isn't destructive. The
  // envelope is what makes that backup safe to restore later — see the header.
  useEffect(() => {
    if (!dirty) return;
    writeStore(storageKeys.studioDraft, {
      baseSignature,
      savedAt: new Date().toISOString(),
      draft,
    } satisfies DraftEnvelope);
  }, [draft, dirty, baseSignature]);

  const validation = useMemo(() => validatePortfolio(draft), [draft]);
  const json = useMemo(() => `${JSON.stringify(draft, null, 2)}\n`, [draft]);

  return {
    draft,
    update,
    validation,
    dirty,
    json,
    reset,
    replace,
    importJson,
    staleDraft,
    discardStaleDraft,
    adoptStaleDraft,
    reloadFromPortfolio,
  };
}
