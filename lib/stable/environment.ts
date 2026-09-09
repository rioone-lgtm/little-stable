import { DEFAULT_LOCATION, type FarmLocation } from './config';
export type WeatherKind =
  | 'clear'
  | 'cloud'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';
export type Weather = {
  code: number;
  kind: WeatherKind;
  label: string;
  temperature: number;
  cloud: number;
  precipitation: number;
  observedAt: number;
  sunrise: number[];
  sunset: number[];
};
export type Environment = {
  hour: number;
  period: 'morning' | 'day' | 'evening' | 'night';
  daylight: number;
  clock: string;
  weather: Weather | null;
  stale: boolean;
};
export function weatherUrl(location: FarmLocation = DEFAULT_LOCATION) {
  const query = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,weather_code,cloud_cover,precipitation',
    daily: 'sunrise,sunset',
    timezone: location.timezone,
    timeformat: 'unixtime',
    forecast_days: '2',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + query;
}
export const WEATHER_URL = weatherUrl();
export type EnvironmentOptions = {
  initialWeather?: Weather | null;
  polling?: boolean;
  location?: FarmLocation;
};
export function describeWeather(code: number): {
  kind: WeatherKind;
  label: string;
} {
  if (code === 0) return { kind: 'clear', label: '快晴' };
  if (code === 1) return { kind: 'clear', label: '晴れ' };
  if (code === 2 || code === 3)
    return { kind: 'cloud', label: code === 2 ? '晴れ時々曇り' : '曇り' };
  if (code === 45 || code === 48) return { kind: 'fog', label: '霧' };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { kind: 'snow', label: '雪' };
  if ([95, 96, 99].includes(code)) return { kind: 'storm', label: '雷雨' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { kind: 'rain', label: '雨' };
  return { kind: 'unknown', label: '天気不明' };
}
export function parseWeather(data: unknown): Weather {
  const d = data as {
    current?: Record<string, number>;
    daily?: { sunrise: number[]; sunset: number[] };
  };
  const c = d?.current;
  if (
    !c ||
    ![
      'weather_code',
      'temperature_2m',
      'cloud_cover',
      'precipitation',
      'time',
    ].every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]))
  )
    throw new Error('Invalid weather data');
  if (c.cloud_cover < 0 || c.cloud_cover > 100 || c.precipitation < 0)
    throw new Error('Invalid weather range');
  const sunrise = d.daily?.sunrise,
    sunset = d.daily?.sunset;
  if (
    !Array.isArray(sunrise) ||
    !Array.isArray(sunset) ||
    !sunrise.length ||
    sunrise.length !== sunset.length ||
    !sunrise.every(
      (v, i) =>
        Number.isFinite(v) && Number.isFinite(sunset[i]) && sunset[i] > v,
    )
  )
    throw new Error('Invalid solar data');
  return {
    code: c.weather_code,
    ...describeWeather(c.weather_code),
    temperature: c.temperature_2m,
    cloud: c.cloud_cover,
    precipitation: c.precipitation,
    observedAt: c.time * 1000,
    sunrise: sunrise.map((v) => v * 1000),
    sunset: sunset.map((v) => v * 1000),
  };
}
export function timePeriod(hour: number): Environment['period'] {
  return hour >= 5 && hour < 11
    ? 'morning'
    : hour >= 11 && hour < 17
      ? 'day'
      : hour >= 17 && hour < 20
        ? 'evening'
        : 'night';
}
export function environmentAt(
  now: number,
  weather: Weather | null = null,
  failed = false,
  timezone = DEFAULT_LOCATION.timezone,
): Environment {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = (t: number) =>
    Object.fromEntries(
      formatter.formatToParts(t).map((p) => [p.type, p.value]),
    );
  const local = parts(now),
    hour = Number(local.hour) + Number(local.minute) / 60;
  const dayKey = (t: number) => {
    const p = parts(t);
    return p.year + '-' + p.month + '-' + p.day;
  };
  const i = weather?.sunrise.findIndex((t) => dayKey(t) === dayKey(now)) ?? -1;
  const rise = i >= 0 ? weather!.sunrise[i] : now + (6 - hour) * 3600000;
  const set = i >= 0 ? weather!.sunset[i] : now + (18 - hour) * 3600000;
  const ramp = 40 * 60000;
  const daylight = Math.max(
    0,
    Math.min(1, (now - rise + ramp / 2) / ramp, (set - now + ramp / 2) / ramp),
  );
  return {
    hour,
    period: timePeriod(hour),
    daylight,
    clock: local.hour + ':' + local.minute,
    weather,
    stale: failed || (!!weather && now - weather.observedAt > 60 * 60000),
  };
}
export function watchEnvironment(
  onChange: (e: Environment) => void,
  options: EnvironmentOptions = {},
) {
  let weather: Weather | null = options.initialWeather ?? null,
    failed = false,
    disposed = false,
    request: AbortController | null = null,
    lastAttempt = 0;
  const emit = () => {
    if (!disposed)
      onChange(
        environmentAt(Date.now(), weather, failed, options.location?.timezone),
      );
  };
  async function refresh() {
    if (options.polling === false || disposed || request || document.hidden)
      return;
    lastAttempt = Date.now();
    request = new AbortController();
    const active = request;
    const timeout = setTimeout(() => active.abort(), 10000);
    try {
      const response = await fetch(weatherUrl(options.location), {
        signal: active.signal,
      });
      if (!response.ok) throw new Error('Weather unavailable');
      weather = parseWeather(await response.json());
      failed = false;
    } catch {
      failed = true;
    } finally {
      clearTimeout(timeout);
      request = null;
      emit();
    }
  }
  const wake = () => {
    if (!document.hidden) {
      emit();
      if (Date.now() - lastAttempt > 15 * 60000) void refresh();
    }
  };
  emit();
  void refresh();
  const clock = setInterval(emit, 30000),
    poll =
      options.polling === false
        ? undefined
        : setInterval(() => void refresh(), 15 * 60000);
  document.addEventListener('visibilitychange', wake);
  return () => {
    disposed = true;
    request?.abort();
    clearInterval(clock);
    clearInterval(poll);
    document.removeEventListener('visibilitychange', wake);
  };
}
