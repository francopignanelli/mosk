import type { Vec2, World } from '../shared/types';

export const REVEAL_RADIUS = 265;
export const REVEAL_CELL = 80;
type Index = { length: number; cells: Map<string, Vec2>; buckets: Map<string, Vec2[]> };
const indexes = new WeakMap<World, Index>();
const cell = (p: Vec2) => `${Math.floor(p.x / REVEAL_CELL)},${Math.floor(p.y / REVEAL_CELL)}`;
function indexFor(world: World): Index {
  let index = indexes.get(world);
  if (!index || index.length > (world.revealed?.length ?? 0)) {
    index = { length: 0, cells: new Map(), buckets: new Map() };
    indexes.set(world, index);
  }
  const points = world.revealed ?? [];
  while (index.length < points.length) {
    const point = points[index.length++];
    index.cells.set(cell(point), point);
    const key = `${Math.floor(point.x / world.width)},${Math.floor(point.y / world.height)}`;
    const bucket = index.buckets.get(key) ?? [];
    bucket.push(point);
    index.buckets.set(key, bucket);
  }
  return index;
}
/** A compact observer exploration record, not information supplied to the brain. */
export function revealAt(world: World, point: Vec2): void {
  world.revealed ??= [];
  if (indexFor(world).cells.has(cell(point))) return;
  world.revealed.push({ x: point.x, y: point.y });
  indexFor(world);
}
export function revealedPointsInBounds(
  world: World,
  bounds: { left: number; right: number; top: number; bottom: number },
): Vec2[] {
  const index = indexFor(world),
    points: Vec2[] = [];
  for (
    let y = Math.floor((bounds.top - REVEAL_RADIUS) / world.height);
    y <= Math.floor((bounds.bottom + REVEAL_RADIUS) / world.height);
    y++
  )
    for (
      let x = Math.floor((bounds.left - REVEAL_RADIUS) / world.width);
      x <= Math.floor((bounds.right + REVEAL_RADIUS) / world.width);
      x++
    )
      for (const p of index.buckets.get(`${x},${y}`) ?? [])
        if (
          p.x + REVEAL_RADIUS >= bounds.left &&
          p.x - REVEAL_RADIUS <= bounds.right &&
          p.y + REVEAL_RADIUS >= bounds.top &&
          p.y - REVEAL_RADIUS <= bounds.bottom
        )
          points.push(p);
  return points;
}
export function isRevealed(world: World, point: Vec2): boolean {
  const index = indexFor(world),
    radius = REVEAL_RADIUS - 25;
  const cx = Math.floor(point.x / REVEAL_CELL),
    cy = Math.floor(point.y / REVEAL_CELL);
  const range = Math.ceil(radius / REVEAL_CELL);
  for (let y = cy - range; y <= cy + range; y++)
    for (let x = cx - range; x <= cx + range; x++) {
      const p = index.cells.get(`${x},${y}`);
      if (p && Math.hypot(point.x - p.x, point.y - p.y) <= radius) return true;
    }
  return false;
}
