/**
 * The desktop background.
 *
 * Quiet on purpose: a stage for the work, not a feature. No slogan, no grid,
 * no glowing orbs — just a soft falloff and a vignette, the way a real
 * machine's wallpaper sits behind windows without competing with them.
 *
 * Both themes are rendered at once and cross-faded by opacity, so switching
 * mode eases from one background into the other instead of hard-cutting. Each
 * layer falls back to a pure-CSS gradient, and only uses an image when
 * `settings.theme.wallpaperLight` / `wallpaperDark` point at one — so the site
 * looks finished before any artwork is dropped in.
 */
import { usePortfolio } from '@/state/portfolio';
import { useResolvedTheme } from '@/hooks/useTheme';
import { asset } from '@/lib/paths';

export function Wallpaper() {
  const { settings } = usePortfolio();
  const theme = useResolvedTheme();

  const light = asset(settings.theme.wallpaperLight);
  const dark = asset(settings.theme.wallpaperDark);

  return (
    <div className="wallpaper" aria-hidden="true">
      <div
        className="wallpaper__layer wallpaper__layer--light"
        data-active={theme === 'light'}
        style={light ? { backgroundImage: `url(${light})` } : undefined}
      />
      <div
        className="wallpaper__layer wallpaper__layer--dark"
        data-active={theme === 'dark'}
        style={dark ? { backgroundImage: `url(${dark})` } : undefined}
      />
      <div className="wallpaper__vignette" />
    </div>
  );
}
