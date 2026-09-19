import { describe, expect, it } from 'vitest';
import { getBrain } from '../src/brain/engine';
import { metabolize } from '../src/fly/metabolism';
import { updatePredators } from '../src/predators/update';
import { encodeSenses } from '../src/senses/encode';
import { distance } from '../src/shared/math';
import type { BrainOutput } from '../src/shared/types';
import { CONFIG } from '../src/simulation/config';
import { createExperiment } from '../src/simulation/engine';
import { isInRefugeCore, refugeAt, refugeCoreRadius } from '../src/world/refuge';

function setup() {
  const state = createExperiment('refuge-tests');
  state.world.regions = [{ x: 600, y: 380, radius: 100, kind: 'refuge' }];
  state.world.obstacles = [];
  state.world.resources = [];
  state.world.predators = [
    {
      id: 'test-spider',
      x: 680,
      y: 380,
      heading: Math.PI,
      mode: 'pursuing',
      lastSeen: { x: 600, y: 380 },
      attention: 3,
    },
  ];
  return state;
}

const rest: BrainOutput = {
  action: 'resting',
  turn: 0,
  speed: 0,
  feed: false,
  drink: false,
  nodes: [],
  edges: [],
};

describe('dense-cover refuges', () => {
  it('distinguishes the safe core, exact core boundary, exposed rim, and outside', () => {
    const { world } = setup();
    expect(refugeCoreRadius(world.regions[0])).toBeCloseTo(68);
    expect(isInRefugeCore(world.regions, { x: 668, y: 380 })).toBe(true);
    expect(isInRefugeCore(world.regions, { x: 668.01, y: 380 })).toBe(false);
    expect(refugeAt(world.regions, { x: 690, y: 380 })).toBeDefined();
    expect(refugeAt(world.regions, { x: 701, y: 380 })).toBeUndefined();
  });

  it('repairs a spider inside cover and breaks its pursuit without harming the fly', () => {
    const state = setup();
    const spider = state.world.predators[0];
    spider.x = state.fly.x;
    spider.y = state.fly.y;
    const replay = structuredClone(state);
    updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
    updatePredators(replay.world, replay.fly, CONFIG.dt, () => 0.5);
    expect(state).toEqual(replay);
    expect(distance(spider, state.world.regions[0])).toBeGreaterThanOrEqual(75);
    expect(spider.mode).toBe('roaming');
    expect(spider.attention).toBe(0);
    metabolize(state.world, state.fly, rest, CONFIG.dt);
    expect(state.fly.vitals.health).toBe(100);
  });

  it('blocks spider bodies throughout a sustained chase across a refuge', () => {
    const state = setup();
    const spider = state.world.predators[0];
    state.world.regions[0].radius = 40;
    spider.x = 645;
    state.fly.x = 555;
    for (let i = 0; i < 900; i++) {
      updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
      expect(distance(spider, state.world.regions[0])).toBeGreaterThanOrEqual(34.2);
      expect(Number.isFinite(spider.heading)).toBe(true);
    }
  });

  it('escapes overlapping cores without oscillating from one core into another', () => {
    const state = setup();
    state.world.regions = [
      { x: 550, y: 380, radius: 100, kind: 'refuge' },
      { x: 650, y: 380, radius: 100, kind: 'refuge' },
    ];
    const spider = state.world.predators[0];
    spider.x = 600;
    spider.y = 380;
    updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
    for (const region of state.world.regions)
      expect(distance(spider, region)).toBeGreaterThanOrEqual(75);
    expect(distance(spider, { x: 600, y: 380 })).toBeLessThan(80);
  });

  it('allows recovery in cover but restores threat perception and pursuit outside the core', () => {
    const state = setup();
    state.fly.vitals.hunger = 0;
    state.fly.vitals.fatigue = 90;
    const protectedSenses = encodeSenses(state.world, state.fly, false);
    expect(protectedSenses.predator).toBeNull();
    expect(
      getBrain('adaptive').step(protectedSenses, state.brain, CONFIG.dt, () => 0.5).action,
    ).toBe('resting');
    state.fly.x = 670;
    const exposedSenses = encodeSenses(state.world, state.fly, false);
    expect(exposedSenses.predator?.distance).toBe(10);
    expect(getBrain('adaptive').step(exposedSenses, state.brain, CONFIG.dt, () => 0.5).action).toBe(
      'fleeing',
    );
    updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
    expect(state.world.predators[0].mode).toBe('pursuing');
  });

  it('prevents attacks reaching across the core boundary but leaves the outer rim dangerous', () => {
    const state = setup();
    state.fly.x = 668;
    state.fly.vitals.health = 90;
    metabolize(state.world, state.fly, rest, 1);
    expect(state.fly.vitals.health).toBeGreaterThan(90);
    state.fly.x = 670;
    state.fly.vitals.health = 90;
    metabolize(state.world, state.fly, rest, 1);
    expect(state.fly.vitals.health).toBe(90 - CONFIG.predatorDamage);
  });

  it('still consumes supplies and permits death from dehydration inside the safe core', () => {
    const state = setup();
    const initialHunger = state.fly.vitals.hunger;
    const initialHydration = state.fly.vitals.hydration;
    metabolize(state.world, state.fly, rest, 1);
    expect(state.fly.vitals.hunger).toBeGreaterThan(initialHunger);
    expect(state.fly.vitals.hydration).toBeLessThan(initialHydration);
    state.fly.vitals.hydration = 0;
    state.fly.vitals.health = 0.01;
    expect(metabolize(state.world, state.fly, rest, 1).cause).toBe('Dehydration');
  });
});
