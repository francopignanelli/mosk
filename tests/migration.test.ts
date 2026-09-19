import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDBStorage, parseSnapshot, validateSnapshot } from '../src/persistence/storage';
import { archiveGeneration, createExperiment, stepExperiment } from '../src/simulation/engine';
import type { ExperimentState, World } from '../src/shared/types';
import { generateChunk, generateLegacyChunk, syncWorld } from '../src/world/generate';
import { isRevealed } from '../src/world/discovery';

type LegacyWorld = Omit<
  World,
  | 'topology'
  | 'activeChunkKeys'
  | 'exploredChunks'
  | 'sleepingChunks'
  | 'terrainVersion'
  | 'legacyChunkKeys'
  | 'revealed'
>;
type LegacyState = Omit<ExperimentState, 'world'> & { world: LegacyWorld };

function legacyState(seed: string, generation: number): LegacyState {
  const state = createExperiment(seed, generation);
  Object.assign(state.world, generateLegacyChunk(seed, 0, 0));
  for (let i = 0; i < 60; i++) stepExperiment(state);
  // Build true v1 geometry, not an organic world with its new metadata removed.
  const world: LegacyWorld = {
    seed: state.world.seed,
    width: state.world.width,
    height: state.world.height,
    resources: state.world.resources,
    predators: state.world.predators,
    obstacles: state.world.obstacles,
    regions: state.world.regions,
  };
  return { ...state, world };
}

function legacySnapshot() {
  const current = legacyState('legacy-current', 2);
  current.world.resources[0].amount = 13.25;
  current.world.predators[0].mode = 'searching';
  current.world.predators[0].attention = 1.25;
  const finalState = legacyState('legacy-archive', 1);
  finalState.fly.alive = false;
  finalState.fly.action = 'deceased';
  finalState.fly.vitals.health = 0;
  finalState.brain.action = 'deceased';
  finalState.deathCause = 'Predator attack';
  const summary = archiveGeneration(finalState as ExperimentState);
  return {
    schemaVersion: 1,
    savedAt: '2026-09-19T00:00:00.000Z',
    current,
    archive: [{ ...summary, finalState }],
  };
}

describe('bounded save migration', () => {
  it('preserves resources, predator memory, histories, RNG and every archive summary', () => {
    const legacy = legacySnapshot();
    const original = structuredClone(legacy);
    const migrated = validateSnapshot(legacy);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.savedAt).toBe(legacy.savedAt);
    expect(legacy).toEqual(original);
    for (const [before, after] of [
      [legacy.current, migrated.current],
      [legacy.archive[0].finalState, migrated.archive[0].finalState],
    ] as const) {
      const { world: oldWorld, ...oldState } = before;
      const { world: newWorld, ...newState } = after;
      expect(newState).toEqual(oldState);
      expect(newWorld.topology).toBe('infinite');
      expect(newWorld.terrainVersion).toBe(2);
      expect(newWorld.legacyChunkKeys).toEqual(['0,0']);
      expect(isRevealed(newWorld, after.fly)).toBe(true);
      for (const point of before.fly.trail) expect(isRevealed(newWorld, point)).toBe(true);
      expect(newWorld.activeChunkKeys).toHaveLength(9);
      expect(newWorld.resources).toEqual(expect.arrayContaining(oldWorld.resources));
      expect(newWorld.predators).toEqual(expect.arrayContaining(oldWorld.predators));
      expect(newWorld.obstacles).toEqual(expect.arrayContaining(oldWorld.obstacles));
      expect(newWorld.regions).toEqual(expect.arrayContaining(oldWorld.regions));
    }
    const { finalState: beforeState, ...beforeSummary } = legacy.archive[0];
    const { finalState: afterState, ...afterSummary } = migrated.archive[0];
    expect(afterSummary).toEqual(beforeSummary);
    expect(afterState.fly).toEqual(beforeState.fly);
  });

  it('roundtrips a migrated save and resumes bit-for-bit deterministic simulation', () => {
    const migrated = validateSnapshot(legacySnapshot());
    const restored = parseSnapshot(JSON.stringify(migrated));
    expect(restored).toEqual(migrated);
    for (let i = 0; i < 90; i++) {
      stepExperiment(migrated.current);
      stepExperiment(restored.current);
    }
    expect(restored).toEqual(migrated);
  });

  it('rejects invalid legacy coordinates and obstacles before migrating', () => {
    const invalidPosition = legacySnapshot();
    invalidPosition.current.world.resources[0].x = -1;
    expect(() => validateSnapshot(invalidPosition)).toThrow(/coordinate/);
    const invalidObstacle = legacySnapshot();
    invalidObstacle.current.world.obstacles[0].x = 0;
    expect(() => validateSnapshot(invalidObstacle)).toThrow(/boundary/);
  });

  it('validates all archived lives before any migration and preserves the input on failure', () => {
    const invalidArchive = legacySnapshot();
    invalidArchive.archive[0].finalState.world.predators[0].lastSeen.x = Infinity;
    expect(() => validateSnapshot(invalidArchive)).toThrow(/coordinate/);
    expect(invalidArchive.current.world).not.toHaveProperty('topology');
    const invalidSummary = legacySnapshot();
    invalidSummary.archive[0].averageEnergy = 101;
    expect(() => validateSnapshot(invalidSummary)).toThrow(/average energy/);
  });

  it('loads and migrates existing IndexedDB data under the unchanged v1 key', async () => {
    const legacy = legacySnapshot();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('mosk', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('experiments');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('experiments', 'readwrite');
        tx.objectStore('experiments').put(legacy, 'mosk.experiment.v1');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
    const restored = await new IndexedDBStorage().load();
    expect(restored).toEqual(validateSnapshot(legacy));
  });
});

