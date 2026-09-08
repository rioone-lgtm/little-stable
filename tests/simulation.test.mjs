import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSimulation,
  TRACK,
  stall,
  STALL_CAPACITY,
  trackPoint,
  TAU,
} from '../lib/simulation.ts';

test('15 distinct bays and 10 permanent assignments', () => {
  assert.equal(STALL_CAPACITY, 15);
  assert.equal(
    new Set(Array.from({ length: 15 }, (_, id) => JSON.stringify(stall(id))))
      .size,
    15,
  );
  assert.throws(() => stall(15));
  const sim = createSimulation();
  for (let step = 0; step < 2400 * 30; step++) {
    sim.update(1 / 30);
    for (const h of sim.horses)
      if (h.state === 'rest') {
        assert.equal(h.x, stall(h.id).x);
        assert.equal(h.z, stall(h.id).z);
      }
  }
});

test('all horses remain in bounds, graze in the infield and visit all activities', () => {
  for (const seed of [9817, 42, 773]) {
    const sim = createSimulation(seed);
    for (let step = 0; step < 2400 * 30; step++) {
      sim.update(1 / 30);
      assert.equal(
        Object.values(sim.counts()).reduce((a, b) => a + b),
        10,
      );
      for (const h of sim.horses) {
        assert.ok(Number.isFinite(h.x) && Number.isFinite(h.z));
        assert.ok(h.x > -10 && h.x < 10 && h.z > -19 && h.z < 15);
        const distance = Math.hypot(
          h.x - TRACK.x,
          Math.max(0, Math.abs(h.z - TRACK.z) - TRACK.straight),
        );
        if (h.state === 'run')
          assert.ok(
            Math.abs(distance - (TRACK.radius + ((h.id % 3) - 1) * 0.28)) <
              1e-8,
          );
        if (h.state === 'graze') assert.ok(distance < TRACK.radius - 1.8);
      }
    }
    for (const h of sim.horses)
      for (const visits of Object.values(h.visits)) assert.ok(visits > 0);
  }
});

test('all rail crossings use the opening and bay partitions are never crossed', () => {
  const sim = createSimulation();
  const distance = (h) =>
    Math.hypot(
      h.x - TRACK.x,
      Math.max(0, Math.abs(h.z - TRACK.z) - TRACK.straight),
    );
  for (let step = 0; step < 1800 * 30; step++) {
    const before = structuredClone(sim.horses);
    sim.update(1 / 30);
    sim.horses.forEach((h, i) => {
      const prev = before[i];
      for (const radius of [4.75, 7.25]) {
        if ((distance(prev) - radius) * (distance(h) - radius) < 0) {
          assert.ok(
            Math.abs(h.z - TRACK.z) < 0.01 && h.x > 4,
            'cross at the east gate',
          );
        }
      }
      if (
        (h.z > -12.25 || h.z < -13.75) &&
        h.z < -9.3 &&
        prev.z < -9.3 &&
        h.x < 7.5 &&
        prev.x < 7.5
      ) {
        assert.ok(
          Math.abs(h.x - prev.x) < 1e-9,
          'enter each bay directly from the aisle',
        );
      }
    });
  }
});

test('track joins are continuous and no time means no changes', () => {
  for (let t = 0; t < TAU; t += 0.001) {
    const p = trackPoint(t),
      q = trackPoint(t + 0.001);
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 0.02);
  }
  const a = createSimulation(42),
    b = createSimulation(42),
    initial = structuredClone(a.horses);
  a.update(0);
  assert.deepEqual(a.horses, initial);
  for (let i = 0; i < 2000; i++) {
    a.update(1 / 30);
    b.update(1 / 30);
  }
  assert.deepEqual(a.horses, b.horses);
});
