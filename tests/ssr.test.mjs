import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../lib/stable/world.ts';
import { environmentAt } from '../lib/stable/environment.ts';
test('portable core modules evaluate on the server without DOM globals', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof createWorld, 'function');
  assert.equal(
    environmentAt(Date.parse('2026-09-09T13:00:00Z')).period,
    'night',
  );
});
