import type { Resource, Vec2 } from '../shared/types';
import { CONFIG } from '../simulation/config';
import type { ViewBounds } from './camera';

const layers = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>();

/** Composite the whole cue overlay once so overlapping food never creates an opaque yellow wash. */
export function drawScentField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  resources: Resource[],
  bounds: ViewBounds,
  center: Vec2,
) {
  let canvas = layers.get(ctx);
  if (!canvas) {
    canvas = document.createElement('canvas');
    layers.set(ctx, canvas);
  }
  if (canvas.width !== Math.ceil(width) || canvas.height !== Math.ceil(height)) {
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
  }
  const layer = canvas.getContext('2d')!;
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, width, height);
  layer.translate(width / 2, height / 2);
  layer.scale(bounds.scale, bounds.scale);
  layer.translate(-center.x, -center.y);
  const range = CONFIG.scentRadius;
  for (const resource of resources) {
    if (resource.kind !== 'food' || resource.amount <= 1) continue;
    const gradient = layer.createRadialGradient(
      resource.x,
      resource.y,
      0,
      resource.x,
      resource.y,
      range,
    );
    gradient.addColorStop(0, '#c6b17bb3');
    gradient.addColorStop(0.4, '#c6b17b40');
    gradient.addColorStop(1, '#c6b17b00');
    layer.fillStyle = gradient;
    layer.fillRect(resource.x - range, resource.y - range, range * 2, range * 2);
  }
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.drawImage(canvas, bounds.left, bounds.top, width / bounds.scale, height / bounds.scale);
  ctx.restore();
}
