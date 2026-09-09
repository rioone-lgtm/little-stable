import test from 'node:test';
import assert from 'node:assert/strict';
import {
  environmentAt,
  parseWeather,
  describeWeather,
} from '../lib/stable/environment.ts';
import { createSimulation } from '../lib/stable/simulation.ts';
const sample = {
  current: {
    weather_code: 65,
    temperature_2m: 23.4,
    cloud_cover: 92,
    precipitation: 2.7,
    time: 1788870600,
  },
  daily: {
    sunrise: [1788812401, 1788898847],
    sunset: [1788858126, 1788944437],
  },
};

test('weather codes, missing values and unknown codes are handled', () => {
  assert.equal(parseWeather(sample).kind, 'rain');
  assert.equal(describeWeather(75).kind, 'snow');
  assert.equal(describeWeather(95).kind, 'storm');
  assert.equal(describeWeather(45).kind, 'fog');
  assert.equal(describeWeather(999).kind, 'unknown');
  assert.throws(() => parseWeather({}));
  assert.throws(() =>
    parseWeather({
      ...sample,
      current: { ...sample.current, temperature_2m: null },
    }),
  );
  assert.throws(() =>
    parseWeather({ ...sample, daily: { sunrise: [], sunset: [] } }),
  );
});
test('clock uses JST and real sunrise/sunset, with honest stale state', () => {
  const weather = parseWeather(sample);
  const night = environmentAt(Date.parse('2026-09-08T13:00:00Z'), weather);
  assert.equal(night.clock, '22:00');
  assert.equal(night.period, 'night');
  assert.equal(night.daylight, 0);
  assert.equal(night.stale, false);
  assert.equal(
    environmentAt(weather.observedAt + 61 * 60000, weather).stale,
    true,
  );
  assert.equal(
    environmentAt(Date.parse('2026-09-08T03:00:00Z'), weather).daylight,
    1,
  );
  assert.ok(
    Math.abs(environmentAt(weather.sunrise[0], weather).daylight - 0.5) < 0.001,
  );
  assert.equal(
    environmentAt(Date.parse('2026-09-08T22:00:00Z')).period,
    'morning',
  );
  assert.equal(environmentAt(Date.now(), null, true).weather, null);
});
test('night has a resting majority while two night owls graze and run', () => {
  const morning = createSimulation(9817, 8),
    night = createSimulation(9817, 22);
  assert.equal(night.counts().rest, 8);
  assert.equal(night.counts().graze, 1);
  assert.equal(night.counts().run, 1);
  assert.equal(morning.counts().rest, 2);
  assert.ok(morning.counts().run >= 4);
  let morningRest = 0,
    nightRest = 0;
  for (let i = 0; i < 3600; i++) {
    morning.update(1);
    night.update(1);
    morningRest += morning.counts().rest;
    nightRest += night.counts().rest;
  }
  assert.ok(nightRest > morningRest * 2);
  assert.ok(nightRest / 3600 > 6);
  for (const h of night.horses.slice(8)) {
    assert.ok(h.visits.graze > 0);
    assert.ok(h.visits.run > 0);
  }
});
test('changing time of day preserves position and gradually brings horses home', () => {
  const sim = createSimulation(7, 8);
  const before = sim.horses.map((h) => [h.x, h.z]);
  sim.setHour(22);
  assert.deepEqual(
    sim.horses.map((h) => [h.x, h.z]),
    before,
  );
  for (let i = 0; i < 6000; i++) sim.update(0.1);
  assert.ok(sim.counts().rest >= 6);
});
