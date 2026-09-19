import { describe, expect, it } from 'vitest';
import { panCamera, viewBounds } from '../src/rendering/camera';
import { terrainAtCameraIsActive, visibleTerrain } from '../src/rendering/terrain';
import { createExperiment, stepExperiment } from '../src/simulation/engine';
import { applyMotor } from '../src/motor/decode';
import { encodeSenses } from '../src/senses/encode';
import { updatePredators } from '../src/predators/update';
import { CONFIG } from '../src/simulation/config';
import { randomFrom } from '../src/shared/math';
import type { BrainOutput } from '../src/shared/types';
import { syncWorld } from '../src/world/generate';

const forward: BrainOutput = {
  action: 'exploring',
  turn: 0,
  speed: 1,
  feed: false,
  drink: false,
  nodes: [],
  edges: [],
};
describe('an unbounded environment', () => {
  it('streams and journals a sector only when the fly actually crosses into it', () => {
    const s = createExperiment('crossing');
    s.world.obstacles = [];
    s.world.predators = [];
    s.world.resources = [];
    s.fly.x = CONFIG.width - 0.1;
    s.fly.y = 380;
    s.fly.heading = 0;
    s.fly.vitals.hunger = 0;
    s.brain.phase = 5;
    s.brain.turn = 0;
    stepExperiment(s);
    expect(s.fly.x).toBeGreaterThan(CONFIG.width);
    expect(s.world.exploredChunks).toEqual(['0,0', '1,0']);
    expect(s.events.at(-1)?.kind).toBe('exploration');
    expect(s.world.resources.some((resource) => resource.x > CONFIG.width * 2)).toBe(true);
  });
  it('crosses positive and negative coordinates without a collision or a fake sensory wall', () => {
    const s = createExperiment('border');
    s.world.obstacles = [];
    s.fly.x = -0.2;
    s.fly.y = -0.2;
    s.fly.heading = Math.PI;
    expect(encodeSenses(s.world, s.fly, false).obstacle).toBeNull();
    expect(applyMotor(s.world, s.fly, forward, CONFIG.dt)).toBe(false);
    expect(s.fly.x).toBeLessThan(-0.2);
    s.fly.x = CONFIG.width - 0.1;
    s.fly.heading = 0;
    expect(applyMotor(s.world, s.fly, forward, CONFIG.dt)).toBe(false);
    expect(s.fly.x).toBeGreaterThan(CONFIG.width);
  });
  it('keeps actual terrain collision while removing map boundaries', () => {
    const s = createExperiment('rock');
    s.fly.x = -10;
    s.fly.y = -100;
    s.fly.heading = 0;
    s.world.obstacles = [{ x: 0, y: -100, radius: 20, kind: 'rock' }];
    expect(applyMotor(s.world, s.fly, forward, CONFIG.dt)).toBe(true);
    expect(s.fly.x).toBeLessThanOrEqual(-25);
  });
  it('allows predators to cross sectors instead of bouncing off former borders', () => {
    const s = createExperiment('spider-border');
    s.world.obstacles = [];
    s.world.regions = [];
    s.fly.x = 1250;
    s.fly.y = 200;
    const p = s.world.predators[0];
    p.x = 1199.9;
    p.y = 200;
    p.heading = 0;
    updatePredators(s.world, s.fly, CONFIG.dt, randomFrom(s));
    expect(p.x).toBeGreaterThan(1200);
    expect(p.mode).toBe('pursuing');
  });
  it('leaves faraway camera views ungenerated without discovery or trajectory changes', () => {
    const a = createExperiment('observer');
    const b = structuredClone(a);
    const bounds = viewBounds(900, 500, 1, { x: -12345, y: 54321 });
    const preview = visibleTerrain(a.world, bounds, a.tick);
    expect(preview).toEqual({ resources: [], obstacles: [], regions: [], predators: [] });
    expect(terrainAtCameraIsActive(a.world, { x: -12345, y: 54321 })).toBe(false);
    expect(preview).toEqual(visibleTerrain(a.world, bounds, a.tick));
    expect(a).toEqual(b);
    for (let i = 0; i < 120; i++) {
      stepExperiment(a);
      stepExperiment(b);
    }
    expect(a).toEqual(b);
  });
  it('shows remembered terrain without exposing dormant animals or changing stored supplies', () => {
    const state = createExperiment('remembered-terrain');
    const originFood = state.world.resources.find((resource) => resource.id === 1)!;
    originFood.amount = 3;
    const origin = { x: state.fly.x, y: state.fly.y };
    state.fly.x = 6000;
    syncWorld(state.world, state.fly, state.tick);
    state.tick = 3000;
    const before = structuredClone(state);
    const bounds = viewBounds(900, 500, 1, origin);
    const remembered = visibleTerrain(state.world, bounds, state.tick);
    expect(terrainAtCameraIsActive(state.world, origin)).toBe(true);
    expect(remembered.resources.find((resource) => resource.id === 1)?.amount).toBe(3);
    expect(remembered.obstacles.length).toBeGreaterThan(0);
    expect(remembered.predators).toEqual([]);
    expect(
      state.world.sleepingChunks['0,0'].resources.find((resource) => resource.id === 1)?.amount,
    ).toBe(3);
    expect(state).toEqual(before);
  });
  it('pans and zooms around arbitrary coordinates without a map clamp', () => {
    const c = { x: -8000, y: 9000 };
    const bounds = viewBounds(1200, 760, 1, c);
    expect(bounds.left).toBe(-8600);
    expect(bounds.top).toBe(8620);
    expect(panCamera(c, 1200, 760, bounds.scale)).toEqual({ x: -9200, y: 8240 });
    const zoom = viewBounds(1200, 760, 2, c);
    expect(zoom.right - zoom.left).toBe(600);
  });
});
