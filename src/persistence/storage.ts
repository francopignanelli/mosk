import type { Snapshot, ExperimentState } from '../shared/types';
import { migrateWorld } from '../world/generate';
import { DEFAULT_FLY_NAME, flyNameError, normalizeFlyName } from '../shared/flyName';
import { isAssayCheckpoint } from '../research/assay';
import { CONFIG } from '../simulation/config';
import { foodPeriod } from '../world/resources';

export interface ExperimentStorage {
  load(): Promise<Snapshot | null>;
  save(snapshot: Snapshot): Promise<void>;
}
const KEY = 'mosk.experiment.v1';
const fail = (message: string): never => {
  throw new Error(`Invalid experiment: ${message}`);
};
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null) &&
  !Object.keys(v).some((key) => unsafeKeys.has(key));
// A save-file precision limit, not an edge in the simulation. At this magnitude,
// double precision still retains substantially better than pixel-sized positions.
const MAX_COORDINATE = 1e12;
const MAX_EXPLORED_CHUNKS = 100000;
// Predators can migrate and gather in the same tile, so their limit applies to
// the whole saved life instead of assuming a fixed population in each tile.
const MAX_PREDATORS = 100000;
function num(v: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail(label);
}
function text(v: unknown, label: string, limit = 500) {
  if (typeof v !== 'string' || v.length > limit) fail(label);
}
function array(v: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) fail(label);
  return v as unknown[];
}
function chunkKey(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^-?\d+,-?\d+$/.test(value) || value.length > 40)
    return fail(label);
  const [x, y] = value.split(',').map(Number);
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    value !== `${x},${y}` ||
    Math.abs(x) > Math.ceil(MAX_COORDINATE / 1200) + 1 ||
    Math.abs(y) > Math.ceil(MAX_COORDINATE / 760) + 1
  )
    fail(label);
  return value;
}
function keys(value: unknown, label: string, max: number): Set<string> {
  const result = new Set<string>();
  for (const key of array(value, label, max)) {
    const parsed = chunkKey(key, label);
    if (result.has(parsed)) fail(`duplicate ${label}`);
    result.add(parsed);
  }
  return result;
}
function oneOf(value: unknown, allowed: readonly string[], label: string) {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(label);
}
const actions = [
  'exploring',
  'seeking food',
  'seeking water',
  'fleeing',
  'resting',
  'feeding',
  'drinking',
  'deceased',
];
function validateState(value: unknown, infinite: boolean, discovery = false) {
  if (!isRecord(value)) fail('missing state');
  const s = value as unknown as ExperimentState;
  if ('assay' in s && !isAssayCheckpoint(s.assay)) fail('memory assay checkpoint');
  num(s.generation, 'generation', 1);
  num(s.tick, 'tick');
  num(s.rngState, 'random state', 1, 4294967295);
  if (!Number.isInteger(s.tick) || !Number.isInteger(s.generation) || !Number.isInteger(s.rngState))
    fail('integer counters');
  if (!isRecord(s.world) || !isRecord(s.fly) || !isRecord(s.brain))
    fail('missing simulation domain');
  const w = s.world;
  const f = s.fly;
  // Names were added without changing the format of existing schema-3 lives.
  if (f.name !== undefined && (typeof f.name !== 'string' || flyNameError(f.name)))
    fail('fly name');
  text(w.seed, 'seed', 100);
  num(w.width, 'world width', 1200, 1200);
  num(w.height, 'world height', 760, 760);
  if (
    !infinite &&
    ['topology', 'activeChunkKeys', 'exploredChunks', 'sleepingChunks'].some((key) => key in w)
  )
    fail('legacy world contains incompatible chunk metadata');
  const active = infinite ? keys(w.activeChunkKeys, 'active chunks', 9) : new Set(['0,0']);
  if (infinite && (w.topology !== 'infinite' || active.size !== 9)) fail('infinite world topology');
  const explored = infinite
    ? keys(w.exploredChunks, 'explored chunks', MAX_EXPLORED_CHUNKS)
    : new Set(['0,0']);
  const point = (v: unknown) => {
    if (!isRecord(v)) fail('position');
    num(
      (v as Record<string, unknown>).x,
      'x coordinate',
      infinite ? -MAX_COORDINATE : 0,
      infinite ? MAX_COORDINATE : w.width,
    );
    num(
      (v as Record<string, unknown>).y,
      'y coordinate',
      infinite ? -MAX_COORDINATE : 0,
      infinite ? MAX_COORDINATE : w.height,
    );
  };
  point(f);
  if (discovery) {
    if (w.terrainVersion !== 2) fail('terrain version');
    keys(w.legacyChunkKeys, 'legacy chunks', MAX_EXPLORED_CHUNKS + 9);
    const seen = new Set<string>();
    for (const p of array(w.revealed, 'discovery points', 250000)) {
      point(p);
      const pos = p as { x: number; y: number };
      const key = `${Math.floor(pos.x / 80)},${Math.floor(pos.y / 80)}`;
      if (seen.has(key)) fail('duplicate discovery point');
      seen.add(key);
    }
    if (!seen.size) fail('missing discovery points');
  } else if (['terrainVersion', 'legacyChunkKeys', 'revealed'].some((key) => key in w)) {
    fail('legacy world contains incompatible discovery metadata');
  }
  if (infinite) {
    const centerX = Math.floor(f.x / w.width);
    const centerY = Math.floor(f.y / w.height);
    for (let y = centerY - 1; y <= centerY + 1; y++)
      for (let x = centerX - 1; x <= centerX + 1; x++)
        if (!active.has(`${x},${y}`)) fail('active chunks do not surround fly');
    if (!explored.has(`${centerX},${centerY}`)) fail('fly chunk is unexplored');
  }
  num(f.heading, 'heading', -1000, 1000);
  num(f.age, 'age');
  num(f.distance, 'distance');
  num(f.foodEaten, 'food consumed');
  num(f.encounters, 'encounters');
  if (typeof f.alive !== 'boolean' || !actions.includes(f.action) || !isRecord(f.vitals))
    fail('fly state');
  for (const key of ['energy', 'hunger', 'hydration', 'fatigue', 'threat', 'health'] as const)
    num(f.vitals[key], key, 0, 100);
  if (
    (f.alive && (f.vitals.health <= 0 || f.action === 'deceased')) ||
    (!f.alive && (f.action !== 'deceased' || f.vitals.health !== 0))
  )
    fail('inconsistent life state');
  array(f.trail, 'trail', 160).forEach(point);
  const resourceIds = new Set<string | number>();
  const predatorIds = new Set<string | number>();
  const entityId = (v: unknown, label: string, ids: Set<string | number>) => {
    if (typeof v === 'number') {
      num(v, `${label} ID`);
      if (!Number.isSafeInteger(v)) fail(`${label} ID`);
    } else if (
      !infinite ||
      typeof v !== 'string' ||
      !v.length ||
      v.length > 128 ||
      /[\u0000-\u001f\u007f]/.test(v) ||
      unsafeKeys.has(v)
    )
      fail(`${label} ID`);
    const id = v as string | number;
    if (ids.has(id)) fail(`duplicate ${label} ID`);
    ids.add(id);
  };
  const owner = (entity: Record<string, unknown>, sleepingKey?: string) => {
    if (!infinite) {
      if ('homeChunk' in entity) fail('legacy entity contains incompatible chunk metadata');
      return;
    }
    if (entity.homeChunk !== undefined) chunkKey(entity.homeChunk, 'entity home chunk');
    const positionKey = `${Math.floor((entity.x as number) / w.width)},${Math.floor((entity.y as number) / w.height)}`;
    if (sleepingKey ? positionKey !== sleepingKey : !active.has(positionKey))
      fail('entity chunk ownership');
  };
  const resource = (v: unknown, sleepingKey?: string) => {
    if (!isRecord(v)) fail('resource');
    const r = v as Record<string, unknown>;
    point(r);
    owner(r, sleepingKey);
    entityId(r.id, 'resource', resourceIds);
    oneOf(r.kind, ['food', 'water'], 'resource kind');
    num(r.radius, 'resource radius', 1, 80);
    num(r.capacity, 'resource capacity', 1, 100);
    num(r.amount, 'resource amount', 0, r.capacity as number);
    if (r.renewal !== undefined) {
      if (r.kind !== 'food' || !isRecord(r.renewal)) fail('food renewal');
      const renewal = r.renewal as Record<string, unknown>;
      const period = foodPeriod(w.seed, { id: r.id as string | number });
      num(renewal.originTick, 'food origin tick', -period, s.tick);
      num(renewal.updatedTick, 'food update tick', 0, s.tick);
      num(renewal.cycle, 'food cycle');
      if (
        !Number.isSafeInteger(renewal.originTick) ||
        !Number.isSafeInteger(renewal.updatedTick) ||
        !Number.isSafeInteger(renewal.cycle) ||
        typeof renewal.viable !== 'boolean' ||
        (renewal.originTick as number) > (renewal.updatedTick as number) ||
        renewal.cycle !==
          Math.floor(((renewal.updatedTick as number) - (renewal.originTick as number)) / period)
      )
        fail('food renewal counters');
    }
  };
  array(w.resources, 'resources', infinite ? 2250 : 250).forEach((v) => resource(v));
  array(w.obstacles, 'obstacles', infinite ? 2250 : 250).forEach((v) => {
    if (!isRecord(v)) fail('obstacle');
    const o = v as Record<string, unknown>;
    point(o);
    owner(o);
    num(o.radius, 'obstacle radius', 1, 80);
    if (!infinite) {
      num(o.x, 'obstacle boundary', (o.radius as number) + 10, w.width - (o.radius as number) - 10);
      num(
        o.y,
        'obstacle boundary',
        (o.radius as number) + 10,
        w.height - (o.radius as number) - 10,
      );
    }
    oneOf(o.kind, ['rock', 'plant'], 'obstacle kind');
  });
  array(w.regions, 'regions', infinite ? 270 : 30).forEach((v) => {
    if (!isRecord(v)) fail('region');
    const r = v as Record<string, unknown>;
    point(r);
    owner(r);
    num(r.radius, 'region radius', 1, 500);
    oneOf(r.kind, ['meadow', 'grove', 'refuge'], 'region kind');
  });
  const predator = (v: unknown, sleepingKey?: string) => {
    if (!isRecord(v)) fail('predator');
    const p = v as Record<string, unknown>;
    point(p);
    point(p.lastSeen);
    owner(p, sleepingKey);
    entityId(p.id, 'predator', predatorIds);
    if (predatorIds.size > MAX_PREDATORS) fail('too many predators');
    num(p.heading, 'predator heading', -1000, 1000);
    num(p.attention, 'predator memory', -1, 10);
    oneOf(p.mode, ['roaming', 'pursuing', 'searching'], 'predator mode');
  };
  array(w.predators, 'predators', infinite ? MAX_PREDATORS : 30).forEach((v) => predator(v));
  if (infinite) {
    if (!isRecord(w.sleepingChunks)) fail('sleeping chunks');
    const sleeping = Object.entries(w.sleepingChunks);
    if (sleeping.length > MAX_EXPLORED_CHUNKS) fail('too many sleeping chunks');
    for (const [key, chunk] of sleeping) {
      chunkKey(key, 'sleeping chunk key');
      if (active.has(key)) fail('active chunk also sleeping');
      if (!isRecord(chunk)) fail('sleeping chunk');
      num(chunk.lastTick, 'sleeping chunk tick', 0, s.tick);
      if (!Number.isSafeInteger(chunk.lastTick)) fail('sleeping chunk tick');
      array(chunk.resources, 'sleeping resources', 500).forEach((v) => resource(v, key));
      array(chunk.predators, 'sleeping predators', MAX_PREDATORS).forEach((v) => predator(v, key));
    }
  }
  if (w.predatorEncounter !== undefined) {
    const encounter = w.predatorEncounter;
    if (
      !isRecord(encounter) ||
      Object.keys(encounter).some(
        (key) => !['pursuerId', 'chaseRemaining', 'cooldownRemaining'].includes(key),
      )
    )
      fail('predator encounter');
    num(encounter.chaseRemaining, 'predator chase budget', 0, CONFIG.predatorChaseDuration);
    num(encounter.cooldownRemaining, 'predator recovery budget', 0, CONFIG.predatorRecoveryTime);
    if (encounter.pursuerId === null) {
      if (encounter.chaseRemaining !== 0) fail('inactive predator chase');
    } else {
      entityId(encounter.pursuerId, 'pursuer', new Set());
      if (
        !predatorIds.has(encounter.pursuerId) ||
        encounter.chaseRemaining <= 0 ||
        encounter.cooldownRemaining !== 0
      )
        fail('active predator chase');
    }
  }
  if (
    !['adaptive', 'random'].includes(s.brain.mode) ||
    !actions.includes(s.brain.action) ||
    !isRecord(s.brain.values)
  )
    fail('brain mode or state');
  num(s.brain.phase, 'brain phase', -1, 10);
  num(s.brain.turn, 'brain turn', -1, 1);
  if (Object.keys(s.brain.values).length > 30) fail('brain channels');
  Object.values(s.brain.values).forEach((v) => num(v, 'brain activation', 0, 1));
  array(s.events, 'events', 100000).forEach((v) => {
    if (!isRecord(v)) fail('event');
    const e = v as Record<string, unknown>;
    num(e.id, 'event ID');
    num(e.time, 'event time');
    text(e.message, 'event message');
    oneOf(
      e.kind,
      discovery
        ? ['birth', 'food', 'threat', 'rest', 'death', 'generation', 'exploration', 'intervention']
        : infinite
          ? ['birth', 'food', 'threat', 'rest', 'death', 'generation', 'exploration']
          : ['birth', 'food', 'threat', 'rest', 'death', 'generation'],
      'event kind',
    );
  });
  array(s.history, 'history', 500000).forEach((v) => {
    if (!isRecord(v)) fail('metric');
    const h = v as Record<string, unknown>;
    for (const key of ['time', 'distance', 'foodEaten', 'encounters']) num(h[key], `metric ${key}`);
    for (const key of ['energy', 'health', 'hunger', 'hydration'])
      num(h[key], `metric ${key}`, 0, 100);
  });
  if (typeof s.encounterActive !== 'boolean' || typeof s.touch !== 'boolean')
    fail('contact or encounter state');
  num(s.energySum, 'energy sum');
  num(s.energySamples, 'sample count');
  if (s.deathCause !== null) text(s.deathCause, 'death cause');
}
export function validateSnapshot(value: unknown): Snapshot {
  if (!isRecord(value) || ![1, 2, 3].includes(value.schemaVersion as number))
    fail('unsupported file version');
  const s = value as unknown as Snapshot;
  const infinite = (value as Record<string, unknown>).schemaVersion !== 1;
  const discovery = (value as Record<string, unknown>).schemaVersion === 3;
  if (typeof s.savedAt !== 'string' || !Number.isFinite(Date.parse(s.savedAt))) fail('save date');
  validateState(s.current, infinite, discovery);
  array(s.archive, 'archive', 1000).forEach((v) => {
    if (!isRecord(v)) fail('archive entry');
    const a = v as unknown as Snapshot['archive'][number];
    validateState(a.finalState, infinite, discovery);
    text(a.seed, 'archive seed', 100);
    text(a.cause, 'archive cause');
    num(a.generation, 'archive generation', 1);
    if (!Number.isSafeInteger(a.generation)) fail('archive generation');
    num(a.age, 'archive age');
    num(a.distance, 'archive distance');
    num(a.foodEaten, 'archive food');
    num(a.encounters, 'archive encounters');
    num(a.averageEnergy, 'average energy', 0, 100);
    if (!['adaptive', 'random'].includes(a.mode)) fail('archive brain mode');
  });
  const result = structuredClone(s);
  for (const state of [result.current, ...result.archive.map((a) => a.finalState)])
    state.fly.name = normalizeFlyName(state.fly.name ?? DEFAULT_FLY_NAME);
  if (!discovery) {
    // Validate every original life before transforming any state. Migration must
    // never conceal invalid legacy data or discard an archived experiment.
    result.schemaVersion = 3;
    for (const state of [result.current, ...result.archive.map((a) => a.finalState)]) {
      migrateWorld(state.world, state.fly, state.tick, state.fly.trail);
      validateState(state, true, true);
    }
  }
  return result;
}
export function parseSnapshot(json: string): Snapshot {
  if (json.length > 50 * 1024 * 1024) fail('file exceeds 50 MB');
  return validateSnapshot(JSON.parse(json));
}

