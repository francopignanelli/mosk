import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../src/persistence/storage';
import { updatePredators } from '../src/predators/update';
import { distance } from '../src/shared/math';
import type { Predator } from '../src/shared/types';
import { CONFIG } from '../src/simulation/config';
import { createExperiment, createSnapshot, stepExperiment } from '../src/simulation/engine';
import { syncWorld } from '../src/world/generate';

function setup(count = 1) {
  const state = createExperiment('bounded-spiders');
  state.world.obstacles = [];
  state.world.regions = [];
  state.world.predators = Array.from({ length: count }, (_, i): Predator => {
    const angle = (i * Math.PI * 2) / count;
    return {
      id: `fixture-${i}`,
      x: state.fly.x + Math.cos(angle) * 90,
      y: state.fly.y + Math.sin(angle) * 90,
      heading: angle + Math.PI,
      mode: 'roaming',
      lastSeen: { x: state.fly.x, y: state.fly.y },
      attention: 0,
    };
  });
  return state;
}

function update(state: ReturnType<typeof setup>, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / CONFIG.dt); i++)
    updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
}

describe('bounded predator encounters', () => {
  it('lets a spider detect the fly before the utility controller starts fleeing', () => {
    const state = setup();
    state.world.resources = [];
    const spider = state.world.predators[0];
    spider.x = state.fly.x + 140;
    state.fly.heading = Math.PI;
    stepExperiment(state);
    expect(state.fly.action).toBe('exploring');
    expect(spider.mode).toBe('pursuing');
    for (let tick = 0; tick < 30; tick++) stepExperiment(state);
    expect(state.fly.action).toBe('fleeing');
    expect(state.world.predatorEncounter?.chaseRemaining).toBeLessThan(8);
  });

  it('allows only one pursuer in a dense group and ends sustained visual pursuit', () => {
    const state = setup(12);
    let pursuedTicks = 0;
    for (let i = 0; i < 270; i++) {
      // Keep the same nearby fly in sight: visibility must not refill the budget.
      for (const [index, p] of state.world.predators.entries()) {
        p.x = state.fly.x + 45 + index;
        p.y = state.fly.y;
      }
      updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
      const active = state.world.predators.filter((p) => p.mode !== 'roaming');
      expect(active.length).toBeLessThanOrEqual(1);
      if (active.length) pursuedTicks++;
    }
    expect(pursuedTicks).toBeGreaterThan(200);
    expect(pursuedTicks).toBeLessThanOrEqual(CONFIG.predatorChaseDuration / CONFIG.dt + 1);
    expect(state.world.predatorEncounter?.pursuerId).toBeNull();
    expect(state.world.predatorEncounter?.cooldownRemaining).toBeGreaterThan(10);
  });

  it('applies the recovery gap to new spiders and resumes encounters after it expires', () => {
    const state = setup();
    update(state, 8.1);
    expect(state.world.predatorEncounter?.cooldownRemaining).toBeGreaterThan(0);
    state.world.predators = [
      { ...state.world.predators[0], id: 'newcomer', x: state.fly.x + 60, mode: 'roaming' },
    ];
    for (let i = 0; i < 300; i++) {
      state.world.predators[0].x = state.fly.x + 60;
      state.world.predators[0].y = state.fly.y;
      updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
      expect(state.world.predators[0].mode).toBe('roaming');
    }
    for (let i = 0; i < 75; i++) {
      state.world.predators[0].x = state.fly.x + 60;
      state.world.predators[0].y = state.fly.y;
      updatePredators(state.world, state.fly, CONFIG.dt, () => 0.5);
    }
    expect(state.world.predators[0].mode).toBe('pursuing');
  });

  it('breaks a pursuit at cover and carries the gap across streamed terrain', () => {
    const state = setup();
    update(state, 0.1);
    state.world.regions = [{ ...state.fly, radius: 100, kind: 'refuge' }];
    update(state, CONFIG.dt);
    expect(state.world.predatorEncounter?.pursuerId).toBeNull();
    expect(state.world.predatorEncounter?.cooldownRemaining).toBe(CONFIG.predatorRecoveryTime);
    const budget = structuredClone(state.world.predatorEncounter);
    state.fly.x += 3600;
    syncWorld(state.world, state.fly, state.tick);
    expect(state.world.predatorEncounter).toEqual(budget);
    update(state, CONFIG.dt);
    expect(state.world.predators.every((p) => p.mode === 'roaming')).toBe(true);
    state.fly.x -= 3600;
    syncWorld(state.world, state.fly, state.tick);
    expect(state.world.predatorEncounter?.cooldownRemaining).toBeGreaterThan(11.9);
  });

  it('upgrades legacy pursuers once and resumes the exact remaining budget from JSON', () => {
    const state = setup(3);
    for (const p of state.world.predators) {
      p.mode = 'pursuing';
      p.attention = 3;
    }
    update(state, 3);
    expect(state.world.predatorEncounter?.chaseRemaining).toBeCloseTo(5);
    const restored = parseSnapshot(JSON.stringify(createSnapshot(state, []))).current;
    expect(restored.world.predatorEncounter).toEqual(state.world.predatorEncounter);
    update(state, 6);
    update(restored, 6);
    expect(restored).toEqual(state);
    expect(restored.world.predatorEncounter?.cooldownRemaining).toBeGreaterThan(0);
  });

  it('allows the utility fly to leave a dense group instead of only changing predator labels', () => {
    const state = setup(8);
    const gaps: number[] = [];
    let longestGap = 0;
    let gap = 0;
    for (let i = 0; i < 1200; i++) {
      stepExperiment(state);
      if (state.fly.action !== 'fleeing') {
        gap++;
        longestGap = Math.max(longestGap, gap);
      } else gap = 0;
      if (i === 600)
        gaps.push(Math.min(...state.world.predators.map((p) => distance(p, state.fly))));
    }
    expect(state.fly.alive).toBe(true);
    expect(state.fly.distance).toBeGreaterThan(200);
    expect(longestGap * CONFIG.dt).toBeGreaterThan(5);
    expect(gaps[0]).toBeGreaterThan(100);
  });

  it('rejects invalid encounter budgets and accepts older saves without them', () => {
    const state = setup();
    expect(() => parseSnapshot(JSON.stringify(createSnapshot(state, [])))).not.toThrow();
    update(state, 0.1);
    for (const change of [
      { chaseRemaining: -1 },
      { chaseRemaining: 999 },
      { cooldownRemaining: 1 },
      { pursuerId: 'missing' },
      { pursuerId: null },
    ]) {
      const invalid = createSnapshot(state, []);
      Object.assign(invalid.current.world.predatorEncounter!, change);
      expect(() => parseSnapshot(JSON.stringify(invalid))).toThrow(/predator|pursuer/);
    }
  });
});
