import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IndexedDBStorage,
  RECOVERY_KEY_PREFIX,
  recoverSnapshot,
  validateSnapshot,
} from '../src/persistence/storage';
import { archiveGeneration, createExperiment, createSnapshot } from '../src/simulation/engine';
import { generateLegacyChunk } from '../src/world/generate';

const KEY = 'mosk.experiment.v1';

function interruptedUpgrade() {
  const oldLife = createExperiment('old-generation', 5);
  const chunks = oldLife.world.activeChunkKeys.map((key) => {
    const [x, y] = key.split(',').map(Number);
    return generateLegacyChunk(oldLife.world.seed, x, y);
  });
  for (const kind of ['resources', 'obstacles', 'regions', 'predators'] as const)
    (oldLife.world[kind] as unknown[]) = chunks.flatMap((chunk) => chunk[kind] as unknown[]);
  const snapshot = JSON.parse(
    JSON.stringify(
      createSnapshot(createExperiment('current-generation', 6), [archiveGeneration(oldLife)]),
    ),
  );
  const world = snapshot.archive[0].finalState.world;
  delete world.terrainVersion;
  delete world.legacyChunkKeys;
  delete world.revealed;
  return snapshot;
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mosk', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('experiments');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function writeRaw(value: unknown) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('experiments', 'readwrite');
    tx.objectStore('experiments').put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function records() {
  const db = await database();
  const result = await new Promise<{ key: IDBValidKey; value: unknown }[]>((resolve, reject) => {
    const tx = db.transaction('experiments');
    const store = tx.objectStore('experiments');
    const keys = store.getAllKeys();
    const values = store.getAll();
    tx.oncomplete = () =>
      resolve(keys.result.map((key, index) => ({ key, value: values.result[index] })));
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return result;
}

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('interrupted upgrade recovery', () => {
  it.each([2, 3])(
    'recovers complete mixed world vintages under schema %s without losing archives',
    (version) => {
      const raw = interruptedUpgrade();
      raw.schemaVersion = version;
      const original = structuredClone(raw);
      expect(() => validateSnapshot(raw)).toThrow();
      const result = recoverSnapshot(raw);
      expect(raw).toEqual(original);
      expect(result.current).toEqual(raw.current);
      expect(result.archive).toHaveLength(1);
      expect(result.archive[0].finalState.fly).toEqual(raw.archive[0].finalState.fly);
      expect(result.archive[0].finalState.world.resources).toEqual(
        raw.archive[0].finalState.world.resources,
      );
      expect(result.archive[0].finalState.world.predators).toEqual(
        raw.archive[0].finalState.world.predators,
      );
      expect(result.archive[0].finalState.world.legacyChunkKeys).toEqual(
        raw.archive[0].finalState.world.activeChunkKeys,
      );
      expect(validateSnapshot(result)).toEqual(result);
    },
  );

  it('rejects partial discovery metadata and invalid archived states or summaries', () => {
    const partial = interruptedUpgrade();
    partial.archive[0].finalState.world.terrainVersion = 2;
    expect(() => recoverSnapshot(partial)).toThrow();
    const invalidState = interruptedUpgrade();
    invalidState.archive[0].finalState.fly.vitals.health = -1;
    expect(() => recoverSnapshot(invalidState)).toThrow();
    const invalidSummary = interruptedUpgrade();
    invalidSummary.archive[0].averageEnergy = 101;
    expect(() => recoverSnapshot(invalidSummary)).toThrow(/average energy/);
  });

  it('backs up the exact previous raw record and atomically writes a canonical replacement', async () => {
    const raw = interruptedUpgrade();
    await writeRaw(raw);
    const storage = new IndexedDBStorage();
    await expect(storage.load()).rejects.toThrow();
    const canonical = recoverSnapshot(await storage.loadRaw());
    await storage.recover(canonical);
    expect(await storage.load()).toEqual(canonical);
    const saved = await records();
    expect(saved.find((entry) => String(entry.key).startsWith(RECOVERY_KEY_PREFIX))?.value).toEqual(
      raw,
    );
    expect(saved).toHaveLength(2);
  });

  it('keeps the original record intact and rolls back its backup when the commit aborts', async () => {
    const raw = interruptedUpgrade();
    await writeRaw(raw);
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      const request = originalPut.call(this, value, key);
      if (key === KEY) this.transaction.abort();
      return request;
    });
    await expect(new IndexedDBStorage().recover(recoverSnapshot(raw))).rejects.toThrow();
    expect(await records()).toEqual([{ key: KEY, value: raw }]);
  });
});
