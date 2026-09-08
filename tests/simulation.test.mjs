import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, TRACK } from '../lib/simulation.ts';

test('all 10 horses remain on the island and visit every activity during 40 minutes', () => {
  for (const seed of [9817, 42, 773]) {
    const sim = createSimulation(seed);
    for (let step = 0; step < 2400 * 30; step++) {
      sim.update(1 / 30);
      assert.equal(
        Object.values(sim.counts()).reduce((a, b) => a + b),
        10,
      );
      for (const horse of sim.horses) {
        assert.ok(Number.isFinite(horse.x) && Number.isFinite(horse.z));
        assert.ok(horse.x > -16 && horse.x < 16 && Math.abs(horse.z) < 12);
        if (horse.state === 'run') {
          const lane = ((horse.id % 3) - 1) * 0.28;
          const ellipse =
            ((horse.x - TRACK.x) / (TRACK.rx + lane)) ** 2 +
            (horse.z / (TRACK.rz + lane)) ** 2;
          assert.ok(Math.abs(ellipse - 1) < 1e-9);
        }
      }
    }
    for (const horse of sim.horses)
      for (const visits of Object.values(horse.visits)) assert.ok(visits > 0);
  }
});

test('horses cross the pasture fence only through the gate', () => {
  const sim = createSimulation();
  for (let i = 0; i < 1800 * 30; i++) {
    const before = sim.horses.map((h) => ({ x: h.x, z: h.z }));
    sim.update(1 / 30);
    sim.horses.forEach((h, j) => {
      const prev = before[j];
      if ((prev.z - 1) * (h.z - 1) < 0 && h.x < -0.7) {
        assert.ok(h.x > -7.5 && h.x < -5.5, 'pasture entrance');
      }
      if (prev.z < -4.7 && h.z < -4.7 && h.x < -1.5) {
        assert.ok(
          Math.abs(h.x - prev.x) < 1e-9,
          'stable bay dividers must not be crossed',
        );
      }
    });
  }
});

test('zero time freezes the simulation and equal seeds reproduce the scene', () => {
  const a = createSimulation(42),
    b = createSimulation(42);
  const initial = structuredClone(a.horses);
  a.update(0);
  assert.deepEqual(a.horses, initial);
  for (let i = 0; i < 2000; i++) {
    a.update(1 / 30);
    b.update(1 / 30);
  }
  assert.deepEqual(a.horses, b.horses);
  assert.throws(() => a.update(-1));
  assert.throws(() => a.update(NaN));
});
