import { CONFIG } from './config';
import { clamp, randomFrom } from '../shared/math';
import { DEFAULT_FLY_NAME, normalizeFlyName } from '../shared/flyName';
import {
  advanceWorldResources,
  chunkKeyAt,
  generateWorld,
  migrateWorld,
  syncWorld,
} from '../world/generate';
import { encodeSenses } from '../senses/encode';
import { getBrain } from '../brain/engine';
import { applyMotor } from '../motor/decode';
import { updatePredators } from '../predators/update';
import { metabolize } from '../fly/metabolism';
import type {
  ArchivedGeneration,
  BrainMode,
  ExperimentEvent,
  ExperimentState,
  Snapshot,
} from '../shared/types';

export function createExperiment(
  seed = 'MOSK-0042',
  generation = 1,
  mode: BrainMode = 'adaptive',
  name = DEFAULT_FLY_NAME,
): ExperimentState {
  const flyName = normalizeFlyName(name);
  const { world, rngState } = generateWorld(seed);
  return {
    generation,
    world,
    rngState,
    tick: 0,
    encounterActive: false,
    touch: false,
    energySum: 0,
    energySamples: 0,
    deathCause: null,
    fly: {
      name: flyName,
      x: 600,
      y: 380,
      heading: 0.6,
      vitals: { energy: 76, hunger: 38, hydration: 84, fatigue: 12, threat: 0, health: 100 },
      age: 0,
      distance: 0,
      foodEaten: 0,
      encounters: 0,
      action: 'exploring',
      alive: true,
      trail: [],
    },
    brain: { mode, phase: 0, turn: 0, values: {}, action: 'exploring' },
    events: [
      {
        id: 0,
        time: 0,
        kind: 'birth',
        message: `Generation ${String(generation).padStart(3, '0')} entered the habitat.`,
      },
    ],
    history: [],
  };
}
function log(state: ExperimentState, kind: ExperimentEvent['kind'], message: string) {
  state.events.push({ id: state.tick, time: state.fly.age, kind, message });
}
export function stepExperiment(state: ExperimentState, dt = CONFIG.dt): void {
  if (!state.fly.alive) return;
  const random = randomFrom(state);
  const fly = state.fly;
  syncWorld(state.world, fly, state.tick);
  const oldAction = fly.action;
  const senses = encodeSenses(state.world, fly, state.touch);
  const output = getBrain(state.brain.mode).step(senses, state.brain, dt, random);
  state.touch = applyMotor(state.world, fly, output, dt);
  updatePredators(state.world, fly, dt, random);
  const { cause } = metabolize(state.world, fly, output, dt);
  fly.vitals.threat = clamp((senses.predator?.strength ?? 0) * 100);
  state.tick++;
  fly.age = state.tick * dt;
  advanceWorldResources(state.world, state.world.resources, state.tick, state.tick - 1);
  const exploredBefore = state.world.exploredChunks.length;
  syncWorld(state.world, fly, state.tick);
  if (state.world.exploredChunks.length > exploredBefore)
    log(state, 'exploration', `Entered new terrain: sector ${chunkKeyAt(state.world, fly)}.`);
  if (fly.action === 'feeding' && oldAction !== 'feeding')
    log(state, 'food', 'Found a food source. Feeding.');
  if (fly.action === 'resting' && oldAction !== 'resting')
    log(state, 'rest', 'Slowing down to recover.');
  const danger = !!senses.predator && senses.predator.distance < 130;
  if (danger && !state.encounterActive) {
    fly.encounters++;
    log(state, 'threat', 'Predator detected. Escape response engaged.');
  }
  state.encounterActive = !!senses.predator && (state.encounterActive || danger);
  if (state.tick % 5 === 0) {
    fly.trail.push({ x: fly.x, y: fly.y });
    if (fly.trail.length > CONFIG.trailLength) fly.trail.shift();
  }
  state.energySum += fly.vitals.energy;
  state.energySamples++;
  if (state.tick % CONFIG.historyEvery === 0 || cause) {
    state.history.push({
      time: fly.age,
      energy: fly.vitals.energy,
      health: fly.vitals.health,
      hunger: fly.vitals.hunger,
      hydration: fly.vitals.hydration,
      distance: fly.distance,
      foodEaten: fly.foodEaten,
      encounters: fly.encounters,
    });
  }
  if (cause) {
    fly.alive = false;
    fly.action = 'deceased';
    state.brain.action = 'deceased';
    state.deathCause = cause;
    log(state, 'death', `Life ended: ${cause.toLowerCase()}. Record preserved.`);
  }
}
export function archiveGeneration(state: ExperimentState): ArchivedGeneration {
  return {
    generation: state.generation,
    seed: state.world.seed,
    mode: state.brain.mode,
    age: state.fly.age,
    distance: state.fly.distance,
    foodEaten: state.fly.foodEaten,
    encounters: state.fly.encounters,
    averageEnergy: state.energySum / Math.max(1, state.energySamples),
    cause: state.deathCause ?? 'Concluded by observer',
    finalState: structuredClone(state),
  };
}
export function createSnapshot(current: ExperimentState, archive: ArchivedGeneration[]): Snapshot {
  const snapshot: Snapshot = {
    schemaVersion: 3,
    savedAt: new Date().toISOString(),
    current: structuredClone(current),
    archive: structuredClone(archive),
  };
  // A development hot reload can retain an in-memory life from an older version.
  for (const state of [snapshot.current, ...snapshot.archive.map((a) => a.finalState)]) {
    state.fly.name ??= DEFAULT_FLY_NAME;
    if (state.world.terrainVersion !== 2)
      migrateWorld(state.world, state.fly, state.tick, state.fly.trail);
  }
  return snapshot;
}