describe('tiled save migration', () => {
  it('preserves v2 live and dormant entities, and keeps old terrain on revisits', () => {
    const current = createExperiment('v2-terrain', 2);
    const oldChunks = current.world.activeChunkKeys.map((key) => {
      const [x, y] = key.split(',').map(Number);
      return generateLegacyChunk(current.world.seed, x, y);
    });
    for (const kind of ['resources', 'obstacles', 'regions', 'predators'] as const) {
      (current.world[kind] as unknown[]) = oldChunks.flatMap((chunk) => chunk[kind] as unknown[]);
    }
    current.world.resources[0].amount = 19;
    current.world.predators[0].attention = 1.5;
    current.fly.trail = [
      { x: 100, y: 100 },
      { x: 400, y: 280 },
    ];
    const dormant = generateLegacyChunk(current.world.seed, 4, -2);
    dormant.resources[0].amount = 7;
    current.world.sleepingChunks['4,-2'] = {
      resources: dormant.resources,
      predators: dormant.predators,
      lastTick: 0,
    };
    const archive = archiveGeneration({ ...structuredClone(current), generation: 1 });
    const legacyWorld = (world: World) => {
      const {
        terrainVersion: _version,
        legacyChunkKeys: _legacy,
        revealed: _revealed,
        ...oldWorld
      } = world;
      return oldWorld;
    };
    const legacy = {
      schemaVersion: 2,
      savedAt: '2026-09-19T00:00:00.000Z',
      current: { ...current, world: legacyWorld(current.world) },
      archive: [
        {
          ...archive,
          finalState: { ...archive.finalState, world: legacyWorld(archive.finalState.world) },
        },
      ],
    };
    const original = structuredClone(legacy);
    const migrated = validateSnapshot(legacy);
    expect(migrated.schemaVersion).toBe(3);
    expect(legacy).toEqual(original);
    const knownKeys = [...current.world.activeChunkKeys, '4,-2'];
    for (const state of [migrated.current, migrated.archive[0].finalState]) {
      expect(state.world.legacyChunkKeys).toEqual(knownKeys);
      expect(state.world.resources).toEqual(current.world.resources);
      expect(state.world.predators).toEqual(current.world.predators);
      expect(state.world.obstacles).toEqual(current.world.obstacles);
      expect(state.world.sleepingChunks).toEqual(current.world.sleepingChunks);
      expect(isRevealed(state.world, { x: 100, y: 100 })).toBe(true);
      expect(isRevealed(state.world, current.fly)).toBe(true);
    }
    syncWorld(migrated.current.world, { x: 5400, y: -1140 }, 0);
    expect(migrated.current.world.resources).toEqual(
      expect.arrayContaining(
        dormant.resources.map((resource) => expect.objectContaining(resource)),
      ),
    );
    expect(migrated.current.world.obstacles).toEqual(expect.arrayContaining(dormant.obstacles));
    expect(migrated.current.world.obstacles).toEqual(
      expect.arrayContaining(generateChunk(current.world.seed, 5, -2).obstacles),
    );
    syncWorld(migrated.current.world, { x: 600, y: 380 }, 0);
    expect(migrated.current.world.obstacles).toEqual(
      expect.arrayContaining(current.world.obstacles),
    );
    expect(
      migrated.current.world.resources.find((r) => r.id === current.world.resources[0].id)?.amount,
    ).toBe(19);
  });
});
