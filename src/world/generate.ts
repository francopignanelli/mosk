import { CONFIG } from '../simulation/config';
import { distance, hashSeed, randomFrom } from '../shared/math';
import type { World, Vec2, SleepingChunk, Resource } from '../shared/types';
import { organicChunk } from './organic';
import { revealAt } from './discovery';
import { advanceResources } from './resources';

type Chunk = Pick<World, 'resources' | 'obstacles' | 'regions' | 'predators'>;

export function chunkKeyAt(world: Pick<World, 'width' | 'height'>, point: Vec2): string {
  return `${Math.floor(point.x / world.width)},${Math.floor(point.y / world.height)}`;
}

function createChunk(
  seed: string,
  chunkX: number,
  chunkY: number,
): { chunk: Chunk; rngState: number } {
  const origin = chunkX === 0 && chunkY === 0;
  const key = `${chunkX},${chunkY}`;
  // Each tile owns its random stream. Exploring in a different order cannot alter terrain
  // or consume random numbers used by the fly's controller and predator simulation.
  const rng = { rngState: hashSeed(origin ? seed : `${seed}|chunk:${key}`) };
  const random = randomFrom(rng);
  const chunk: Chunk = { resources: [], obstacles: [], predators: [], regions: [] };
  const spawn = { x: 600, y: 380 };
  const point = (margin = 75): Vec2 => ({
    x: margin + random() * (CONFIG.width - margin * 2),
    y: margin + random() * (CONFIG.height - margin * 2),
  });
  // Keep the original tile and its RNG continuation identical to existing saves.
  chunk.regions = origin
    ? [
        { x: 260 + random() * 90, y: 235 + random() * 60, radius: 215, kind: 'grove' },
        { x: 905 + random() * 55, y: 545 + random() * 45, radius: 210, kind: 'meadow' },
        { x: 740 + random() * 100, y: 160 + random() * 40, radius: 100, kind: 'refuge' },
      ]
    : [
        { ...point(180), radius: 170 + random() * 70, kind: 'grove' },
        { ...point(180), radius: 170 + random() * 70, kind: 'meadow' },
        { ...point(150), radius: 85 + random() * 45, kind: 'refuge' },
      ];
  for (let i = 0; i < 36; i++) {
    const p = point(origin ? 65 : 80);
    const radius = 10 + random() * 20;
    if (
      distance(p, spawn) > 105 &&
      !chunk.obstacles.some((o) => distance(o, p) < o.radius + radius + 24)
    )
      chunk.obstacles.push({ ...p, radius, kind: random() > 0.28 ? 'plant' : 'rock' });
  }
  for (let i = 0; i < 17; i++) {
    let p = point(origin ? 70 : 86);
    let attempts = 0;
    while (
      (chunk.obstacles.some((o) => distance(o, p) < o.radius + 35) ||
        chunk.resources.some((r) => distance(r, p) < r.radius + 55)) &&
      attempts++ < 120
    )
      p = point(origin ? 70 : 86);
    if (attempts >= 120) continue;
    const kind = i % 5 === 0 ? 'water' : 'food';
    chunk.resources.push({
      ...p,
      id: origin ? i : `${key}:resource:${i}`,
      kind,
      radius: kind === 'water' ? 24 + random() * 12 : 11,
      amount: 100,
      capacity: 100,
    });
  }
  // The first life retains its immediately legible nearby sensory cue.
  const firstFood = chunk.resources.find((r) => r.kind === 'food');
  if (origin && firstFood) {
    firstFood.x = 635;
    firstFood.y = 410;
  }
  for (let i = 0; i < 3; i++) {
    let p = point(100);
    while (distance(p, spawn) < 300 || chunk.obstacles.some((o) => distance(o, p) < o.radius + 15))
      p = point(100);
    chunk.predators.push({
      ...p,
      id: origin ? i : `${key}:predator:${i}`,
      heading: random() * Math.PI * 2,
      mode: 'roaming',
      lastSeen: { ...p },
      attention: 0,
    });
  }
  const offsetX = chunkX * CONFIG.width;
  const offsetY = chunkY * CONFIG.height;
  for (const item of [
    ...chunk.regions,
    ...chunk.obstacles,
    ...chunk.resources,
    ...chunk.predators,
  ]) {
    item.x += offsetX;
    item.y += offsetY;
  }
  for (const predator of chunk.predators) {
    predator.lastSeen.x += offsetX;
    predator.lastSeen.y += offsetY;
  }
  return { chunk, rngState: rng.rngState };
}

/** Retained only to faithfully reconstruct terrain already present in old saves. */
export function generateLegacyChunk(seed: string, chunkX: number, chunkY: number): Chunk {
  return createChunk(seed, chunkX, chunkY).chunk;
}

export const generateChunk = organicChunk;

function chunkFromKey(world: World, key: string): Chunk {
  const [x, y] = key.split(',').map(Number);
  return world.legacyChunkKeys.includes(key)
    ? generateLegacyChunk(world.seed, x, y)
    : generateChunk(world.seed, x, y);
}

