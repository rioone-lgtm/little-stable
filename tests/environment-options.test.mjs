import test from 'node:test';
import assert from 'node:assert/strict';
import {
  environmentAt,
  weatherUrl,
  watchEnvironment,
} from '../lib/stable/environment.ts';
test('timezone is applied to both the clock and weather request', () => {
  const date = Date.parse('2026-09-09T03:00:00Z');
  assert.equal(
    environmentAt(date, null, false, 'America/New_York').clock,
    '23:00',
  );
  assert.equal(
    environmentAt(date, null, false, 'America/New_York').period,
    'night',
  );
  const url = new URL(
    weatherUrl({ latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' }),
  );
  assert.equal(url.searchParams.get('latitude'), '51.5');
  assert.equal(url.searchParams.get('timezone'), 'Europe/London');
});
test('injected weather is emitted synchronously with no fetch or polling when disabled', () => {
  const originals = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  let fetches = 0,
    intervals = 0,
    adds = 0,
    removes = 0,
    clears = 0,
    latest;
  globalThis.document = {
    hidden: false,
    addEventListener() {
      adds++;
    },
    removeEventListener() {
      removes++;
    },
  };
  globalThis.fetch = () => {
    fetches++;
    throw Error('Unexpected fetch');
  };
  globalThis.setInterval = () => {
    intervals++;
    return intervals;
  };
  globalThis.clearInterval = (id) => {
    if (id !== undefined) clears++;
  };
  try {
    const weather = {
      code: 0,
      kind: 'clear',
      label: '晴れ',
      temperature: 22,
      cloud: 0,
      precipitation: 0,
      observedAt: Date.now(),
      sunrise: [],
      sunset: [],
    };
    const stop = watchEnvironment((e) => (latest = e), {
      initialWeather: weather,
      polling: false,
    });
    assert.equal(latest.weather, weather);
    assert.equal(fetches, 0);
    assert.equal(intervals, 1);
    stop();
    assert.equal(adds, removes);
    assert.equal(clears, 1);
  } finally {
    Object.assign(globalThis, originals);
  }
});
