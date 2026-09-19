import { CONFIG } from '../simulation/config';
import type { Vec2 } from '../shared/types';

export interface ViewBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  scale: number;
}

/** Camera coordinates never change simulation state or advance the world's random generator. */
export function viewBounds(width: number, height: number, zoom: number, center: Vec2): ViewBounds {
  const scale = Math.max(0.001, Math.min(width / CONFIG.width, height / CONFIG.height) * zoom);
  return {
    left: center.x - width / scale / 2,
    right: center.x + width / scale / 2,
    top: center.y - height / scale / 2,
    bottom: center.y + height / scale / 2,
    scale,
  };
}

export function panCamera(center: Vec2, dx: number, dy: number, scale: number): Vec2 {
  return { x: center.x - dx / scale, y: center.y - dy / scale };
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Normalize browser pixel, line and page deltas without a large wheel jump. */
export function wheelZoom(zoom: number, deltaY: number, deltaMode: number, height: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return zoom;
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
  return clampZoom(zoom * Math.exp(-Math.max(-250, Math.min(250, pixels)) * 0.002));
}

/** Keep the world point beneath a free-camera pointer fixed as the lens changes. */
export function zoomCameraAt(
  center: Vec2,
  pointer: Vec2,
  width: number,
  height: number,
  oldZoom: number,
  newZoom: number,
): Vec2 {
  const previousScale = viewBounds(width, height, oldZoom, center).scale;
  const nextScale = viewBounds(width, height, newZoom, center).scale;
  return {
    x: center.x + (pointer.x - width / 2) * (1 / previousScale - 1 / nextScale),
    y: center.y + (pointer.y - height / 2) * (1 / previousScale - 1 / nextScale),
  };
}
