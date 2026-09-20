/**
 * ASAAD.OS window manager + shell state.
 *
 * One store holds everything the shell needs: which view is active
 * (boot / desktop / quick view), open windows, z-order and UI preferences.
 * Windows are identified by a derived key so opening the same project twice
 * focuses the existing window instead of stacking duplicates.
 */
import { create } from 'zustand';
import type { Discipline } from '@/types/content';
import { clamp } from '@/lib/utils';
import { topSafeArea } from '@/lib/chrome';
import { readStore, storageKeys, writeStore, clearStore } from '@/lib/storage';

/**
 * Every app the shell can open. Kept as a value (not just a union type) so the
 * Studio can offer them in a dropdown without importing the app registry.
 */
export const APP_IDS = [
  'projects',
  'project',
  'note',
  'media',
  'browser',
  'about',
  'cv',
  'contact',
  'skills',
  'experience',
  'alert',
] as const;

export type AppId = (typeof APP_IDS)[number];

export interface WindowPayload {
  folderId?: string;
  projectId?: string;
  noteId?: string;
  mediaId?: string;
  alertId?: string;
  url?: string;
}

export type Theme = 'light' | 'dark';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInstance extends Box {
  id: string;
  key: string;
  app: AppId;
  title: string;
  subtitle?: string;
  payload: WindowPayload;
  z: number;
  minimized: boolean;
  maximized: boolean;
  /** Box to restore to when un-maximising. */
  restore?: Box;
  accent?: Discipline;
  resizable: boolean;
}

export interface OpenSpec {
  app: AppId;
  title: string;
  subtitle?: string;
  payload?: WindowPayload;
  box?: Partial<Box>;
  accent?: Discipline;
  resizable?: boolean;
}

export type ShellView = 'boot' | 'desktop' | 'quickview';

const MIN_W = 320;
const MIN_H = 200;
const CASCADE = 28;

function keyOf(app: AppId, payload: WindowPayload): string {
  return [
    app,
    payload.folderId,
    payload.projectId,
    payload.noteId,
    payload.mediaId,
    payload.alertId,
    payload.url,
  ]
    .map((part) => part ?? '')
    .join('|');
}

/** Default size per app — tuned so the initial desktop composition reads well. */
const defaultBox: Record<AppId, { width: number; height: number }> = {
  projects: { width: 760, height: 500 },
  project: { width: 860, height: 620 },
  note: { width: 400, height: 340 },
  media: { width: 620, height: 440 },
  browser: { width: 780, height: 520 },
  about: { width: 620, height: 520 },
  cv: { width: 660, height: 620 },
  contact: { width: 520, height: 440 },
  skills: { width: 720, height: 520 },
  experience: { width: 700, height: 560 },
  alert: { width: 400, height: 250 },
};

interface OsState {
  view: ShellView;
  booted: boolean;
  windows: WindowInstance[];
  topZ: number;
  paletteOpen: boolean;
  cursorEnabled: boolean;
  /**
   * null = the visitor has never chosen. The shell then follows the content
   * file's default, which keeps "light by default" a content decision rather
   * than a hard-coded one.
   */
  theme: Theme | null;
  spawnIndex: number;
  /** Bumped whenever the desktop is reset, to remount icon positions. */
  desktopEpoch: number;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setView: (view: ShellView) => void;
  finishBoot: () => void;
  openWindow: (spec: OpenSpec) => string;
  closeWindow: (id: string) => void;
  closeAll: () => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMinimize: (id: string) => void;
  toggleMaximize: (id: string, viewport: { width: number; height: number }) => void;
  setBox: (id: string, box: Partial<Box>) => void;
  cycleFocus: (direction: 1 | -1) => void;
  tidy: (viewport: { width: number; height: number }) => void;
  setPalette: (open: boolean) => void;
  togglePalette: () => void;
  setCursorEnabled: (enabled: boolean) => void;
  resetDesktop: () => void;
}

