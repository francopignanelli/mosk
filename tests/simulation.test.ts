import { describe, expect, it } from 'vitest';
import {
  createExperiment,
  stepExperiment,
  createSnapshot,
  archiveGeneration,
} from '../src/simulation/engine';
import { encodeSenses } from '../src/senses/encode';
import { getBrain } from '../src/brain/engine';
import { randomFrom } from '../src/shared/math';
import { updatePredators } from '../src/predators/update';
import { parseSnapshot } from '../src/persistence/storage';
import { CONFIG } from '../src/simulation/config';
import { chunkKeyAt } from '../src/world/generate';

const advance = (s: ReturnType<typeof createExperiment>, n: number) => {
  for (let i = 0; i < n; i++) stepExperiment(s);
};
describe('deterministic simulation', () => {
  it('reproduces a complete seeded run', () => {
    const a = createExperiment('test');
    const b = createExperiment('test');
    advance(a, 1800);
    advance(b, 1800);
    expect(a).toEqual(b);
    expect(a.fly.distance).toBeGreaterThan(100);
    expect(a.fly.age).toBeCloseTo(60, 6);
    expect(createExperiment('other').world).not.toEqual(a.world);
  });
  it('resumes exactly from JSON, including brain and predator memory', () => {
    const a = createExperiment('continuation');
    advance(a, 1500);
    const b = parseSnapshot(JSON.stringify(createSnapshot(a, []))).current;
    advance(a, 900);
    advance(b, 900);
    expect(b).toEqual(a);
  });
  it('keeps a healthy default first life with meaningful food interaction', () => {
    const state = createExperiment();
    advance(state, 900);
    expect(state.fly.alive).toBe(true);
    expect(state.fly.foodEaten).toBeGreaterThan(0.3);
    expect(state.events.some((e) => e.kind === 'food')).toBe(true);
  });
  it.each(['orchard', 'forest', 'MOSK-0042', '999', 'field'])(
    'stays finite with locally loaded terrain for ten minutes: %s',
    (seed) => {
      const state = createExperiment(seed);
      advance(state, 18000);
      expect(state.fly.age).toBeGreaterThan(60);
      expect(Number.isFinite(state.fly.x)).toBe(true);
      expect(Number.isFinite(state.fly.y)).toBe(true);
      expect(state.world.activeChunkKeys).toContain(chunkKeyAt(state.world, state.fly));
      expect(state.world.activeChunkKeys).toHaveLength(9);
      Object.values(state.fly.vitals).forEach((v) => {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
      expect(() => parseSnapshot(JSON.stringify(createSnapshot(state, [])))).not.toThrow();
    },
  );
});
describe('local perception and behavior', () => {
  it('uses motor contact and does not latch a display-channel activation', () => {
    const s = createExperiment();
    s.world.obstacles = [];
    s.world.predators = [];
    s.brain.values.contact = 1;
    advance(s, 300);
    expect(s.touch).toBe(false);
    expect(s.brain.values.contact).toBeLessThan(0.01);
    s.fly.x = 10;
    s.fly.heading = Math.PI;
    s.fly.vitals.hunger = 0;
    s.world.resources = [];
    advance(s, 1);
    expect(s.fly.x).toBeLessThan(10);
  });
  it('cannot detect changes to food outside its scent radius', () => {
    const state = createExperiment('local');
    state.world.resources = [
      { id: 1, x: 10, y: 10, radius: 11, kind: 'food', amount: 100, capacity: 100 },
    ];
    const before = encodeSenses(state.world, state.fly, false);
    state.world.resources[0].x = 1190;
    expect(encodeSenses(state.world, state.fly, false)).toEqual(before);
    expect(before.food).toBeNull();
    expect('world' in before).toBe(false);
  });
  it('feeds nearby, drinks when thirsty, rests when fatigued, and flees danger', () => {
    const s = createExperiment();
    s.world.predators = [];
    s.world.obstacles = [];
    const senses = encodeSenses(s.world, s.fly, false);
    const brain = getBrain('adaptive');
    const random = randomFrom(s);
    senses.food = { distance: 5, bearing: 0, strength: 0.9 };
    senses.internal.hunger = 70;
    expect(brain.step(senses, s.brain, CONFIG.dt, random).action).toBe('feeding');
    senses.water = { distance: 5, bearing: 0, strength: 0.9 };
    senses.internal.hydration = 20;
    expect(brain.step(senses, s.brain, CONFIG.dt, random).action).toBe('drinking');
    senses.internal.hydration = 100;
    senses.internal.hunger = 0;
    senses.internal.fatigue = 90;
    expect(brain.step(senses, s.brain, CONFIG.dt, random).action).toBe('resting');
    senses.predator = { distance: 20, bearing: 0, strength: 0.9 };
    expect(brain.step(senses, s.brain, CONFIG.dt, random).action).toBe('fleeing');
  });
  it('spiders pursue, search, then return to roaming', () => {
    const s = createExperiment();
    s.world.regions = [];
    s.world.obstacles = [];
    const p = s.world.predators[0];
    p.x = s.fly.x - 90;
    p.y = s.fly.y;
    const random = randomFrom(s);
    updatePredators(s.world, s.fly, CONFIG.dt, random);
    expect(p.mode).toBe('pursuing');
    // Outside detection, but still inside the locally simulated neighborhood.
    s.fly.x = 950;
    s.fly.y = 380;
    updatePredators(s.world, s.fly, CONFIG.dt, random);
    expect(p.mode).toBe('searching');
    for (let i = 0; i < 100; i++) updatePredators(s.world, s.fly, CONFIG.dt, random);
    expect(p.mode).toBe('roaming');
  });
  it('freezes a deceased fly and preserves a complete generation record', () => {
    const s = createExperiment();
    s.fly.vitals.health = 0.001;
    s.fly.vitals.hydration = 0;
    s.world.resources = [];
    stepExperiment(s);
    expect(s.fly.alive).toBe(false);
    const dead = structuredClone(s);
    advance(s, 300);
    expect(s).toEqual(dead);
    const archived = archiveGeneration(s);
    expect(archived.finalState).toEqual(dead);
    expect(archived.cause).toBe('Dehydration');
    const successor = createExperiment('new', 2);
    advance(successor, 20);
    expect(archived.finalState).toEqual(dead);
  });
});
