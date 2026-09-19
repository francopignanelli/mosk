import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDBStorage, parseSnapshot, validateSnapshot } from '../src/persistence/storage';
import {
  archiveGeneration,
  createExperiment,
  createSnapshot,
  stepExperiment,
} from '../src/simulation/engine';
import { syncWorld } from '../src/world/generate';

describe('experiment persistence', () => {
  it('saves to IndexedDB and restores full current and archived lives through a new storage instance', async () => {
    const current = createExperiment('persistence', 2);
    for (let i = 0; i < 500; i++) stepExperiment(current);
    const snapshot = createSnapshot(current, [archiveGeneration(createExperiment('previous', 1))]);
    await new IndexedDBStorage().save(snapshot);
    const restored = await new IndexedDBStorage().load();
    expect(restored).toEqual(snapshot);
    stepExperiment(current);
    stepExperiment(restored!.current);
    expect(restored!.current).toEqual(current);
  });
  it('rejects malformed, unsupported, and nonfinite imports', () => {
    expect(() => parseSnapshot('{')).toThrow();
    expect(() => validateSnapshot({ schemaVersion: 9 })).toThrow(/version/);
    const snapshot = createSnapshot(createExperiment(), []);
    snapshot.current.fly.x = Infinity;
    expect(() => validateSnapshot(snapshot)).toThrow(/coordinate/);
  });
  it('rejects incompatible modes, invalid resource values and missing brain state', () => {
    const snapshot = createSnapshot(createExperiment(), []);
    expect(() =>
      validateSnapshot({
        ...snapshot,
        current: { ...snapshot.current, brain: { mode: 'MaleCNS' } },
      }),
    ).toThrow();
    snapshot.current.world.resources[0].amount = -100;
    expect(() => validateSnapshot(snapshot)).toThrow(/amount/);
  });
  it('does not mutate live input while validating a snapshot', () => {
    const snapshot = createSnapshot(createExperiment(), []);
    const result = validateSnapshot(snapshot);
    result.current.fly.x = 500;
    expect(snapshot.current.fly.x).toBe(600);
  });
  it('accepts terrain crossing old world edges and rejects invalid obstacle geometry', () => {
    const snapshot = createSnapshot(createExperiment(), []);
    snapshot.current.world.obstacles = [{ x: 30, y: 380, radius: 80, kind: 'rock' }];
    expect(() => validateSnapshot(snapshot)).not.toThrow();
    snapshot.current.world.obstacles[0].radius = 81;
    expect(() => validateSnapshot(snapshot)).toThrow(/radius/);
  });
  it('roundtrips signed world positions and sleeping habitat before deterministic continuation', () => {
    const current = createExperiment('far-from-origin');
    current.world.resources[0].amount = 12;
    current.fly.x = -2405;
    current.fly.y = 1525;
    syncWorld(current.world, current.fly, current.tick);
    for (let i = 0; i < 60; i++) stepExperiment(current);
    const restored = parseSnapshot(JSON.stringify(createSnapshot(current, [])));
    expect(Object.keys(restored.current.world.sleepingChunks).length).toBeGreaterThan(0);
    expect(restored.current).toEqual(current);
    for (let i = 0; i < 90; i++) {
      stepExperiment(current);
      stepExperiment(restored.current);
    }
    expect(restored.current).toEqual(current);
  });
  it('rejects duplicate entity IDs across active and sleeping chunks', () => {
    const current = createExperiment('duplicate-inactive');
    current.fly.x = 6000;
    syncWorld(current.world, current.fly, current.tick);
    const snapshot = createSnapshot(current, []);
    const sleeping = Object.values(snapshot.current.world.sleepingChunks).find(
      (chunk) => chunk.resources.length > 0,
    );
    sleeping!.resources[0].id = snapshot.current.world.resources[0].id;
    expect(() => validateSnapshot(snapshot)).toThrow(/duplicate resource ID/);
  });
  it('rejects invalid chunk keys, duplicate chunk membership, and active sleeping chunks', () => {
    const original = createSnapshot(createExperiment(), []);
    const invalidKey = structuredClone(original);
    invalidKey.current.world.exploredChunks.push('01,0');
    expect(() => validateSnapshot(invalidKey)).toThrow(/explored chunks/);
    const duplicate = structuredClone(original);
    duplicate.current.world.activeChunkKeys[0] = duplicate.current.world.activeChunkKeys[1];
    expect(() => validateSnapshot(duplicate)).toThrow(/duplicate active chunks/);
    const overlap = structuredClone(original);
    overlap.current.world.sleepingChunks['0,0'] = { resources: [], predators: [], lastTick: 0 };
    expect(() => validateSnapshot(overlap)).toThrow(/active chunk also sleeping/);
    const wrongCenter = structuredClone(original);
    wrongCenter.current.fly.x = 6000;
    expect(() => validateSnapshot(wrongCenter)).toThrow(/surround fly/);
  });
  it('rejects unsafe object keys, custom prototypes, and nonfinite sleeping state', () => {
    const current = createExperiment('unsafe-inactive');
    current.fly.x = 6000;
    syncWorld(current.world, current.fly, current.tick);
    const snapshot = createSnapshot(current, []);
    const unsafe = JSON.parse(JSON.stringify(snapshot));
    Object.defineProperty(unsafe.current.world.sleepingChunks, '__proto__', {
      value: { resources: [], predators: [], lastTick: 0 },
      enumerable: true,
    });
    expect(() => validateSnapshot(unsafe)).toThrow(/sleeping chunks/);
    const customPrototype = structuredClone(snapshot);
    Object.setPrototypeOf(customPrototype.current.world.sleepingChunks, { injected: true });
    expect(() => validateSnapshot(customPrototype)).toThrow(/sleeping chunks/);
    Object.values(snapshot.current.world.sleepingChunks)[0].lastTick = NaN;
    expect(() => validateSnapshot(snapshot)).toThrow(/sleeping chunk tick/);
  });
  it('rejects coordinates beyond the save format precision limit', () => {
    const snapshot = createSnapshot(createExperiment(), []);
    snapshot.current.fly.trail.push({ x: -1e12 - 1, y: 0 });
    expect(() => validateSnapshot(snapshot)).toThrow(/coordinate/);
  });
  it.each(['resources', 'obstacles', 'regions', 'predators'] as const)(
    'rejects active %s outside the active neighborhood',
    (kind) => {
      const snapshot = createSnapshot(createExperiment(), []);
      snapshot.current.world[kind][0].x = 6000;
      expect(() => validateSnapshot(snapshot)).toThrow(/chunk ownership/);
    },
  );
  it.each(['resources', 'predators'] as const)(
    'rejects sleeping %s stored in a different coordinate chunk',
    (kind) => {
      const current = createExperiment('misplaced-sleeping');
      current.fly.x = 6000;
      syncWorld(current.world, current.fly, current.tick);
      const snapshot = createSnapshot(current, []);
      const chunk = Object.values(snapshot.current.world.sleepingChunks).find(
        (entry) => entry[kind].length > 0,
      )!;
      chunk[kind][0].x += current.world.width;
      expect(() => validateSnapshot(snapshot)).toThrow(/chunk ownership/);
    },
  );
});