export const useOs = create<OsState>((set, get) => ({
  view: 'boot',
  booted: false,
  windows: [],
  topZ: 1,
  paletteOpen: false,
  cursorEnabled: readStore(storageKeys.cursor, true),
  theme: readStore<Theme | null>(storageKeys.theme, null),
  spawnIndex: 0,
  desktopEpoch: 0,

  setTheme: (theme) => {
    writeStore(storageKeys.theme, theme);
    set({ theme });
  },

  toggleTheme: () => {
    // Read the theme actually on the document, so the first click flips away
    // from what the visitor is looking at even when they've never chosen.
    const current =
      get().theme ??
      ((typeof document === 'undefined'
        ? 'light'
        : document.documentElement.dataset.theme) as Theme | undefined) ??
      'light';
    get().setTheme(current === 'dark' ? 'light' : 'dark');
  },

  setView: (view) => set({ view, paletteOpen: false }),

  finishBoot: () => {
    writeStore(storageKeys.booted, true);
    set({ booted: true, view: 'desktop' });
  },

  openWindow: (spec) => {
    const payload = spec.payload ?? {};
    const key = keyOf(spec.app, payload);
    const existing = get().windows.find((w) => w.key === key);

    if (existing) {
      const z = get().topZ + 1;
      set((state) => ({
        topZ: z,
        windows: state.windows.map((w) => (w.id === existing.id ? { ...w, z, minimized: false } : w)),
      }));
      return existing.id;
    }

    const size = defaultBox[spec.app];
    const index = get().spawnIndex;
    const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 900 : window.innerHeight;

    const width = clamp(spec.box?.width ?? size.width, MIN_W, Math.max(MIN_W, vw - 48));
    const height = clamp(spec.box?.height ?? size.height, MIN_H, Math.max(MIN_H, vh - 140));

    // Fractional x/y (0–1) are treated as a share of the viewport so the
    // content file can describe a composition that scales to any screen.
    const rawX = spec.box?.x;
    const rawY = spec.box?.y;
    const baseX =
      rawX === undefined
        ? vw / 2 - width / 2 + ((index % 5) - 2) * CASCADE
        : rawX > 0 && rawX <= 1
          ? rawX * vw
          : rawX;
    const baseY =
      rawY === undefined
        ? vh / 2 - height / 2 + ((index % 5) - 2) * CASCADE
        : rawY > 0 && rawY <= 1
          ? rawY * vh
          : rawY;

    const z = get().topZ + 1;
    const instance: WindowInstance = {
      id: `w-${key}-${index}`,
      key,
      app: spec.app,
      title: spec.title,
      subtitle: spec.subtitle,
      payload,
      x: clamp(baseX, 8, Math.max(8, vw - width - 8)),
      y: clamp(baseY, topSafeArea(), Math.max(topSafeArea(), vh - height - 80)),
      width,
      height,
      z,
      minimized: false,
      maximized: false,
      accent: spec.accent,
      resizable: spec.resizable ?? true,
    };

    set((state) => ({
      windows: [...state.windows, instance],
      topZ: z,
      spawnIndex: index + 1,
    }));
    return instance.id;
  },

  closeWindow: (id) => set((state) => ({ windows: state.windows.filter((w) => w.id !== id) })),

  closeAll: () => set({ windows: [] }),

  focusWindow: (id) =>
    set((state) => {
      const target = state.windows.find((w) => w.id === id);
      if (!target || (target.z === state.topZ && !target.minimized)) return state;
      const z = state.topZ + 1;
      return {
        topZ: z,
        windows: state.windows.map((w) => (w.id === id ? { ...w, z, minimized: false } : w)),
      };
    }),

  minimizeWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
    })),

  restoreWindow: (id) => {
    get().focusWindow(id);
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, minimized: false } : w)),
    }));
  },

  toggleMinimize: (id) => {
    const target = get().windows.find((w) => w.id === id);
    if (!target) return;
    if (target.minimized) get().restoreWindow(id);
    else get().minimizeWindow(id);
  },

  toggleMaximize: (id, viewport) =>
    set((state) => {
      const z = state.topZ + 1;
      return {
        topZ: z,
        windows: state.windows.map((w) => {
          if (w.id !== id) return w;
          if (w.maximized && w.restore) {
            return { ...w, ...w.restore, maximized: false, restore: undefined, z };
          }
          return {
            ...w,
            restore: { x: w.x, y: w.y, width: w.width, height: w.height },
            x: 12,
            y: topSafeArea(),
            width: viewport.width - 24,
            height: viewport.height - topSafeArea() - 84,
            maximized: true,
            z,
          };
        }),
      };
    }),

  setBox: (id, box) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, ...box } : w)),
    })),

  cycleFocus: (direction) => {
    const visible = get()
      .windows.filter((w) => !w.minimized)
      .sort((a, b) => a.z - b.z);
    if (visible.length < 2) return;
    const next = direction === 1 ? visible[0] : visible[visible.length - 2];
    if (next) get().focusWindow(next.id);
  },

  /**
   * "Tidy" — the OS pulling the chaos back into a readable grid. Also the
   * safety net that recovers any window dragged off screen.
   */
  tidy: (viewport) =>
    set((state) => {
      const open = state.windows.filter((w) => !w.minimized);
      const cols = open.length > 4 ? 3 : Math.max(1, Math.min(open.length, 2));
      const rows = Math.ceil(open.length / cols) || 1;
      const pad = 16;
      const top = topSafeArea() + 8;
      const cellW = (viewport.width - pad * (cols + 1)) / cols;
      const cellH = (viewport.height - top - 84 - pad * (rows - 1)) / rows;

      let i = 0;
      return {
        windows: state.windows.map((w) => {
          if (w.minimized) return w;
          const col = i % cols;
          const row = Math.floor(i / cols);
          i += 1;
          return {
            ...w,
            x: pad + col * (cellW + pad),
            y: top + row * (cellH + pad),
            width: Math.max(MIN_W, cellW),
            height: Math.max(MIN_H, cellH),
            maximized: false,
            restore: undefined,
          };
        }),
      };
    }),

  setPalette: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),

  setCursorEnabled: (cursorEnabled) => {
    writeStore(storageKeys.cursor, cursorEnabled);
    set({ cursorEnabled });
  },

  resetDesktop: () => {
    clearStore();
    set((state) => ({
      windows: [],
      topZ: 1,
      spawnIndex: 0,
      paletteOpen: false,
      // Dragged icon positions and the theme choice live in the store we just
      // wiped, so drop them here too rather than leaving stale state behind.
      theme: null,
      desktopEpoch: state.desktopEpoch + 1,
      view: 'desktop',
    }));
  },
}));

/** Has this browser seen the boot sequence before? */
export function hasBootedBefore(): boolean {
  return readStore(storageKeys.booted, false);
}
