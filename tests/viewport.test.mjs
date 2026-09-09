import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomAt, clampView } from '../lib/stable/viewport.ts';
const initial = { zoom: 1, x: 0, y: 0, halfWidth: 14, halfHeight: 24 };
test('pinch preserves the point under the gesture and zooms back to full view', () => {
  const x = 0.4,
    y = -0.3;
  const zoomed = zoomAt(initial, 2, x, y);
  assert.ok(
    Math.abs(
      zoomed.x + (x * zoomed.halfWidth) / zoomed.zoom - x * initial.halfWidth,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      zoomed.y + (y * zoomed.halfHeight) / zoomed.zoom - y * initial.halfHeight,
    ) < 1e-9,
  );
  assert.deepEqual(zoomAt(zoomed, 1, x, y), initial);
});
test('gesture limits prevent overzoom and losing the island', () => {
  assert.equal(zoomAt(initial, 99).zoom, 3);
  assert.equal(zoomAt(initial, 0.1).zoom, 1);
  assert.deepEqual(zoomAt(initial, NaN), initial);
  const v = clampView({ ...initial, zoom: 2, x: 1000, y: -1000 });
  assert.equal(v.x, 7);
  assert.equal(v.y, -12);
  assert.deepEqual(zoomAt(v, 1), initial);
});
