/**
 * What the phone / tablet home screen shows, derived from content that already
 * exists. Pure, so the rules are asserted on real arrays by check-ui.
 *
 * Nothing here is a second copy of anything: the icons are the folders, in
 * folder order; the widgets are references into `desktop.widgets`; the artwork
 * is the same file the desktop draws. `settings.mobileHome` only chooses among
 * those, and when it is absent the fallbacks below apply at runtime — they are
 * never written back into the content.
 */
import type { Folder, IconSpec, MobileHome, Portfolio, Widget } from '@/types/content';
import { orderedFolders } from './projectOrder';

export const MOBILE_HOME_DEFAULTS = {
  phoneColumns: 4,
  tabletColumns: 6,
  area: 'top',
} as const;

export interface HomeColumns {
  phone: number;
  tablet: number;
}

export function mobileColumns(home: MobileHome | undefined): HomeColumns {
  return {
    phone: home?.phoneColumns ?? MOBILE_HOME_DEFAULTS.phoneColumns,
    tablet: home?.tabletColumns ?? MOBILE_HOME_DEFAULTS.tabletColumns,
  };
}

export interface HomeWidget {
  widget: Widget;
  area: 'top' | 'afterApps';
}

/**
 * The widgets on the home screen, in the configured order. Every one is a
 * square; there is no size to resolve.
 *
 * Absent `widgets` means "the default": the desktop's first clock, then its
 * first weather widget, side by side at the top — whichever of the two exist.
 * An empty array is a deliberate "none". A reference to a widget that no
 * longer exists is skipped here (the validator reports it; the home screen
 * must not crash on it).
 */
export function mobileWidgets(
  home: MobileHome | undefined,
  widgets: readonly Widget[],
): HomeWidget[] {
  if (!home?.widgets) {
    return (['clock', 'weather'] as const).flatMap((type) => {
      const widget = widgets.find((candidate) => candidate.type === type);
      return widget ? [{ widget, area: MOBILE_HOME_DEFAULTS.area }] : [];
    });
  }
  const out: HomeWidget[] = [];
  const seen = new Set<string>();
  for (const entry of home.widgets) {
    const widget = widgets.find((candidate) => candidate.id === entry.widgetId);
    if (!widget || seen.has(widget.id)) continue;
    seen.add(widget.id);
    out.push({ widget, area: entry.area ?? MOBILE_HOME_DEFAULTS.area });
  }
  return out;
}

/**
 * A folder's artwork: its own `icon` if it has one, otherwise the icon on the
 * desktop shortcut that opens it. Most folders are given their logo on the
 * desktop shortcut, so without the second step the phone would show a generic
 * glyph where the desktop shows the brand.
 */
export function folderIcon(
  folder: Folder,
  items: Portfolio['desktop']['items'],
): IconSpec | undefined {
  if (folder.icon) return folder.icon;
  return items.find((item) => item.target.type === 'folder' && item.target.value === folder.id)
    ?.icon;
}

/** Same per-theme rule as the desktop: one file per theme, legacy `image` for either. */
export function iconSource(icon: IconSpec | undefined, theme: 'light' | 'dark'): string | undefined {
  return theme === 'dark'
    ? (icon?.imageDark ?? icon?.image ?? icon?.imageLight)
    : (icon?.imageLight ?? icon?.image ?? icon?.imageDark);
}

export interface HomeApp {
  /** `null` is All Work: the Work window with no folder filter. */
  folderId: string | null;
  label: string;
  icon: IconSpec | undefined;
}

/** All Work first, then every folder in the existing folder order. */
export function mobileApps(
  folders: readonly Folder[],
  items: Portfolio['desktop']['items'],
  allWorkLabel: string,
): HomeApp[] {
  return [
    { folderId: null, label: allWorkLabel, icon: undefined },
    ...orderedFolders(folders).map((folder) => ({
      folderId: folder.id,
      label: folder.name,
      icon: folderIcon(folder, items),
    })),
  ];
}
