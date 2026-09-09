import { blocksMove } from './traffic.ts';
export type Activity = 'rest' | 'graze' | 'run';
export type Point = { x: number; z: number };
export type Horse = Point & {
  id: number;
  state: Activity | 'walk';
  destination: Activity;
  zone: Activity;
  angle: number;
  phase: number;
  timer: number;
  trackAngle: number;
  lapEnd: number;
  route: Point[];
  visits: Record<Activity, number>;
};
export const TRACK = { x: 5, z: 0, radius: 6, straight: 4 };
export const STALL_CAPACITY = 15;
export const TAU = Math.PI * 2;
export function trackPoint(angle: number, id = 0): Point {
  const r = TRACK.radius + ((id % 3) - 1) * 0.28,
    a = TRACK.straight;
  const perimeter = 4 * a + TAU * r;
  let d = (((((angle - Math.PI) % TAU) + TAU) % TAU) / TAU) * perimeter;
  if (d < a) return { x: TRACK.x - r, z: -d };
  d -= a;
  if (d < Math.PI * r) {
    const t = Math.PI + d / r;
    return { x: TRACK.x + r * Math.cos(t), z: -a + r * Math.sin(t) };
  }
  d -= Math.PI * r;
  if (d < 2 * a) return { x: TRACK.x + r, z: -a + d };
  d -= 2 * a;
  if (d < Math.PI * r) {
    const t = d / r;
    return { x: TRACK.x + r * Math.cos(t), z: a + r * Math.sin(t) };
  }
  d -= Math.PI * r;
  return { x: TRACK.x - r, z: a - d };
}
export function stall(id: number): Point {
  if (!Number.isInteger(id) || id < 0 || id >= STALL_CAPACITY)
    throw new RangeError('Unknown stall');
  return {
    x: id < 8 ? -11.575 : -6.425,
    z: -9.1 + (id < 8 ? id : id - 8) * 2.6,
  };
}
export function stallAisle(id: number): Point {
  return { x: -9, z: stall(id).z };
}
export function createSimulation(seed = 9817, initialHour = 14) {
  let hour = initialHour;
  const period = () =>
    hour < 5 || hour >= 20
      ? 'night'
      : hour < 11
        ? 'morning'
        : hour < 17
          ? 'day'
          : 'evening';
  const duration = (id: number, state: Activity) =>
    state === 'rest'
      ? period() === 'night' && id < 8
        ? 420
        : period() === 'evening'
          ? 90
          : 25
      : 20;
  const choose = (id: number): Activity => {
    const p = period(),
      nightOwl = id >= 8;
    const rest =
      p === 'night'
        ? nightOwl
          ? 0.12
          : 0.98
        : p === 'evening'
          ? 0.68
          : p === 'morning'
            ? 0.16
            : 0.35;
    const run =
      p === 'morning' ? 0.6 : p === 'night' ? (nightOwl ? 0.48 : 0.5) : 0.4;
    return random() < rest ? 'rest' : random() < run ? 'run' : 'graze';
  };
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const pasture = (id: number): Point => ({
    x: id % 2 === 0 ? 2.8 : 7.2,
    z: -4 + Math.floor(id / 2) * 2,
  });
  const horses: Horse[] = Array.from({ length: 10 }, (_, id) => {
    const state: Activity =
      period() === 'night'
        ? id < 8
          ? 'rest'
          : id === 8
            ? 'graze'
            : 'run'
        : period() === 'morning'
          ? id < 2
            ? 'rest'
            : id < 5
              ? 'graze'
              : 'run'
          : period() === 'evening'
            ? id < 6
              ? 'rest'
              : id < 8
                ? 'graze'
                : 'run'
            : id < 3
              ? 'rest'
              : id < 7
                ? 'graze'
                : 'run';
    const trackAngle = Math.PI + (id % 5) * 1.1;
    const p =
      state === 'rest'
        ? stall(id)
        : state === 'graze'
          ? pasture(id)
          : trackPoint(trackAngle, id);
    return {
      id,
      ...p,
      state,
      destination: state,
      zone: state,
      angle:
        state === 'rest'
          ? id < 8
            ? Math.PI / 2
            : -Math.PI / 2
          : state === 'graze'
            ? id % 2 === 0
              ? -Math.PI / 2
              : Math.PI / 2
            : Math.atan2(
                trackPoint(trackAngle + 0.001, id).x - p.x,
                trackPoint(trackAngle + 0.001, id).z - p.z,
              ),
      phase: random() * TAU,
      timer: duration(id, state) * (1 + random()),
      trackAngle,
      lapEnd: Math.PI + TAU * 2,
      route: [],
      visits: {
        rest: state === 'rest' ? 1 : 0,
        graze: state === 'graze' ? 1 : 0,
        run: state === 'run' ? 1 : 0,
      },
    };
  });
  const enter = (h: Horse) => {
    h.state = h.destination;
    h.zone = h.destination;
    h.visits[h.state]++;
    h.timer = duration(h.id, h.state) * (1 + random());
    if (h.state === 'run') {
      h.trackAngle = Math.PI;
      h.lapEnd = Math.PI + TAU * (1 + Math.floor(random() * 2));
    }
    if (h.state === 'rest') h.angle = h.id < 8 ? Math.PI / 2 : -Math.PI / 2;
    if (h.state === 'graze')
      h.angle = h.id % 2 === 0 ? -Math.PI / 2 : Math.PI / 2;
  };
  const transfers = new Map<number, Activity>();
  const travel = (h: Horse, destination: Activity) => {
    // Reserve transfers through the shared junctions. Horses waiting for a
    // transfer remain in their bay/pasture or complete another track lap.
    if (!transfers.has(h.id)) transfers.set(h.id, destination);
    if (
      horses.some((other) => other.state === 'walk') ||
      transfers.keys().next().value !== h.id
    )
      return false;
    destination = transfers.get(h.id)!;
    transfers.delete(h.id);
    // Keep right: outbound uses west aisle / south apron / east connector lane.
    const target =
      destination === 'rest'
        ? stall(h.id)
        : destination === 'graze'
          ? pasture(h.id)
          : trackPoint(Math.PI, h.id);
    const exit: Point[] =
      h.zone === 'rest'
        ? [
            ...(h.id < 8
              ? [{ x: -9.6, z: h.z }]
              : [
                  { x: -8.5, z: h.z },
                  { x: -9.6, z: h.z + 1.3 },
                ]),
            { x: -9.6, z: 12.6 },
            { x: -2.9, z: 12.6 },
            { x: -2.9, z: 0.6 },
          ]
        : h.zone === 'graze'
          ? [
              { x: 5, z: h.z },
              { x: 5, z: 1 },
              { x: 1.3, z: 1 },
              { x: 0.5, z: 1 },
              { x: 0.5, z: -0.6 },
            ]
          : [];
    const entry: Point[] =
      destination === 'rest'
        ? [
            { x: -4.1, z: -0.6 },
            { x: -4.1, z: 11.4 },
            { x: -8.5, z: 11.4 },
            { x: -8.5, z: target.z },
            target,
          ]
        : destination === 'graze'
          ? [
              { x: 0.5, z: 0.6 },
              { x: 0.5, z: -1 },
              { x: 5, z: -1 },
              { x: 5, z: target.z },
              target,
            ]
          : [target];
    h.destination = destination;
    h.route = [...exit, ...entry];
    h.state = 'walk';
    return true;
  };
  function step(dt: number) {
    if (!Number.isFinite(dt) || dt < 0)
      throw new Error('Invalid simulation timestep');
    if (dt === 0) return;
    for (const h of horses) {
      h.phase += dt * (h.state === 'run' ? 11 : h.state === 'walk' ? 6 : 1.7);
      if (h.state === 'walk') {
        let remaining = dt * (1.1 + h.id * 0.025);
        while (h.route.length && remaining > 0) {
          const holding =
            (Math.abs(h.x + 2.9) < 0.001 && Math.abs(h.z - 0.6) < 0.001) ||
            (Math.abs(h.x - 1.3) < 0.001 && Math.abs(h.z - 1) < 0.001);
          if (
            holding &&
            horses.some(
              (other) =>
                other.state === 'run' &&
                other.x < 0 &&
                other.z > -2 &&
                other.z < 3.5,
            )
          )
            break;
          const p = h.route[0],
            dx = p.x - h.x,
            dz = p.z - h.z,
            d = Math.hypot(dx, dz);
          const angle = d > 0.001 ? Math.atan2(dx, dz) : h.angle;
          const advance = Math.min(d, remaining);
          const next = {
            x: d > 0 ? h.x + (dx / d) * advance : h.x,
            z: d > 0 ? h.z + (dz / d) * advance : h.z,
            angle,
          };
          if (
            horses.some(
              (other) => other.id !== h.id && blocksMove(h, next, other),
            )
          )
            break;
          h.angle = angle;
          if (d <= remaining) {
            h.x = p.x;
            h.z = p.z;
            remaining -= d;
            h.route.shift();
          } else {
            h.x += (dx / d) * remaining;
            h.z += (dz / d) * remaining;
            remaining = 0;
          }
        }
        if (!h.route.length) enter(h);
      } else if (h.state === 'run') {
        const crossing = horses.some(
          (other) =>
            other.state === 'walk' &&
            other.x > -3.1 &&
            other.x < 5.1 &&
            Math.abs(other.z) < 3,
        );
        // Yield before the gate, leaving enough space for the crossing horse.
        if (crossing && h.x < 0 && h.z > 3.5 && h.z < 3.8) continue;
        const velocity =
          (3.0 + h.id * 0.055) *
          (period() === 'morning' ? 1.15 : period() === 'night' ? 0.85 : 1);
        const r = TRACK.radius + ((h.id % 3) - 1) * 0.28;
        const before = {
          x: h.x,
          z: h.z,
          angle: h.angle,
          trackAngle: h.trackAngle,
        };
        h.trackAngle = Math.min(
          h.lapEnd,
          h.trackAngle + (dt * velocity * TAU) / (4 * TRACK.straight + TAU * r),
        );
        Object.assign(h, trackPoint(h.trackAngle, h.id));
        const ahead = trackPoint(h.trackAngle + 0.001, h.id);
        h.angle = Math.atan2(ahead.x - h.x, ahead.z - h.z);
        if (
          horses.some(
            (other) => other.id !== h.id && blocksMove(before, h, other),
          )
        ) {
          Object.assign(h, before);
          continue;
        }
        if (h.trackAngle >= h.lapEnd) {
          const next = transfers.get(h.id) ?? choose(h.id);
          if (next === 'run') h.lapEnd += TAU;
          else if (!travel(h, next)) h.lapEnd += TAU;
        }
      } else {
        if (transfers.has(h.id)) {
          travel(h, transfers.get(h.id)!);
          continue;
        }
        h.timer -= dt;
        if (h.timer <= 0) {
          const next = choose(h.id);
          if (next === h.state) h.timer = duration(h.id, next) * (1 + random());
          else travel(h, next);
        }
      }
    }
  }
  function update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0)
      throw new Error('Invalid simulation timestep');
    while (dt > 1e-9) {
      const tick = Math.min(dt, 1 / 30);
      step(tick);
      dt -= tick;
    }
  }
  return {
    horses,
    update,
    setHour(next: number) {
      if (!Number.isFinite(next) || next < 0 || next >= 24)
        throw new Error('Invalid hour');
      const previous = period();
      hour = next;
      if (previous !== period())
        for (const h of horses) {
          transfers.delete(h.id);
          h.timer = Math.min(h.timer, 2 + h.id);
          if (h.state === 'run')
            h.lapEnd =
              Math.PI + (Math.floor((h.trackAngle - Math.PI) / TAU) + 1) * TAU;
        }
    },
    counts: () =>
      horses.reduce(
        (c, h) => {
          c[h.state]++;
          return c;
        },
        { rest: 0, graze: 0, run: 0, walk: 0 },
      ),
  };
}
