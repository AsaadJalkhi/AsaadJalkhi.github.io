/**
 * localStorage with guards. Private-mode browsers and blocked site data throw
 * on access, so every read and write is wrapped and falls back to a default.
 */
const NS = 'asaad-os';

export const storageKeys = {
  booted: `${NS}:booted`,
  theme: `${NS}:theme`,
  cursor: `${NS}:cursor`,
  /** Desktop icon + widget positions the visitor has dragged. */
  layout: `${NS}:layout`,
  studioDraft: `${NS}:studio-draft`,
  visits: `${NS}:visits`,
  /** Best time from the reaction widget. */
  reactionBest: `${NS}:reaction-best`,
} as const;

/** Studio unlock lives in sessionStorage — it expires with the tab. */
export const sessionKeys = {
  studioUnlocked: `${NS}:studio-unlocked`,
} as const;

export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the gate simply asks again */
  }
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — preferences simply don't persist */
  }
}

export function removeStore(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Wipes every ASAAD.OS key. Used by "Reset Desktop". */
export function clearStore(): void {
  try {
    Object.values(storageKeys).forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
