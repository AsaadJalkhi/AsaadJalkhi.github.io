/**
 * Weather widget — the place, the temperature, one word and one icon.
 *
 * The one widget that touches the network, so it is built to fail quietly: the
 * data comes from `lib/weather`, which never throws, and every state keeps the
 * same footprint — loading shows the place and a dash, failure shows the place
 * and "Weather unavailable". It fetches once on mount and then every 30 minutes
 * while mounted; a failed request is not retried sooner than that.
 *
 * The place is authored (`latitude` / `longitude` in the content). The visitor's
 * location is never requested. No forecast, no hourly graph — a home-screen
 * widget, not a weather app.
 */
import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { WEATHER_REFRESH_MS, loadWeather, type Weather, type WeatherKind } from '@/lib/weather';

const ICONS: Record<WeatherKind, { day: LucideIcon; night: LucideIcon }> = {
  clear: { day: Sun, night: Moon },
  partly: { day: CloudSun, night: CloudMoon },
  cloudy: { day: Cloud, night: Cloud },
  fog: { day: CloudFog, night: CloudFog },
  drizzle: { day: CloudDrizzle, night: CloudDrizzle },
  rain: { day: CloudRain, night: CloudRain },
  snow: { day: CloudSnow, night: CloudSnow },
  storm: { day: CloudLightning, night: CloudLightning },
};

type State = { status: 'loading' } | { status: 'ready'; weather: Weather } | { status: 'failed' };

export function WeatherWidget({
  title,
  latitude,
  longitude,
}: {
  title?: string;
  latitude?: number;
  longitude?: number;
}) {
  const [fetched, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    const controller = new AbortController();
    const refresh = () =>
      loadWeather(latitude, longitude, controller.signal).then((weather) => {
        if (controller.signal.aborted) return;
        // A failed refresh keeps the last good reading rather than blanking it.
        setState((previous) =>
          weather
            ? { status: 'ready', weather }
            : previous.status === 'ready'
              ? previous
              : { status: 'failed' },
        );
      });
    refresh();
    const interval = window.setInterval(refresh, WEATHER_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [latitude, longitude]);

  const place = title ?? 'Weather';
  // Without a place there is nothing to ask for; the validator reports it.
  const state: State =
    latitude === undefined || longitude === undefined ? { status: 'failed' } : fetched;

  if (state.status !== 'ready') {
    const failed = state.status === 'failed';
    return (
      <div className="weather" data-state={state.status} aria-busy={!failed}>
        <span className="widget__label">{place}</span>
        <span className="weather__temp" aria-hidden="true">
          —
        </span>
        <span className="weather__cond">
          {failed && <CloudOff className="weather__icon" strokeWidth={1.6} aria-hidden="true" />}
          {failed ? 'Weather unavailable' : 'Loading weather…'}
        </span>
      </div>
    );
  }

  const { weather } = state;
  const Icon = ICONS[weather.kind][weather.isDay ? 'day' : 'night'];
  return (
    <div className="weather" data-state="ready">
      <span className="widget__label">{place}</span>
      <span className="weather__temp">{weather.temperature}°</span>
      <span className="weather__cond">
        <Icon className="weather__icon" strokeWidth={1.6} aria-hidden="true" />
        {weather.label}
      </span>
      {weather.high !== undefined && weather.low !== undefined && (
        <span className="weather__range">
          H {weather.high}° · L {weather.low}°
        </span>
      )}
    </div>
  );
}