/**
 * Recovery for an interrupted upgrade, such as Fast Refresh saving a migrated
 * current life beside older archives. Each life must be a complete, valid known
 * format. Partial discovery metadata is rejected, never discarded or repaired.
 */
export function recoverSnapshot(value: unknown): Snapshot {
  if (!isRecord(value) || ![1, 2, 3].includes(value.schemaVersion as number))
    fail('unsupported recovery version');
  const record = value as Record<string, unknown>;
  const entries = array(record.archive, 'archive', 1000);
  const states = [
    record.current,
    ...entries.map((entry) => {
      if (!isRecord(entry)) return fail('archive entry');
      return entry.finalState;
    }),
  ];
  for (const state of states) {
    if (!isRecord(state) || !isRecord(state.world)) fail('missing recovery state');
    const world = (state as Record<string, unknown>).world as Record<string, unknown>;
    const discovery = ['terrainVersion', 'legacyChunkKeys', 'revealed'].some((key) => key in world);
    const infinite = ['topology', 'activeChunkKeys', 'exploredChunks', 'sleepingChunks'].some(
      (key) => key in world,
    );
    if (discovery && !infinite) fail('incompatible recovery world');
    validateState(state, infinite, discovery);
  }
  const result = structuredClone(value) as unknown as Snapshot;
  result.schemaVersion = 3;
  for (const state of [result.current, ...result.archive.map((entry) => entry.finalState)])
    migrateWorld(state.world, state.fly, state.tick, state.fly.trail);
  // Recheck the canonical snapshot, including all archive summaries and dates.
  return validateSnapshot(result);
}

