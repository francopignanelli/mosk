import { advanceWorldResources, generateChunk, generateLegacyChunk } from '../world/generate';
import type { World } from '../shared/types';
import type { ViewBounds } from './camera';
import { isRevealed } from '../world/discovery';

type Terrain = Pick<World, 'resources' | 'obstacles' | 'regions' | 'predators'>;
const cache = new Map<string, Terrain>();
const CACHE_LIMIT = 32;

function staticChunk(seed: string, x: number, y: number, legacy: boolean): Terrain {
  const key = `${seed.length}:${seed}:${legacy}:${x},${y}`;
  let terrain = cache.get(key);
  if (!terrain) terrain = (legacy ? generateLegacyChunk : generateChunk)(seed, x, y);
  cache.delete(key);
  cache.set(key, terrain);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return terrain;
}

/** The camera can revisit generated terrain; it never generates unexplored sectors. */
export function visibleTerrain(world: World, bounds: ViewBounds, tick: number): Terrain {
  const result: Terrain = { resources: [], obstacles: [], regions: [], predators: [] };
  const active = new Set(world.activeChunkKeys);
  const margin = 350;
  const visible = (p: { x: number; y: number }) =>
    p.x >= bounds.left - margin &&
    p.x <= bounds.right + margin &&
    p.y >= bounds.top - margin &&
    p.y <= bounds.bottom + margin;
  for (const key of ['resources', 'obstacles', 'regions', 'predators'] as const)
    (result[key] as { x: number; y: number }[]).push(...world[key].filter(visible));
  for (
    let y = Math.floor((bounds.top - margin) / world.height);
    y <= Math.floor((bounds.bottom + margin) / world.height);
    y++
  ) {
    for (
      let x = Math.floor((bounds.left - margin) / world.width);
      x <= Math.floor((bounds.right + margin) / world.width);
      x++
    ) {
      const key = `${x},${y}`;
      if (active.has(key)) continue;
      const saved = world.sleepingChunks[key];
      if (!saved) continue;
      const terrain = staticChunk(world.seed, x, y, world.legacyChunkKeys?.includes(key) ?? true);
      result.obstacles.push(...terrain.obstacles.filter(visible));
      result.regions.push(...terrain.regions.filter(visible));
      const projected = saved.resources.map((r) => ({
        ...r,
        ...(r.renewal ? { renewal: { ...r.renewal } } : {}),
      }));
      advanceWorldResources(world, projected, tick, saved.lastTick);
      result.resources.push(...projected.filter(visible));
      // Remembered terrain is visible, but dormant animals are not live observations.
    }
  }
  return result;
}

export function terrainAtCameraIsActive(world: World, center: { x: number; y: number }): boolean {
  return isRevealed(world, center);
}
