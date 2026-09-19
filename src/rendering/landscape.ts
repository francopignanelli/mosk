import type { ExperimentState, Vec2 } from '../shared/types';
import { CONFIG } from '../simulation/config';
import { landscapeAt, smoothNoise } from '../world/landscape';
import { REVEAL_RADIUS, revealedPointsInBounds } from '../world/discovery';
import type { ViewBounds } from './camera';

const groundCache = new Map<string, HTMLCanvasElement>();
const fogCache = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>();
function groundTile(seed: string, cx: number, cy: number): HTMLCanvasElement {
  const key = `${seed.length}:${seed}:${cx},${cy}`;
  let tile = groundCache.get(key);
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = 82;
    tile.height = 53;
    const context = tile.getContext('2d')!;
    const pixels = context.createImageData(tile.width, tile.height);
    // One-pixel gutters let interpolation continue seamlessly across tile edges.
    for (let y = 0; y < tile.height; y++)
      for (let x = 0; x < tile.width; x++) {
        const wx = cx * CONFIG.width + ((x - 0.5) * CONFIG.width) / 80;
        const wy = cy * CONFIG.height + ((y - 0.5) * CONFIG.height) / 51;
        const f = landscapeAt(seed, wx, wy);
        const lush = Math.max(0, Math.min(1, (f.growth - 0.24) * 1.75));
        const damp = Math.max(0, (f.moisture - 0.48) * 1.4);
        const grain = (smoothNoise(seed, wx / 43, wy / 43, 9) - 0.5) * 5;
        const color = [
          241 - lush * 30 - damp * 9,
          234 - lush * 6 + damp * 7,
          220 + lush * 4 + damp * 26,
        ];
        const offset = (y * tile.width + x) * 4;
        for (let c = 0; c < 3; c++) pixels.data[offset + c] = color[c] + grain;
        pixels.data[offset + 3] = 255;
      }
    context.putImageData(pixels, 0, 0);
  }
  groundCache.delete(key);
  groundCache.set(key, tile);
  if (groundCache.size > 32) groundCache.delete(groundCache.keys().next().value!);
  return tile;
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  state: ExperimentState,
  bounds: ViewBounds,
) {
  ctx.imageSmoothingEnabled = true;
  for (
    let y = Math.floor(bounds.top / CONFIG.height);
    y <= Math.floor(bounds.bottom / CONFIG.height);
    y++
  )
    for (
      let x = Math.floor(bounds.left / CONFIG.width);
      x <= Math.floor(bounds.right / CONFIG.width);
      x++
    ) {
      if (
        !state.world.activeChunkKeys.includes(`${x},${y}`) &&
        !state.world.sleepingChunks[`${x},${y}`]
      )
        continue;
      ctx.drawImage(
        groundTile(state.world.seed, x, y),
        1,
        1,
        80,
        51,
        x * CONFIG.width,
        y * CONFIG.height,
        CONFIG.width,
        CONFIG.height,
      );
    }
}

/** Smooth accumulated exploration, with immediate visibility around the current position. */
export function drawFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: ExperimentState,
  bounds: ViewBounds,
  center: Vec2,
) {
  let layer = fogCache.get(ctx);
  if (!layer) {
    layer = document.createElement('canvas');
    fogCache.set(ctx, layer);
  }
  if (layer.width !== Math.ceil(width) || layer.height !== Math.ceil(height)) {
    layer.width = Math.ceil(width);
    layer.height = Math.ceil(height);
  }
  const fog = layer.getContext('2d')!;
  fog.setTransform(1, 0, 0, 1, 0, 0);
  fog.globalCompositeOperation = 'source-over';
  fog.clearRect(0, 0, width, height);
  fog.fillStyle = '#e7e9f0';
  fog.fillRect(0, 0, width, height);
  fog.translate(width / 2, height / 2);
  fog.scale(bounds.scale, bounds.scale);
  fog.translate(-center.x, -center.y);
  fog.globalCompositeOperation = 'destination-out';
  const points = state.world.revealed?.length
    ? revealedPointsInBounds(state.world, bounds)
    : [state.fly];
  for (const point of [...points, state.fly]) {
    const gradient = fog.createRadialGradient(
      point.x,
      point.y,
      REVEAL_RADIUS - 50,
      point.x,
      point.y,
      REVEAL_RADIUS,
    );
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(1, '#0000');
    fog.fillStyle = gradient;
    fog.fillRect(
      point.x - REVEAL_RADIUS,
      point.y - REVEAL_RADIUS,
      REVEAL_RADIUS * 2,
      REVEAL_RADIUS * 2,
    );
  }
  fog.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer, bounds.left, bounds.top, width / bounds.scale, height / bounds.scale);
}
