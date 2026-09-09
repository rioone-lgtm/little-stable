import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  fromStableOps,
  coatColor,
  COAT_COLORS,
  stableGeometry,
} from '../lib/stable/config.ts';
import { createSimulation, stall } from '../lib/stable/simulation.ts';

function fixture(west, east, occupied) {
  const layout = Array.from({ length: west + east }, (_, i) => ({
    index: 100 + i * 2,
    row: i < west ? 'west' : 'east',
    order: i < west ? i : i - west,
    label: String(i),
    horseRef: i < occupied ? `horse-${i}` : null,
  }));
  return {
    ...DEFAULT_CONFIG,
    stalls: { capacity: layout.length, occupied, layout },
    horses: layout
      .slice(0, occupied)
      .map((s) => ({ ref: s.horseRef, stallIndex: s.index, coat: 'bay' })),
  };
}
test('v1 defaults preserve the original palette, geometry and assignments', () => {
  assert.equal(fromStableOps(DEFAULT_CONFIG).horses.length, 10);
  assert.equal(stableGeometry().entranceZ, 12);
  assert.equal(coatColor(DEFAULT_CONFIG.horses[0]), '#7f4830');
  assert.deepEqual(stall(8), { x: -6.425, z: -9.1 });
});
test('all coat codes work without hex, unknown codes fall back, explicit hex wins', () => {
  for (const coat of Object.keys(COAT_COLORS))
    assert.equal(coatColor({ coat }), COAT_COLORS[coat]);
  assert.equal(coatColor({ coat: 'bay', coatHex: '#123456' }), '#123456');
  assert.equal(coatColor({ coat: 'bay', coatHex: 'red' }), COAT_COLORS.bay);
  const c = fixture(1, 0, 1);
  c.horses[0].coat = 'future-coat';
  assert.equal(fromStableOps(c).horses[0].coat, 'unknown');
});
test('zero horses, zero stalls, empty rows and asymmetric buildings are supported', () => {
  for (const c of [
    fixture(0, 0, 0),
    fixture(0, 7, 0),
    fixture(2, 1, 2),
    fixture(12, 9, 18),
  ]) {
    const a = createSimulation(42, 22, c),
      b = createSimulation(42, 22, c);
    assert.equal(a.horses.length, c.horses.length);
    for (let i = 0; i < 600; i++) {
      a.update(0.1);
      b.update(0.1);
    }
    assert.deepEqual(a.horses, b.horses);
    for (const h of a.horses) {
      assert.ok(Number.isFinite(h.x) && Number.isFinite(h.z));
      if (h.state === 'rest')
        assert.deepEqual(
          { x: h.x, z: h.z },
          stall(c.horses[h.id].stallIndex, c),
        );
    }
    for (const bay of c.stalls.layout)
      assert.ok(Math.abs(stall(bay.index, c).z) < stableGeometry(c).length / 2);
    assert.equal(
      Object.values(a.counts()).reduce((a, b) => a + b, 0),
      c.horses.length,
    );
  }
});
test('invalid assignments and unsupported versions fail before world allocation', () => {
  for (const mutate of [
    (c) => (c.version = 2),
    (c) => c.stalls.capacity++,
    (c) => (c.stalls.layout[1].index = c.stalls.layout[0].index),
    (c) => (c.stalls.layout[0].horseRef = null),
    (c) => (c.farm.location.timezone = 'invalid'),
    (c) => (c.horses[1].ref = c.horses[0].ref),
  ]) {
    const c = structuredClone(DEFAULT_CONFIG);
    mutate(c);
    assert.throws(() => fromStableOps(c));
  }
});
