/**
 * The weather widget's data: one request to Open-Meteo, read defensively.
 *
 * Open-Meteo needs no key and allows browser requests, so a static site can
 * call it directly with `fetch` — no backend, no secret, no dependency. The
 * place is authored in the content (`latitude` / `longitude` on the widget);
 * the visitor's location is never asked for.
 *
 * Nothing here throws. A failed request, an offline device or a response in an
 * unexpected shape all come back as `null`, and the widget says "Weather
 * unavailable" instead of breaking the home screen. Pure apart from `fetch`, so
 * check-ui runs it against real and malformed payloads.
 */

export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export interface Weather {
  /** °C, rounded. */
  temperature: number;
  high?: number;
  low?: number;
  kind: WeatherKind;
  label: string;
  isDay: boolean;
}

/** Half an hour: weather is not a ticker. Also how long a result is reused. */
export const WEATHER_REFRESH_MS = 30 * 60_000;
const TIMEOUT_MS = 10_000;

export function weatherUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** WMO weather codes, as Open-Meteo reports them, folded into eight looks. */
export function describeWeather(code: number, isDay: boolean): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: 'clear', label: isDay ? 'Sunny' : 'Clear' };
  if (code === 1 || code === 2) return { kind: 'partly', label: code === 1 ? 'Mostly clear' : 'Partly cloudy' };
  if (code === 3) return { kind: 'cloudy', label: 'Cloudy' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Fog' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'Drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return { kind: 'rain', label: code >= 80 ? 'Showers' : 'Rain' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', label: 'Snow' };
  if (code >= 95) return { kind: 'storm', label: 'Thunderstorm' };
  return { kind: 'cloudy', label: 'Cloudy' };
}

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** An Open-Meteo response → `Weather`, or `null` for anything it cannot trust. */
export function parseWeather(json: unknown): Weather | null {
  if (!json || typeof json !== 'object') return null;
  const { current, daily } = json as { current?: unknown; daily?: unknown };
  if (!current || typeof current !== 'object') return null;
  const now = current as Record<string, unknown>;
  const temperature = num(now.temperature_2m);
  const code = num(now.weather_code);
  if (temperature === undefined || code === undefined) return null;

  const isDay = now.is_day !== 0;
  const day = daily && typeof daily === 'object' ? (daily as Record<string, unknown>) : {};
  const first = (value: unknown) => (Array.isArray(value) ? num(value[0]) : undefined);
  const high = first(day.temperature_2m_max);
  const low = first(day.temperature_2m_min);

  return {
    temperature: Math.round(temperature),
    high: high === undefined ? undefined : Math.round(high),
    low: low === undefined ? undefined : Math.round(low),
    isDay,
    ...describeWeather(code, isDay),
  };
}

/*
 * One result per place, reused while it is fresh. The widget remounts whenever
 * the shell changes (desktop ⇄ phone width, Quick View and back); without this
 * every remount would be another request.
 */
const cache = new Map<string, { at: number; weather: Weather }>();

/** Resolves to `null` on any failure. Never rejects. */
export async function loadWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Weather | null> {
  const key = `${latitude},${longitude}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < WEATHER_REFRESH_MS) return hit.weather;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort);
  try {
    const response = await fetch(weatherUrl(latitude, longitude), { signal: timeout.signal });
    if (!response.ok) return null;
    const weather = parseWeather(await response.json());
    if (weather) cache.set(key, { at: Date.now(), weather });
    return weather;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
