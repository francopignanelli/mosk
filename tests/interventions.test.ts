import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../src/persistence/storage';
import { CONFIG } from '../src/simulation/config';
import { createExperiment, createSnapshot, stepExperiment } from '../src/simulation/engine';
import { syncWorld } from '../src/world/generate';
import { placeIntervention } from '../src/world/interventions';

function openHabitat() {
  const state = createExperiment('observer-brush');
  state.world.resources = [];
  state.world.obstacles = [];
  state.world.predators = [];
  state.world.regions = [];
  return state;
}

describe('observer habitat interventions', () => {
  it('lets a placed spider expose an immediate sensory and escape response', () => {
    const baseline = openHabitat();
    const observed = structuredClone(baseline);
    expect(placeIntervention(observed, 'spider', { x: 720, y: 380 }).ok).toBe(true);
    stepExperiment(baseline);
    stepExperiment(observed);
    expect(baseline.fly.action).toBe('exploring');
    expect(observed.fly.action).toBe('fleeing');
    expect(observed.brain.values.danger).toBeGreaterThan(0);
    expect(observed.fly.encounters).toBe(1);
  });

  it('moves a painted spider by the same pursuit rules as an existing spider', () => {
    const painted = openHabitat();
    expect(
      placeIntervention(painted, 'spider', { x: painted.fly.x + 100, y: painted.fly.y }).ok,
    ).toBe(true);
    const existing = openHabitat();
    existing.world.predators.push({
      ...painted.world.predators[0],
      id: 'existing-spider',
      mode: 'roaming',
      lastSeen: { x: painted.fly.x + 100, y: painted.fly.y },
      attention: 0,
    });
    stepExperiment(painted);
    stepExperiment(existing);
    const { id: _paintedId, ...paintedSpider } = painted.world.predators[0];
    const { id: _existingId, ...existingSpider } = existing.world.predators[0];
    expect(paintedSpider).toEqual(existingSpider);
    expect(painted.fly).toEqual(existing.fly);
    expect(painted.world.predatorEncounter?.chaseRemaining).toBe(
      existing.world.predatorEncounter?.chaseRemaining,
    );
  });

  it('places fresh food, refillable water, and a spider without advancing simulation randomness', () => {
    const state = openHabitat();
    const rng = state.rngState;
    const first = placeIntervention(state, 'food', { x: 700, y: 380 });
    const second = placeIntervention(state, 'water', { x: 600, y: 480 });
    const third = placeIntervention(state, 'spider', { x: 520, y: 380 });
    expect([first.ok, second.ok, third.ok]).toEqual([true, true, true]);
    expect(state.rngState).toBe(rng);
    expect(state.world.resources).toHaveLength(2);
    expect(state.world.resources[0]).toMatchObject({
      id: 'observer:food:0:1',
      kind: 'food',
      amount: 100,
      renewal: { originTick: 0, cycle: 0, updatedTick: 0, viable: true },
    });
    expect(state.world.resources[1]).toMatchObject({
      id: 'observer:water:0:2',
      kind: 'water',
      amount: 100,
    });
    expect(state.world.predators[0]).toMatchObject({
      id: 'observer:spider:0:3',
      mode: 'pursuing',
      lastSeen: { x: state.fly.x, y: state.fly.y },
      attention: CONFIG.predatorLoseTime,
    });
    expect(state.world.predatorEncounter).toEqual({
      pursuerId: 'observer:spider:0:3',
      chaseRemaining: CONFIG.predatorChaseDuration,
      cooldownRemaining: 0,
    });
    expect(state.events.slice(1).map((event) => event.kind)).toEqual([
      'intervention',
      'intervention',
      'intervention',
    ]);
    expect(state.events.at(-1)?.message).toMatch(/spider at \(520, 380\)/);

    const restored = parseSnapshot(JSON.stringify(createSnapshot(state, []))).current;
    expect(restored).toEqual(state);
    for (let i = 0; i < 30; i++) {
      stepExperiment(state);
      stepExperiment(restored);
    }
    expect(restored).toEqual(state);
  });

  it('starts a bounded controlled chase during recovery without replacing an active pursuer', () => {
    const state = openHabitat();
    state.world.predatorEncounter = {
      pursuerId: null,
      chaseRemaining: 0,
      cooldownRemaining: 5,
    };
    const placed = placeIntervention(state, 'spider', { x: state.fly.x + 100, y: state.fly.y });
    expect(placed.ok).toBe(true);
    expect(state.world.predatorEncounter?.pursuerId).toBe(state.world.predators[0].id);
    expect(state.world.predatorEncounter?.cooldownRemaining).toBe(0);
    stepExperiment(state);
    expect(state.world.predators[0].mode).toBe('pursuing');
    expect(state.fly.action).toBe('fleeing');

    const second = placeIntervention(state, 'spider', {
      x: state.fly.x - 100,
      y: state.fly.y,
    });
    expect(second.ok).toBe(true);
    expect(second.ok && second.message).toMatch(/Another spider owns/);
    expect(state.world.predatorEncounter?.pursuerId).toBe(state.world.predators[0].id);
    expect(state.world.predators[1].mode).toBe('roaming');

    for (let i = 0; i < Math.ceil(CONFIG.predatorChaseDuration / CONFIG.dt); i++)
      stepExperiment(state);
    expect(state.world.predatorEncounter?.pursuerId).toBeNull();
    expect(state.world.predatorEncounter?.cooldownRemaining).toBeGreaterThan(0);
  });

  it('keeps a distant painted spider roaming and explains the detection limit', () => {
    const state = openHabitat();
    const result = placeIntervention(state, 'spider', {
      x: state.fly.x + 200,
      y: state.fly.y,
    });
    expect(result.ok && result.message).toMatch(/Outside spider detection range/);
    expect(state.world.predators[0].mode).toBe('roaming');
    expect(state.world.predatorEncounter).toBeUndefined();
    stepExperiment(state);
    expect(state.world.predators[0].mode).toBe('roaming');
  });

  it('explains that a saved random-baseline fly does not flee a pursuing spider', () => {
    const state = openHabitat();
    state.brain.mode = 'random';
    const result = placeIntervention(state, 'spider', {
      x: state.fly.x + 100,
      y: state.fly.y,
    });
    expect(result.ok && result.message).toMatch(/Random baseline does not trigger an escape/);
    stepExperiment(state);
    expect(state.world.predators[0].mode).toBe('pursuing');
    expect(state.fly.action).not.toBe('fleeing');
  });

  it('rejects fog, invalid points, and dead lives without changing the saved life', () => {
    const state = openHabitat();
    const before = structuredClone(state);
    expect(placeIntervention(state, 'food', { x: 1000, y: 700 })).toMatchObject({ ok: false });
    expect(placeIntervention(state, 'water', { x: NaN, y: 380 })).toMatchObject({ ok: false });
    expect(placeIntervention(state, 'water', { x: 1e12 + 1, y: 380 })).toMatchObject({
      ok: false,
    });
    expect(state).toEqual(before);

    state.fly.alive = false;
    expect(placeIntervention(state, 'spider', { x: 700, y: 380 })).toMatchObject({ ok: false });
    expect(state.world).toEqual(before.world);
  });

  it('respects shelter, object spacing, and the fly’s immediate personal space', () => {
    const state = openHabitat();
    state.world.regions.push({ x: 730, y: 380, radius: 80, kind: 'refuge' });
    expect(placeIntervention(state, 'food', { x: 730, y: 380 })).toMatchObject({
      ok: false,
      reason: 'Refuges cannot be edited here.',
    });
    expect(placeIntervention(state, 'spider', { x: 730, y: 380 })).toMatchObject({ ok: false });
    // The outer refuge band is risky; only its core blocks spiders.
    expect(placeIntervention(state, 'spider', { x: 805, y: 380 }).ok).toBe(true);
    expect(placeIntervention(state, 'spider', { x: 620, y: 380 })).toMatchObject({ ok: false });
    state.world.obstacles.push({ x: 500, y: 380, radius: 20, kind: 'rock' });
    expect(placeIntervention(state, 'water', { x: 500, y: 380 })).toMatchObject({ ok: false });
    expect(placeIntervention(state, 'food', { x: 600, y: 480 }).ok).toBe(true);
    expect(placeIntervention(state, 'food', { x: 610, y: 480 })).toMatchObject({ ok: false });
  });

  it('keeps painted entities when their sector sleeps, then restores them after return', () => {
    const state = openHabitat();
    expect(placeIntervention(state, 'food', { x: 700, y: 380 }).ok).toBe(true);
    expect(placeIntervention(state, 'spider', { x: 520, y: 380 }).ok).toBe(true);
    state.fly.x = 6000;
    syncWorld(state.world, state.fly, state.tick);
    expect(
      state.world.sleepingChunks['0,0'].resources.some((r) => r.id === 'observer:food:0:1'),
    ).toBe(true);
    expect(
      state.world.sleepingChunks['0,0'].predators.some((p) => p.id === 'observer:spider:0:2'),
    ).toBe(true);
    state.fly.x = 600;
    syncWorld(state.world, state.fly, state.tick);
    expect(state.world.resources.some((r) => r.id === 'observer:food:0:1')).toBe(true);
    expect(state.world.predators.some((p) => p.id === 'observer:spider:0:2')).toBe(true);
    expect(() => parseSnapshot(JSON.stringify(createSnapshot(state, [])))).not.toThrow();
  });

  it('does not permit painting into a previously revealed but currently dormant sector', () => {
    const state = openHabitat();
    state.fly.x = 6000;
    syncWorld(state.world, state.fly, state.tick);
    const before = structuredClone(state);
    expect(placeIntervention(state, 'food', { x: 600, y: 380 })).toMatchObject({
      ok: false,
      reason: 'Explore this area before editing it.',
    });
    expect(state).toEqual(before);
  });
});
