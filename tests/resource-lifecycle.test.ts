import { describe, expect, it } from 'vitest';
import { createExperiment, createSnapshot, stepExperiment } from '../src/simulation/engine';
import { advanceWorldResources, chunkKeyAt, syncWorld } from '../src/world/generate';
import { advanceResources, foodPeriod } from '../src/world/resources';
import { parseSnapshot } from '../src/persistence/storage';
import { visibleTerrain } from '../src/rendering/terrain';
import { viewBounds } from '../src/rendering/camera';
import { distance } from '../src/shared/math';
import { CONFIG } from '../src/simulation/config';

const initialized = () => {
  const state = createExperiment('fruit-succession');
  advanceWorldResources(state.world, state.world.resources, 0, 0);
  return state;
};
const starter = (state: ReturnType<typeof initialized>) =>
  state.world.resources.find((r) => r.id === 1)!;

describe('changing food patches', () => {
  it('preserves consumed fruit while water refills and fades uneaten fruit to an empty interval', () => {
    const state = initialized();
    const food = starter(state);
    const water = state.world.resources.find((r) => r.id === 0)!;
    food.amount = 3;
    water.amount = 3;
    advanceWorldResources(state.world, state.world.resources, 3000, 0);
    expect(food.amount).toBe(3);
    expect(water.amount).toBeCloseTo(3 + 100 * CONFIG.resourceRegrowth);
    const expiry = Math.ceil(food.renewal!.originTick + foodPeriod(state.world.seed, food) * 0.9);
    advanceWorldResources(state.world, state.world.resources, expiry, 3000);
    expect(food.amount).toBe(0);
  });

  it('replaces expired fruit at a deterministic clear position and ripens gradually without adding slots', () => {
    const state = initialized();
    const food = starter(state);
    const original = { x: food.x, y: food.y };
    const count = state.world.resources.length;
    const next = food.renewal!.originTick + foodPeriod(state.world.seed, food);
    const rng = state.rngState;
    advanceWorldResources(state.world, state.world.resources, next, 0);
    expect(food.amount).toBe(0);
    expect({ x: food.x, y: food.y }).not.toEqual(original);
    advanceWorldResources(state.world, state.world.resources, next + 225, next);
    expect(food.amount).toBeCloseTo(50);
    food.amount -= 20;
    advanceWorldResources(state.world, state.world.resources, next + 450, next + 225);
    expect(food.amount).toBeCloseTo(80);
    expect(state.rngState).toBe(rng);
    expect(state.world.resources).toHaveLength(count);
    expect(chunkKeyAt(state.world, food)).toBe('0,0');
    expect(
      state.world.obstacles.every((o) => distance(o, food) >= o.radius + food.radius + 15),
    ).toBe(true);
    expect(
      state.world.regions
        .filter((r) => r.kind === 'refuge')
        .every((r) => distance(r, food) >= r.radius + 35),
    ).toBe(true);
  });

  it('gives a dormant sector the same unconsumed fruit as repeated active updates, with bounded long catch-up', () => {
    const live = initialized();
    const dormant = structuredClone(live);
    const finalTick = 48000;
    for (let tick = 30; tick <= finalTick; tick += 30)
      advanceWorldResources(live.world, live.world.resources, tick, tick - 30);
    advanceWorldResources(dormant.world, dormant.world.resources, finalTick, 0);
    for (let i = 0; i < live.world.resources.length; i++) {
      const a = live.world.resources[i],
        b = dormant.world.resources[i];
      expect({ x: a.x, y: a.y, renewal: a.renewal }).toEqual({
        x: b.x,
        y: b.y,
        renewal: b.renewal,
      });
      expect(a.amount).toBeCloseTo(b.amount, 8);
    }
    advanceWorldResources(dormant.world, dormant.world.resources, 1e12, finalTick);
    expect(dormant.world.resources).toHaveLength(live.world.resources.length);
    expect(
      dormant.world.resources.every(
        (r) => Number.isFinite(r.x) && r.amount >= 0 && r.amount <= r.capacity,
      ),
    ).toBe(true);
  });

  it('projects changed remembered fruit without changing the save, then restores exactly that projection on return', () => {
    const state = initialized();
    const origin = { x: state.fly.x, y: state.fly.y };
    state.fly.x = -6000;
    syncWorld(state.world, state.fly, 0);
    state.tick = 30000;
    const before = structuredClone(state);
    const preview = visibleTerrain(state.world, viewBounds(1200, 760, 1, origin), state.tick);
    const projected = preview.resources.find((r) => r.id === 1)!;
    expect(state).toEqual(before);
    Object.assign(state.fly, origin);
    syncWorld(state.world, state.fly, state.tick);
    expect(starter(state)).toEqual(projected);
    expect(() => parseSnapshot(JSON.stringify(createSnapshot(state, [])))).not.toThrow();
    expect(new Set(state.world.resources.map((r) => r.id)).size).toBe(state.world.resources.length);
  });

  it('keeps a fully obstructed replacement absent until a later cycle', () => {
    const state = initialized();
    const food = starter(state);
    const next = food.renewal!.originTick + foodPeriod(state.world.seed, food);
    const blocked = () => ({
      obstacles: [],
      resources: [],
      regions: [{ x: 600, y: 380, radius: 100000, kind: 'refuge' as const }],
    });
    advanceResources([food], state.world, next + 450, 0, blocked);
    expect(food.renewal!.viable).toBe(false);
    expect(food.amount).toBe(0);
    advanceResources([food], state.world, next + 900, next + 450, () => ({
      obstacles: [],
      resources: [],
      regions: [],
    }));
    expect(food.amount).toBe(0);
  });

  it('accepts older resources, preserves exact resumed simulation, and rejects malformed renewal counters', () => {
    const legacy = createExperiment('legacy-fruit');
    expect(() => parseSnapshot(JSON.stringify(createSnapshot(legacy, [])))).not.toThrow();
    const state = initialized();
    for (let i = 0; i < 60; i++) stepExperiment(state);
    const restored = parseSnapshot(JSON.stringify(createSnapshot(state, []))).current;
    for (let i = 0; i < 120; i++) {
      stepExperiment(state);
      stepExperiment(restored);
    }
    expect(restored).toEqual(state);
    for (const mutation of [
      { cycle: -1 },
      { updatedTick: state.tick + 1 },
      { viable: 'yes' },
      { originTick: NaN },
    ]) {
      const snapshot = createSnapshot(state, []);
      Object.assign(starter(snapshot.current).renewal!, mutation);
      expect(() => parseSnapshot(JSON.stringify(snapshot))).toThrow('food');
    }
  });
});
