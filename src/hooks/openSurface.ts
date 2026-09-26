/**
 * Where an "open this" request is allowed to land.
 *
 * ASAAD.OS has two shells. The desktop opens things as draggable windows; mobile
 * opens them as full-screen sheets. Every app component is shared between them,
 * so an app cannot be the thing that knows which is which — and for a while one
 * of them did know, by accident, which is how the mobile folder bug happened:
 *
 *   MobileShell opened a folder as a sheet containing `ProjectsApp`. Tapping a
 *   project inside it called `useOpenTarget().openProject`, which calls
 *   `openWindow` on the OS store — a DESKTOP window. Nothing on mobile renders
 *   the window layer, so the tap looked dead; the window was real, sitting in
 *   state, and appeared the moment the viewport got wide enough to draw it.
 *   Meanwhile a project tapped on the mobile home screen worked, because that
 *   one call site bypassed `useOpenTarget` and pushed a sheet directly. Two
 *   paths, one of them wrong, and no way to tell from inside `ProjectsApp`.
 *
 * So the *shell* declares how opening works, once, and `useOpenTarget` asks.
 * Absent (the desktop) means "open a window". Present (mobile) means "present it
 * however I present things". Every call site — home screen, folder, palette,
 * Quick View, a link inside a note — now travels the same road, which is what
 * makes it impossible for the two to drift apart again.
 */
import { createContext, useContext } from 'react';
import type { OpenSpec } from '@/state/os';

/** Receives exactly what `openWindow` receives; geometry is advisory. */
export type OpenSurface = (spec: OpenSpec) => void;

export const OpenSurfaceContext = createContext<OpenSurface | null>(null);

export function useOpenSurface(): OpenSurface | null {
  return useContext(OpenSurfaceContext);
}
