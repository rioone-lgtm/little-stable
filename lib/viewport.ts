export type Viewport = {
  zoom: number;
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
};
export function clampView(v: Viewport): Viewport {
  const zoom = Math.max(1, Math.min(3, v.zoom));
  if (zoom === 1) return { ...v, zoom, x: 0, y: 0 };
  const limitX = v.halfWidth * (1 - 1 / zoom),
    limitY = v.halfHeight * (1 - 1 / zoom);
  return {
    ...v,
    zoom,
    x: Math.max(-limitX, Math.min(limitX, v.x)),
    y: Math.max(-limitY, Math.min(limitY, v.y)),
  };
}
export function zoomAt(
  v: Viewport,
  zoom: number,
  anchorX = 0,
  anchorY = 0,
): Viewport {
  if (!Number.isFinite(zoom) || zoom <= 0) return v;
  const nextZoom = Math.max(1, Math.min(3, zoom));
  return clampView({
    ...v,
    zoom: nextZoom,
    x: v.x + anchorX * v.halfWidth * (1 / v.zoom - 1 / nextZoom),
    y: v.y + anchorY * v.halfHeight * (1 / v.zoom - 1 / nextZoom),
  });
}
