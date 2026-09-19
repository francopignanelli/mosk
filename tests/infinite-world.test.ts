import { describe, expect, it } from 'vitest';
import {
  chunkKeyAt,
  generateChunk,
  generateLegacyChunk,
  generateWorld,
  migrateWorld,
  syncWorld,
} from '../src/world/generate';
import { CONFIG } from '../src/simulation/config';
import type { World } from '../src/shared/types';
import { landscapeAt } from '../src/world/landscape';

const center = (x: number, y: number) => ({
  x: (x + 0.5) * CONFIG.width,
  y: (y + 0.5) * CONFIG.height,
});

const allPredators = (world: World) => [
  ...world.predators,
  ...Object.values(world.sleepingChunks).flatMap((chunk) => chunk.predators),
];

describe('infinite procedural terrain', () => {
  it('generates fresh deterministic chunks independent of visitation order', () => {
    const expected = generateChunk('endless', -8, 13);
    generateChunk('endless', 700, -91);
    expect(generateChunk('endless', -8, 13)).toEqual(expected);
    expect(generateChunk('different-seed', -8, 13)).not.toEqual(expected);
    const first = generateWorld('endless');
    const second = generateWorld('endless');
    syncWorld(first.world, center(70, 9), 0);
    syncWorld(first.world, center(-8, 13), 0);
    syncWorld(second.world, center(-8, 13), 0);
    expect(first.world.resources).toEqual(second.world.resources);
    expect(first.world.obstacles).toEqual(second.world.obstacles);
    expect(first.world.predators).toEqual(second.world.predators);
    expect(first.rngState).toBe(second.rngState);
    expected.resources[0].amount = 0;
    expect(generateChunk('endless', -8, 13).resources[0].amount).toBe(100);
  });

  it('loads nine sectors and marks only sectors actually entered as explored', () => {
    const { world } = generateWorld('visits');
    expect(world.activeChunkKeys).toHaveLength(9);
    expect(world.exploredChunks).toEqual(['0,0']);
    expect(chunkKeyAt(world, { x: -0.001, y: -0.001 })).toBe('-1,-1');
    expect(chunkKeyAt(world, { x: -CONFIG.width, y: -CONFIG.height })).toBe('-1,-1');
    syncWorld(world, { x: -0.001, y: -0.001 }, 30);
    expect(world.activeChunkKeys).toContain('-2,-2');
    expect(world.activeChunkKeys).not.toContain('1,1');
    expect(world.exploredChunks).toEqual(['0,0', '-1,-1']);
    syncWorld(world, center(-1, -1), 60);
    expect(world.exploredChunks).toHaveLength(2);
    syncWorld(world, center(0, 0), 90);
    expect(world.exploredChunks).toHaveLength(2);
  });

  it('keeps live geometry bounded over long travel', () => {
    const { world } = generateWorld('bounded');
    for (let tile = -20; tile <= 20; tile++) {
      syncWorld(world, center(tile, tile), tile + 21);
      expect(world.activeChunkKeys).toHaveLength(9);
      expect(world.resources.length).toBeLessThan(9 * 160);
      expect(world.obstacles.length).toBeLessThan(9 * 160);
      expect(world.regions.length).toBeLessThan(9 * 20);
      expect(world.predators.length).toBeLessThan(9 * 20);
      expect(world.activeChunkKeys.every((key) => !world.sleepingChunks[key])).toBe(true);
    }
  });

  it('preserves depleted food and analytically refills dormant water on return', () => {
    const { world } = generateWorld('regrowth');
    const food = world.resources.find((resource) => resource.kind === 'food' && resource.id === 1)!;
    food.amount = 4;
    world.resources.find((resource) => resource.id === 0)!.amount = 4;
    syncWorld(world, center(4, 0), 300);
    expect(
      world.sleepingChunks['0,0'].resources.find((resource) => resource.id === 1)?.amount,
    ).toBe(4);
    syncWorld(world, center(0, 0), 600);
    expect(world.resources.find((resource) => resource.id === 1)?.amount).toBe(4);
    expect(world.resources.find((resource) => resource.id === 0)?.amount).toBeCloseTo(
      4 + 300 * CONFIG.dt * CONFIG.resourceRegrowth,
    );
    syncWorld(world, center(4, 0), 600);
    syncWorld(world, center(0, 0), 1_000_000);
    expect(world.resources.find((resource) => resource.id === 0)?.amount).toBe(100);
  });

  it('keeps moving predators unique when their original tile unloads and returns', () => {
    const { world } = generateWorld('migrants');
    const migrant = world.predators.find((predator) => Math.floor(predator.x / world.width) < 1)!;
    const homeKey = chunkKeyAt(world, migrant);
    const id = migrant.id;
    Object.assign(migrant, center(1, 0), {
      mode: 'pursuing',
      attention: 1.75,
      lastSeen: { x: 1432, y: 388 },
    });
    syncWorld(world, center(2, 0), 30);
    expect(world.sleepingChunks[homeKey].predators.some((predator) => predator.id === id)).toBe(
      false,
    );
    expect(world.predators.find((predator) => predator.id === id)).toBe(migrant);
    syncWorld(world, center(5, 0), 60);
    expect(world.sleepingChunks['1,0'].predators.find((predator) => predator.id === id)).toEqual(
      migrant,
    );
    syncWorld(world, center(0, 0), 900);
    expect(world.predators.find((predator) => predator.id === id)).toEqual(migrant);
    const all = allPredators(world);
    expect(new Set(all.map((predator) => predator.id)).size).toBe(all.length);
    expect(all.filter((predator) => predator.id === id)).toHaveLength(1);
  });

  it('saves a predator that crosses into a never-loaded tile without losing its native residents', () => {
    const { world } = generateWorld('far-migrant');
    const migrant = world.predators[0];
    const id = migrant.id;
    const nativeCount = generateChunk(world.seed, 7, -3).predators.length;
    Object.assign(migrant, center(7, -3));
    syncWorld(world, center(-2, 0), 30);
    expect(world.sleepingChunks['7,-3'].predators).toHaveLength(nativeCount + 1);
    syncWorld(world, center(7, -3), 60);
    expect(
      world.predators.filter((predator) => chunkKeyAt(world, predator) === '7,-3'),
    ).toHaveLength(nativeCount + 1);
    syncWorld(world, center(0, 0), 90);
    const all = allPredators(world);
    expect(new Set(all.map((predator) => predator.id)).size).toBe(all.length);
    expect(all.filter((predator) => predator.id === id)).toHaveLength(1);
  });

  it('varies sector composition and permits terrain across storage seams', () => {
    const compositions = new Set<string>();
    const nearby = [];
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++) {
        const chunk = generateChunk('seams', x, y);
        compositions.add(
          [
            chunk.resources.length,
            chunk.obstacles.length,
            chunk.regions.length,
            chunk.predators.length,
          ].join(':'),
        );
        for (const item of [...chunk.obstacles, ...chunk.resources]) {
          expect(chunkKeyAt({ width: CONFIG.width, height: CONFIG.height }, item)).toBe(
            `${x},${y}`,
          );
          nearby.push({
            item,
            localX: item.x - x * CONFIG.width,
            localY: item.y - y * CONFIG.height,
          });
        }
      }
    expect(compositions.size).toBeGreaterThan(10);
    expect(nearby.some(({ item, localX }) => localX - item.radius < 0)).toBe(true);
    expect(nearby.some(({ item, localX }) => localX + item.radius > CONFIG.width)).toBe(true);
    expect(nearby.some(({ item, localY }) => localY - item.radius < 0)).toBe(true);
    expect(nearby.some(({ item, localY }) => localY + item.radius > CONFIG.height)).toBe(true);
  });

  it('keeps terrain fields continuous across positive and negative storage boundaries', () => {
    const seed = 'continuous-landscape';
    for (const boundary of [-3, -1, 0, 1, 3]) {
      const acrossX = [
        landscapeAt(seed, boundary * CONFIG.width - 0.01, 317.3),
        landscapeAt(seed, boundary * CONFIG.width + 0.01, 317.3),
      ];
      const acrossY = [
        landscapeAt(seed, -555.2, boundary * CONFIG.height - 0.01),
        landscapeAt(seed, -555.2, boundary * CONFIG.height + 0.01),
      ];
      for (const [before, after] of [acrossX, acrossY]) {
        for (const channel of ['growth', 'moisture', 'clearing'] as const) {
          expect(Math.abs(after[channel] - before[channel])).toBeLessThan(0.001);
        }
      }
    }
    const expected = landscapeAt(seed, -2831, 1547);
    generateChunk('another-seed', -37, 100);
    expect(landscapeAt(seed, -2831, 1547)).toEqual(expected);
    expect(landscapeAt(seed, -2831 + CONFIG.width, 1547)).not.toEqual(expected);
    expect(landscapeAt(seed, -2831, 1547 + CONFIG.height)).not.toEqual(expected);
    for (const channel of ['growth', 'moisture', 'clearing'] as const) {
      const samples = Array.from(
        { length: 25 },
        (_, index) => landscapeAt(seed, index * 415 - 5000, index * 269 - 3000)[channel],
      );
      expect(samples.every((value) => value >= 0 && value <= 1)).toBe(true);
      expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.1);
    }
  });

  it('retains legacy living entities when expanding an original snapshot', () => {
    const original = generateLegacyChunk('legacy', 0, 0);
    original.resources[1].amount = 6;
    original.predators[0].attention = 1.5;
    const legacy = {
      ...original,
      seed: 'legacy',
      width: CONFIG.width,
      height: CONFIG.height,
    } as World;
    const firstResource = legacy.resources[1];
    const firstPredator = legacy.predators[0];
    const oldEntities = structuredClone(original);
    migrateWorld(legacy, center(0, 0), 123);
    expect(legacy.topology).toBe('infinite');
    expect(legacy.resources[1]).toBe(firstResource);
    expect(legacy.predators[0]).toBe(firstPredator);
    expect(legacy.resources.slice(0, original.resources.length)).toEqual(oldEntities.resources);
    expect(legacy.predators.slice(0, original.predators.length)).toEqual(oldEntities.predators);
    expect(legacy.activeChunkKeys).toHaveLength(9);
    expect(legacy.exploredChunks).toEqual(['0,0']);
    expect(legacy.terrainVersion).toBe(2);
    expect(legacy.legacyChunkKeys).toEqual(['0,0']);
    expect(legacy.revealed).toEqual([center(0, 0)]);
    expect(legacy.obstacles).toEqual(
      expect.arrayContaining(generateChunk('legacy', 1, 0).obstacles),
    );
  });
});
