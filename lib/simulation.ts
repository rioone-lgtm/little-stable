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
  return { x: id < 8 ? -9.3 : -5.7, z: -9.1 + (id < 8 ? id : id - 8) * 2.6 };
}
export function stallAisle(id: number): Point {
  return { x: -7.5, z: stall(id).z };
}
export function createSimulation(seed = 9817) {
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const pasture = (): Point => ({
    x: 2 + random() * 6,
    z: -5 + random() * 10,
  });
  const horses: Horse[] = Array.from({ length: 10 }, (_, id) => {
    const state: Activity = id < 3 ? 'rest' : id < 7 ? 'graze' : 'run';
    const trackAngle = Math.PI + (id - 7) * 1.7;
    const p =
      state === 'rest'
        ? stall(id)
        : state === 'graze'
          ? pasture()
          : trackPoint(trackAngle, id);
    return {
      id,
      ...p,
      state,
      destination: state,
      zone: state,
      angle: state === 'rest' ? Math.PI / 2 : random() * TAU,
      phase: random() * TAU,
      timer: 7 + random() * 15,
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
    h.timer = 10 + random() * 18;
    if (h.state === 'run') {
      h.trackAngle = Math.PI;
      h.lapEnd = Math.PI + TAU * (1 + Math.floor(random() * 2));
    }
    if (h.state === 'rest') h.angle = h.id < 8 ? Math.PI / 2 : -Math.PI / 2;
  };
  const travel = (h: Horse, destination: Activity) => {
    // One central aisle serves 15 dedicated bays. Both track rails have a gate at z=0.
    const junction = { x: -2.5, z: 0 },
      gate = { x: 1, z: 0 };
    const exit: Point[] =
      h.zone === 'rest'
        ? [
            stallAisle(h.id),
            { x: -7.5, z: 11.3 },
            { x: -2.5, z: 11.3 },
            junction,
          ]
        : h.zone === 'graze'
          ? [gate, junction]
          : [junction];
    const target =
      destination === 'rest'
        ? stall(h.id)
        : destination === 'graze'
          ? pasture()
          : trackPoint(Math.PI, h.id);
    const entry: Point[] =
      destination === 'rest'
        ? [{ x: -2.5, z: 11.3 }, { x: -7.5, z: 11.3 }, stallAisle(h.id), target]
        : destination === 'graze'
          ? [gate, target]
          : [target];
    h.destination = destination;
    h.route = [...exit, ...entry];
    h.state = 'walk';
  };
  function update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0)
      throw new Error('Invalid simulation timestep');
    if (dt === 0) return;
    for (const h of horses) {
      h.phase += dt * (h.state === 'run' ? 11 : h.state === 'walk' ? 6 : 1.7);
      if (h.state === 'walk') {
        let remaining = dt * (1.1 + h.id * 0.025);
        while (h.route.length && remaining > 0) {
          const p = h.route[0],
            dx = p.x - h.x,
            dz = p.z - h.z,
            d = Math.hypot(dx, dz);
          if (d > 0.001) h.angle = Math.atan2(dx, dz);
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
        const velocity = 3.0 + h.id * 0.055;
        const r = TRACK.radius + ((h.id % 3) - 1) * 0.28;
        h.trackAngle = Math.min(
          h.lapEnd,
          h.trackAngle + (dt * velocity * TAU) / (4 * TRACK.straight + TAU * r),
        );
        Object.assign(h, trackPoint(h.trackAngle, h.id));
        const ahead = trackPoint(h.trackAngle + 0.001, h.id);
        h.angle = Math.atan2(ahead.x - h.x, ahead.z - h.z);
        if (h.trackAngle >= h.lapEnd)
          travel(h, random() < 0.6 ? 'rest' : 'graze');
      } else {
        h.timer -= dt;
        if (h.timer <= 0)
          travel(
            h,
            h.state === 'rest'
              ? random() < 0.65
                ? 'graze'
                : 'run'
              : random() < 0.65
                ? 'run'
                : 'rest',
          );
      }
    }
  }
  return {
    horses,
    update,
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