// Static geometry is consulted only when fruit relocates, including across sector seams.
// This bounded cache is derived data; it never reveals terrain or creates saved sectors.
const renewalGeometry = new WeakMap<World, Map<string, Chunk>>();
export function advanceWorldResources(
  world: World,
  resources: Resource[],
  tick: number,
  fromTick: number,
) {
  advanceResources(resources, world, tick, fromTick, (x, y) => {
    let cache = renewalGeometry.get(world);
    if (!cache) {
      cache = new Map();
      renewalGeometry.set(world, cache);
    }
    const key = `${x},${y}`;
    let geometry = cache.get(key);
    if (!geometry) {
      geometry = { resources: [], obstacles: [], regions: [], predators: [] };
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = chunkFromKey(world, `${x + dx},${y + dy}`);
          geometry.obstacles.push(...neighbor.obstacles);
          geometry.regions.push(...neighbor.regions);
          geometry.resources.push(...neighbor.resources);
        }
      cache.set(key, geometry);
      if (cache.size > 32) cache.delete(cache.keys().next().value!);
    }
    return geometry;
  });
}

function neighborhood(world: World, point: Vec2): string[] {
  const x = Math.floor(point.x / world.width);
  const y = Math.floor(point.y / world.height);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) keys.push(`${x + dx},${y + dy}`);
  return keys;
}

/** Upgrade the original finite habitat without replacing its living entities. */
export function migrateWorld(world: World, fly: Vec2, tick: number, trail: Vec2[] = []): void {
  if (world.topology !== 'infinite') {
    world.topology = 'infinite';
    world.activeChunkKeys = ['0,0'];
    world.exploredChunks = [];
    world.sleepingChunks = {};
  }
  if (world.terrainVersion !== 2) {
    world.legacyChunkKeys = [
      ...new Set([...world.activeChunkKeys, ...Object.keys(world.sleepingChunks)]),
    ];
    world.terrainVersion = 2;
    world.revealed = [];
    for (const point of trail) revealAt(world, point);
  }
  syncWorld(world, fly, tick);
}

/** Keep only the fly's surrounding 3×3 tiles live; dormant state is serialized. */
export function syncWorld(world: World, fly: Vec2, tick: number): void {
  if (world.topology !== 'infinite' || world.terrainVersion !== 2) {
    migrateWorld(world, fly, tick);
    return;
  }
  revealAt(world, fly);
  const center = chunkKeyAt(world, fly);
  const desiredKeys = neighborhood(world, fly);
  if (
    world.activeChunkKeys.length === desiredKeys.length &&
    world.activeChunkKeys.every((key, index) => key === desiredKeys[index])
  ) {
    // No work is needed until the fly enters another tile.
    return;
  }
  if (!world.exploredChunks.includes(center)) world.exploredChunks.push(center);
  const active = new Set(world.activeChunkKeys);
  const desired = new Set(desiredKeys);
  const livePredatorIds = new Set(world.predators.map((predator) => predator.id));

  // Empty predator arrays matter: a native spider may now be living in another tile.
  // Remembering the emptied tile prevents it from spawning a second copy on return.
  for (const key of world.activeChunkKeys) {
    if (desired.has(key)) continue;
    world.sleepingChunks[key] = {
      resources: world.resources.filter((resource) => chunkKeyAt(world, resource) === key),
      predators: [],
      lastTick: tick,
    };
  }

  const predators = world.predators.filter((predator) => desired.has(chunkKeyAt(world, predator)));
  for (const predator of world.predators) {
    const key = chunkKeyAt(world, predator);
    if (desired.has(key)) continue;
    let sleeping = world.sleepingChunks[key];
    if (!sleeping) {
      const chunk = chunkFromKey(world, key);
      sleeping = {
        resources: chunk.resources,
        predators: chunk.predators.filter((native) => !livePredatorIds.has(native.id)),
        lastTick: tick,
      };
      world.sleepingChunks[key] = sleeping;
    }
    if (!sleeping.predators.some((stored) => stored.id === predator.id))
      sleeping.predators.push(predator);
  }

  const resources = world.resources.filter((resource) => desired.has(chunkKeyAt(world, resource)));
  const obstacles = world.obstacles.filter((obstacle) => desired.has(chunkKeyAt(world, obstacle)));
  const regions = world.regions.filter((region) => desired.has(chunkKeyAt(world, region)));
  for (const key of desiredKeys) {
    if (active.has(key)) continue;
    const generated = chunkFromKey(world, key);
    const sleeping: SleepingChunk | undefined = world.sleepingChunks[key];
    const residents = sleeping ?? generated;
    if (sleeping) {
      advanceWorldResources(world, sleeping.resources, tick, sleeping.lastTick);
      delete world.sleepingChunks[key];
    }
    resources.push(...residents.resources);
    predators.push(...residents.predators);
    obstacles.push(...generated.obstacles);
    regions.push(...generated.regions);
  }
  world.activeChunkKeys = desiredKeys;
  world.resources = resources;
  world.obstacles = obstacles;
  world.regions = regions;
  world.predators = predators;
}

export function generateWorld(seed: string): { world: World; rngState: number } {
  const chunk = generateChunk(seed, 0, 0);
  const rngState = hashSeed(`${seed}|controller`);
  const world: World = {
    ...chunk,
    topology: 'infinite',
    width: CONFIG.width,
    height: CONFIG.height,
    seed,
    activeChunkKeys: ['0,0'],
    exploredChunks: [],
    sleepingChunks: {},
    terrainVersion: 2,
    legacyChunkKeys: [],
    revealed: [],
  };
  syncWorld(world, { x: 600, y: 380 }, 0);
  return { world, rngState };
}
