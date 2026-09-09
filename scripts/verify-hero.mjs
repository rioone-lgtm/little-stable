/* oxlint-disable typescript/unbound-method -- Instrumented native methods are deliberately invoked with .call(this). */
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const origin = process.env.STABLE_ORIGIN || 'http://localhost:3000';
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });
  await page.route('**/qa-host', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body><div id="host" style="width:960px;height:540px"></div></body></html>',
    }),
  );
  await page.goto(origin + '/qa-host');
  const result = await page.evaluate(async () => {
    const { createWorld } = await import('/lib/stable/world.ts');
    const { DEFAULT_CONFIG } = await import('/lib/stable/config.ts');
    const host = document.querySelector('#host');
    const frames = new Map();
    let serial = 0,
      interactionListeners = 0,
      disconnected = 0,
      io;
    window.requestAnimationFrame = (callback) => {
      frames.set(++serial, callback);
      return serial;
    };
    window.cancelAnimationFrame = (id) => frames.delete(id);
    window.ResizeObserver = class {
      observe() {}
      disconnect() {
        disconnected++;
      }
    };
    window.IntersectionObserver = class {
      constructor(callback) {
        io = callback;
      }
      observe() {}
      disconnect() {
        disconnected++;
      }
    };
    const add = HTMLCanvasElement.prototype.addEventListener;
    HTMLCanvasElement.prototype.addEventListener = function (type, ...args) {
      if (
        [
          'pointerdown',
          'pointermove',
          'pointerup',
          'pointercancel',
          'lostpointercapture',
          'wheel',
        ].includes(type)
      )
        interactionListeners++;
      return add.call(this, type, ...args);
    };
    const step = (now) => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(now));
    };
    let ready = 0,
      counts;
    const world = createWorld(
      host,
      (c) => (counts = c),
      () => {},
      {
        interactive: false,
        autoPause: true,
        background: 'transparent',
        minDaylight: 0.25,
        onReady: () => ready++,
      },
    );
    const initiallyStopped = frames.size === 0;
    io([{ isIntersecting: true }]);
    step(1000);
    const active = frames.size === 1 && ready === 1;
    const alpha = host
      .querySelector('canvas')
      .getContext('webgl2')
      .getContextAttributes().alpha;
    const pointerEvents = host.querySelector('canvas').style.pointerEvents;
    io([{ isIntersecting: false }]);
    const offscreenStopped = frames.size === 0;
    io([{ isIntersecting: true }]);
    step(1000000);
    const resumed = frames.size === 1;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    const hiddenStopped = frames.size === 0;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    step(1000010);
    const canvas = host.querySelector('canvas');
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    const lostStopped = frames.size === 0;
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    step(1000020);
    const restored = ready === 2;
    world.zoomBy(2);
    world.resetZoom();
    world.dispose();
    const disposed =
      frames.size === 0 && host.children.length === 0 && disconnected === 2;
    const empty = structuredClone(DEFAULT_CONFIG);
    empty.horses = [];
    empty.stalls.occupied = 0;
    empty.stalls.layout.forEach((s) => (s.horseRef = null));
    const emptyWorld = createWorld(
      host,
      (c) => (counts = c),
      () => {},
      { config: empty, interactive: false },
    );
    step(1000030);
    const emptyRendered = Object.values(counts).every((n) => n === 0);
    emptyWorld.dispose();
    // A large asymmetric barn must render too, not only pass pure geometry tests.
    const variable = structuredClone(empty);
    variable.stalls.capacity = 21;
    variable.stalls.layout = Array.from({ length: 21 }, (_, i) => ({
      index: i,
      row: i < 12 ? 'west' : 'east',
      order: i < 12 ? i : i - 12,
      label: String(i + 1),
      horseRef: null,
    }));
    let variableReady = false;
    const variableWorld = createWorld(
      host,
      () => {},
      () => {},
      {
        config: variable,
        interactive: false,
        onReady: () => (variableReady = true),
      },
    );
    step(1000040);
    variableWorld.dispose();
    return {
      initiallyStopped,
      active,
      alpha,
      pointerEvents,
      offscreenStopped,
      resumed,
      hiddenStopped,
      lostStopped,
      restored,
      disposed,
      emptyRendered,
      variableReady,
      interactionListeners,
    };
  });
  for (const [name, value] of Object.entries(result)) {
    if (name === 'pointerEvents') assert.equal(value, 'none');
    else if (name === 'interactionListeners') assert.equal(value, 0);
    else assert.equal(value, true, name);
  }
  await page.close();
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  const requests = [];
  reduced.on('pageerror', (e) => errors.push(e.message));
  reduced.on('request', (r) => requests.push(r.url()));
  await reduced.goto(origin + '/hero-preview');
  await reduced.locator('[data-frame="wide"] [data-ready="true"]').waitFor();
  const before = await reduced
    .locator('[data-frame="wide"] canvas')
    .screenshot();
  await reduced.waitForTimeout(250);
  const after = await reduced
    .locator('[data-frame="wide"] canvas')
    .screenshot();
  assert.deepEqual(before, after, 'reduced motion remains still');
  assert.equal(
    requests.some((url) => url.includes('open-meteo.com')),
    false,
  );
  assert.equal(await reduced.locator('[role="img"] h1').count(), 0);
  assert.deepEqual(errors, []);
  await reduced.close();
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl')
        ? null
        : original.call(this, type, ...args);
    };
  });
  await fallback.goto(origin + '/hero-preview');
  await fallback.waitForFunction(
    () => document.querySelector('[data-frame="wide"] img')?.complete,
  );
  await fallback.waitForTimeout(500);
  assert.equal(await fallback.locator('[data-ready="true"]').count(), 0);
  assert.equal(
    await fallback
      .locator('[data-frame="wide"] img')
      .evaluate((el) => el.naturalWidth),
    1600,
  );
  assert.equal(await fallback.locator('[role="img"]').first().innerText(), '');
  await fallback.close();
  const demo = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await demo.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          weather_code: 0,
          temperature_2m: 22,
          cloud_cover: 10,
          precipitation: 0,
          time: Date.now() / 1000,
        },
        daily: {
          sunrise: [Date.now() - 3600000],
          sunset: [Date.now() + 3600000],
        },
      },
    }),
  );
  await demo.goto(origin + '/');
  const pause = demo.getByRole('button', { name: '一時停止', exact: true });
  await pause.waitFor();
  await pause.click();
  await demo.getByRole('button', { name: '再生', exact: true }).waitFor();
  await demo.getByRole('button', { name: /1×/ }).click();
  await demo.getByRole('button', { name: /2×/ }).waitFor();
  await demo.getByRole('button', { name: '全体表示に戻す' }).click();
  assert.equal(
    await demo
      .locator('.activities b')
      .evaluateAll((nodes) =>
        nodes.reduce((n, el) => n + Number(el.textContent), 0),
      ),
    10,
  );
  if (process.env.STABLE_SCREENSHOT)
    await demo.screenshot({ path: process.env.STABLE_SCREENSHOT });
  await demo.close();
  console.log(
    'PASS: zero input listeners, alpha, offscreen/hidden/context pause and resume, disposal, empty/variable barn, static reduced motion, no weather fetch, silent poster fallback.',
  );
} finally {
  await browser.close();
}
