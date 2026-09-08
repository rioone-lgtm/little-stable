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
export const TRACK = { x: 8, z: 0, rx: 5.9, rz: 9 };
export const TAU = Math.PI * 2;
export function trackPoint(angle: number, id = 0): Point {
  const lane = ((id % 3) - 1) * 0.28;
  return {
    x: TRACK.x + (TRACK.rx + lane) * Math.cos(angle),
    z: (TRACK.rz + lane) * Math.sin(angle),
  };
}
export function stall(id: number): Point {
  return { x: -12 + (id % 5) * 2.2, z: id < 5 ? -7.1 : -5.3 };
}
export function createSimulation(seed = 9817) {
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const pasture = (): Point => ({
    x: -12 + random() * 10,
    z: 2.2 + random() * 6.8,
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
      angle: random() * TAU,
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
    if (h.state === 'rest') h.angle = 0;
  };
  const travel = (h: Horse, destination: Activity) => {
    // Each region has one open entrance. Paths meet on the unobstructed z=0 lane.
    const exit: Point[] =
      h.zone === 'rest'
        ? [
            { x: h.x, z: -2.7 },
            { x: -1, z: -2.7 },
            { x: -1, z: 0 },
          ]
        : h.zone === 'graze'
          ? [
              { x: -6.5, z: 2 },
              { x: -6.5, z: 0 },
              { x: -1, z: 0 },
            ]
          : [{ x: -1, z: 0 }];
    const target =
      destination === 'rest'
        ? stall(h.id)
        : destination === 'graze'
          ? pasture()
          : trackPoint(Math.PI, h.id);
    const entry: Point[] =
      destination === 'rest'
        ? [{ x: -1, z: -2.7 }, { x: target.x, z: -2.7 }, target]
        : destination === 'graze'
          ? [{ x: -6.5, z: 0 }, { x: -6.5, z: 2 }, target]
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
        const derivative = Math.hypot(
          TRACK.rx * Math.sin(h.trackAngle),
          TRACK.rz * Math.cos(h.trackAngle),
        );
        h.trackAngle = Math.min(
          h.lapEnd,
          h.trackAngle + (dt * velocity) / derivative,
        );
        Object.assign(h, trackPoint(h.trackAngle, h.id));
        h.angle = Math.atan2(
          -TRACK.rx * Math.sin(h.trackAngle),
          TRACK.rz * Math.cos(h.trackAngle),
        );
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