export const RECOVERY_KEY_PREFIX = 'mosk.recovery.';
export class IndexedDBStorage implements ExperimentStorage {
  private database: Promise<IDBDatabase> | null = null;
  private db() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('mosk', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('experiments');
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.database = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        this.database = null;
        reject(request.error ?? new Error('Storage could not be opened'));
      };
      request.onblocked = () => {
        this.database = null;
        reject(new Error('Storage is blocked by another tab'));
      };
    }));
  }
  async loadRaw(): Promise<unknown> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('experiments').objectStore('experiments').get(KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }
  async load(): Promise<Snapshot | null> {
    const raw = await this.loadRaw();
    return raw ? validateSnapshot(raw) : null;
  }
  /** Preserve the previous raw record and commit its replacement atomically. */
  async recover(snapshot: Snapshot): Promise<void> {
    const canonical = validateSnapshot(snapshot);
    const db = await this.db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('experiments', 'readwrite');
      const store = tx.objectStore('experiments');
      const previous = store.get(KEY);
      previous.onsuccess = () => {
        if (previous.result !== undefined)
          store.put(previous.result, `${RECOVERY_KEY_PREFIX}${crypto.randomUUID()}`);
        store.put(canonical, KEY);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Recovery write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('Recovery aborted'));
    });
  }
  async save(snapshot: Snapshot) {
    const db = await this.db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('experiments', 'readwrite');
      tx.objectStore('experiments').put(snapshot, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Save aborted'));
    });
  }
}
export const CHECKPOINT_KEY = 'mosk.exit-checkpoint.v1';
