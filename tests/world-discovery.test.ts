import { describe, expect, it } from 'vitest';
import { createExperiment, createSnapshot, stepExperiment } from '../src/simulation/engine';
import { parseSnapshot } from '../src/persistence/storage';
import { panCamera, viewBounds } from '../src/rendering/camera';
import { visibleTerrain } from '../src/rendering/terrain';
import { generateWorld, syncWorld } from '../src/world/generate';
import {
  isRevealed,
  REVEAL_RADIUS,
  revealAt,
  revealedPointsInBounds,
} from '../src/world/discovery';

describe('progressive exploration fog', () => {
  it('reveals a local area at birth while buffered neighboring sectors remain undiscovered', () => {
    const { world } = generateWorld('first-light');
    expect(world.revealed).toEqual([{ x: 600, y: 380 }]);
    expect(world.activeChunkKeys).toHaveLength(9);
    expect(isRevealed(world, { x: 600, y: 380 })).toBe(true);
    expect(isRevealed(world, { x: 700, y: 480 })).toBe(true);
    expect(isRevealed(world, { x: 600 + REVEAL_RADIUS + 1, y: 380 })).toBe(false);
    expect(isRevealed(world, { x: 1800, y: 380 })).toBe(false);
  });

  it('records actual visited points within a sector, deduplicates revisits, and handles negative coordinates', () => {
    const { world } = generateWorld('walked-path');
    const visited = { x: 101, y: 101 };
    revealAt(world, visited);
    visited.x = 999;
    expect(world.revealed).toContainEqual({ x: 101, y: 101 });
    revealAt(world, { x: 110, y: 115 });
    expect(world.revealed).toHaveLength(2);
    syncWorld(world, { x: 950, y: 380 }, 0);
    expect(world.exploredChunks).toEqual(['0,0']);
    expect(isRevealed(world, { x: 1050, y: 380 })).toBe(true);
    syncWorld(world, { x: -101, y: -101 }, 0);
    expect(isRevealed(world, { x: -200, y: -200 })).toBe(true);
    expect(isRevealed(world, { x: -900, y: -900 })).toBe(false);
    const length = world.revealed.length;
    syncWorld(world, { x: -101, y: -101 }, 0);
    expect(world.revealed).toHaveLength(length);
  });

  it('includes only reveal circles intersecting the camera bounds without changing exploration', () => {
    const { world } = generateWorld('bounded-discovery');
    revealAt(world, { x: -5000, y: 5000 });
    const before = structuredClone(world);
    expect(revealedPointsInBounds(world, { left: 800, right: 900, top: 300, bottom: 400 })).toEqual(
      [{ x: 600, y: 380 }],
    );
    expect(
      revealedPointsInBounds(world, { left: 2000, right: 2500, top: 3000, bottom: 3500 }),
    ).toEqual([]);
    expect(world).toEqual(before);
  });

  it('retains previously explored areas after unloading, saving, restoring and returning', () => {
    const state = createExperiment('remembered-terrain');
    Object.assign(state.fly, { x: 6500, y: -3000 });
    syncWorld(state.world, state.fly, state.tick);
    expect(state.world.activeChunkKeys).not.toContain('0,0');
    const restored = parseSnapshot(JSON.stringify(createSnapshot(state, []))).current;
    expect(restored.world.revealed).toEqual(state.world.revealed);
    expect(isRevealed(restored.world, { x: 600, y: 380 })).toBe(true);
    expect(isRevealed(restored.world, restored.fly)).toBe(true);
    const discovered = structuredClone(restored.world.revealed);
    Object.assign(restored.fly, { x: 600, y: 380 });
    syncWorld(restored.world, restored.fly, restored.tick);
    expect(restored.world.revealed).toEqual(discovered);
    expect(isRevealed(restored.world, { x: 6500, y: -3000 })).toBe(true);
  });

  it('does not reveal or populate unexplored terrain when an observer pans the camera', () => {
    const observed = createExperiment('observer-fog');
    const control = structuredClone(observed);
    const center = panCamera({ x: 600, y: 380 }, 12000, -7600, 1);
    const bounds = viewBounds(900, 500, 1, center);
    expect(visibleTerrain(observed.world, bounds, observed.tick)).toEqual({
      resources: [],
      obstacles: [],
      regions: [],
      predators: [],
    });
    expect(revealedPointsInBounds(observed.world, bounds)).toEqual([]);
    expect(isRevealed(observed.world, center)).toBe(false);
    expect(observed).toEqual(control);
    for (let i = 0; i < 90; i++) {
      stepExperiment(observed);
      stepExperiment(control);
    }
    expect(observed).toEqual(control);
  });

  it('starts a new life with its own exploration record', () => {
    const oldLife = createExperiment('individual-exploration', 1);
    syncWorld(oldLife.world, { x: 9000, y: 9000 }, 0);
    const nextLife = createExperiment('individual-exploration', 2);
    expect(isRevealed(oldLife.world, { x: 9000, y: 9000 })).toBe(true);
    expect(isRevealed(nextLife.world, { x: 9000, y: 9000 })).toBe(false);
    expect(nextLife.world.revealed).toEqual([{ x: 600, y: 380 }]);
  });

  it.each([
    null,
    {},
    [{ x: '600', y: 380 }],
    [{ x: 600 }],
    [{ x: 1e13, y: 380 }],
    [{ x: null, y: 380 }],
  ])('rejects malformed saved discovery data: %j', (revealed) => {
    const snapshot = createSnapshot(createExperiment('invalid-discovery'), []);
    const invalid = {
      ...snapshot,
      current: { ...snapshot.current, world: { ...snapshot.current.world, revealed } },
    };
    expect(() => parseSnapshot(JSON.stringify(invalid))).toThrow(/Invalid experiment/);
  });
});
