import { useEffect } from 'react';

export interface Hotkey {
  /** Lowercase key name, e.g. "k", "escape", "arrowdown". */
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void;
  /** Fire even while the user is typing in a field. Default false. */
  allowInInput?: boolean;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/** Global keyboard shortcuts. `meta` matches either Ctrl or Cmd. */
export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      for (const hotkey of hotkeys) {
        if (hotkey.key !== key) continue;
        if (Boolean(hotkey.meta) !== (event.metaKey || event.ctrlKey)) continue;
        if (Boolean(hotkey.shift) !== event.shiftKey) continue;
        if (Boolean(hotkey.alt) !== event.altKey) continue;
        if (!hotkey.allowInInput && isTyping(event.target)) continue;
        hotkey.handler(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, enabled]);
}
