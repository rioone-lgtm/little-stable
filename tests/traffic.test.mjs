import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../lib/simulation.ts';
import { bodyDistance, blocksMove } from '../lib/traffic.ts';

test('body clearance accounts for noses, following and oncoming lanes', () => {
  const horse = { x: 0, z: 0, angle: 0 };
  assert.ok(blocksMove(horse, { ...horse, z: 0.1 }, { ...horse, z: 2 }));
  assert.equal(
    blocksMove(horse, { ...horse, z: 0.1 }, { x: 1.1, z: 0.5, angle: Math.PI }),
    false,
  );
});

test('horses keep body clearance and transfers continue through day and night', () => {
  for (const seed of [9817, 42, 773]) {
    const sim = createSimulation(seed, 8);
    for (let tick = 0; tick < 1800 * 30; tick++) {
      if (tick === 900 * 30) sim.setHour(22);
      sim.update(1 / 30);
      assert.ok(
        sim.horses.filter((h) => h.state === 'walk').length <= 1,
        'reserve narrow transfers for one horse at a time',
      );
      for (let i = 0; i < sim.horses.length; i++) {
        const a = sim.horses[i];
        if (
          a.state === 'walk' &&
          a.x > -8 &&
          a.x < -3 &&
          a.z > 1 &&
          a.z < 11.9
        ) {
          assert.equal(
            a.x,
            -3.5,
            'stay on the center of the narrow outdoor connector',
          );
        }
        for (const b of sim.horses.slice(i + 1)) {
          assert.ok(
            bodyDistance(a, b) >= 0.8,
            `seed ${seed}, tick ${tick}, horses ${a.id}/${b.id}`,
          );
        }
        if (
          a.state === 'walk' &&
          a.x < -8 &&
          a.z > -8 &&
          a.z < 9 &&
          a.route[0]?.x === a.x
        ) {
          assert.ok(
            a.route[0].z > a.z ? a.x < -9 : a.x > -9,
            'keep right in the stable aisle',
          );
        }
      }
    }
    assert.ok(
      sim.counts().rest >= 6,
      'night transfers still bring horses home',
    );
  }
});
