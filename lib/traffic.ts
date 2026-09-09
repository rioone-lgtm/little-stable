export type Body = { x: number; z: number; angle: number };
type P = { x: number; z: number };
function pointDistance(p: P, a: P, b: P) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    l = dx * dx + dz * dz,
    t = l
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l))
      : 0;
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
export function bodyDistance(a: Body, b: Body) {
  const segment = (h: Body) =>
    [-0.45, 0.75].map((d) => ({
      x: h.x + Math.sin(h.angle) * d,
      z: h.z + Math.cos(h.angle) * d,
    }));
  const [p, q] = segment(a),
    [r, s] = segment(b);
  const cross = (a: P, b: P, c: P) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  if (
    cross(p, q, r) * cross(p, q, s) < 0 &&
    cross(r, s, p) * cross(r, s, q) < 0
  )
    return 0;
  return Math.min(
    pointDistance(p, r, s),
    pointDistance(q, r, s),
    pointDistance(r, p, q),
    pointDistance(s, p, q),
  );
}
export function blocksMove(before: Body, next: Body, other: Body) {
  const distance = bodyDistance(next, other);
  return distance < 0.82 && distance < bodyDistance(before, other) - 1e-7;
}
