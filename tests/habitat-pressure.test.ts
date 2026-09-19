import { describe, expect, it } from 'vitest';
import { metabolize } from '../src/fly/metabolism';
import { applyMotor } from '../src/motor/decode';
import { updatePredators } from '../src/predators/update';
import { distance } from '../src/shared/math';
import type { BrainOutput } from '../src/shared/types';
import { CONFIG } from '../src/simulation/config';
import { createExperiment } from '../src/simulation/engine';
import { advanceWorldResources } from '../src/world/generate';

const output = (action: BrainOutput['action'], speed = 0): BrainOutput => ({
  action,
  speed,
  turn: 0,
  feed: action === 'feeding',
  drink: action === 'drinking',
  nodes: [],
  edges: [],
});

function openGround() {
  const state = createExperiment('controlled-pressure');
  state.world.obstacles = [];
  state.world.regions = [];
  state.world.resources = [];
  state.world.predators = [];
  state.fly.heading = 0;
  return state;
}

function spiderBehind(state: ReturnType<typeof openGround>) {
  state.world.predators.push({
    id: 'pursuer',
    x: state.fly.x - 100,
    y: state.fly.y,
    heading: 0,
    mode: 'pursuing',
    attention: CONFIG.predatorLoseTime,
    lastSeen: { x: state.fly.x, y: state.fly.y },
  });
}

describe('consequential habitat pressure', () => {
  it('retains an open-ground escape for a healthy fly but catches an energy-depleted fly', () => {
    const healthy = openGround();
    spiderBehind(healthy);
    const depleted = structuredClone(healthy);
    depleted.fly.vitals.energy = 8;
    const escape = output('fleeing', 1);
    for (let tick = 0; tick < 180; tick++) {
      for (const state of [healthy, depleted]) {
        applyMotor(state.world, state.fly, escape, CONFIG.dt);
        updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
        metabolize(state.world, state.fly, escape, CONFIG.dt);
      }
    }
    expect(distance(healthy.fly, healthy.world.predators[0])).toBeGreaterThan(100);
    expect(healthy.fly.vitals.health).toBe(100);
    expect(depleted.fly.vitals.health).toBeLessThan(95);
    expect(depleted.fly.vitals.hydration).toBeGreaterThan(0);
    expect(depleted.fly.vitals.energy).toBeGreaterThan(0);
  });

  it('makes short contact visible and requires a nourished rest to recover', () => {
    const state = openGround();
    spiderBehind(state);
    state.world.predators[0].x = state.fly.x;
    metabolize(state.world, state.fly, output('exploring', 0.65), 0.25);
    const injured = state.fly.vitals.health;
    expect(injured).toBeLessThan(96);
    state.world.predators = [];
    metabolize(state.world, state.fly, output('exploring', 0.65), 10);
    expect(state.fly.vitals.health).toBe(injured);
    metabolize(state.world, state.fly, output('resting'), 10);
    expect(state.fly.vitals.health).toBeGreaterThan(injured);
    const recovered = state.fly.vitals.health;
    state.fly.vitals.hydration = 15;
    metabolize(state.world, state.fly, output('resting'), 10);
    expect(state.fly.vitals.health).toBe(recovered);
  });

  it('cannot indefinitely survive by staying at a depleted food patch', () => {
    const state = openGround();
    state.fly.vitals.hunger = 90;
    state.world.resources = [
      {
        id: 'exhausted-patch',
        x: state.fly.x,
        y: state.fly.y,
        radius: 11,
        kind: 'food',
        amount: 1,
        capacity: 100,
      },
    ];
    const feed = output('feeding');
    for (let tick = 0; tick < 9600; tick++) {
      metabolize(state.world, state.fly, feed, CONFIG.dt);
      advanceWorldResources(state.world, state.world.resources, tick + 1, tick);
    }
    expect(state.fly.vitals.health).toBe(0);
    expect(state.fly.vitals.hunger).toBeGreaterThanOrEqual(98);
    expect(state.fly.vitals.hydration).toBeGreaterThan(30);
    expect(state.fly.vitals.energy).toBeGreaterThan(30);
  });
});
