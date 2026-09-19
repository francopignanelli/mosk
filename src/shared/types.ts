import type { AssayCheckpoint } from '../research/assay';

export interface Vec2 {
  x: number;
  y: number;
}
export type BrainMode = 'adaptive' | 'random';
export type Behavior =
  | 'exploring'
  | 'seeking food'
  | 'seeking water'
  | 'fleeing'
  | 'resting'
  | 'feeding'
  | 'drinking'
  | 'deceased';
export interface Vitals {
  energy: number;
  hunger: number;
  hydration: number;
  fatigue: number;
  threat: number;
  health: number;
}
export interface Fly extends Vec2 {
  name: string;
  heading: number;
  vitals: Vitals;
  age: number;
  distance: number;
  foodEaten: number;
  encounters: number;
  action: Behavior;
  alive: boolean;
  trail: Vec2[];
}
export interface Resource extends Vec2 {
  id: number | string;
  homeChunk?: string;
  kind: 'food' | 'water';
  radius: number;
  amount: number;
  capacity: number;
  /** Optional for older saves; fixed food slots produce successive fruit at new locations. */
  renewal?: { originTick: number; cycle: number; updatedTick: number; viable: boolean };
}
export interface Obstacle extends Vec2 {
  radius: number;
  kind: 'rock' | 'plant';
}
export interface Region extends Vec2 {
  radius: number;
  kind: 'meadow' | 'grove' | 'refuge';
}
export interface Predator extends Vec2 {
  id: number | string;
  homeChunk?: string;
  heading: number;
  mode: 'roaming' | 'pursuing' | 'searching';
  lastSeen: Vec2;
  attention: number;
}
export interface World {
  topology: 'infinite';
  /** Dimensions of one procedural sector, not bounds on the habitat. */
  width: number;
  height: number;
  seed: string;
  resources: Resource[];
  obstacles: Obstacle[];
  regions: Region[];
  predators: Predator[];
  /** Shared encounter budget survives sector changes and prevents successive pursuers. */
  predatorEncounter?: {
    pursuerId: Predator['id'] | null;
    chaseRemaining: number;
    cooldownRemaining: number;
  };
  activeChunkKeys: string[];
  exploredChunks: string[];
  sleepingChunks: Record<string, SleepingChunk>;
  terrainVersion: 2;
  /** Existing terrain retained when upgrading older experiments. */
  legacyChunkKeys: string[];
  /** Places visited by this life, used only for the observer's exploration fog. */
  revealed: Vec2[];
}
export interface SleepingChunk {
  resources: Resource[];
  predators: Predator[];
  lastTick: number;
}
export interface SensoryTarget {
  bearing: number;
  distance: number;
  strength: number;
}
export interface SensoryFrame {
  food: SensoryTarget | null;
  water: SensoryTarget | null;
  predator: SensoryTarget | null;
  obstacle: SensoryTarget | null;
  touch: boolean;
  shelter: number;
  internal: Vitals;
  heading: number;
}
export interface BrainNode {
  id: string;
  label: string;
  layer: 'sensory' | 'drive' | 'motor';
  value: number;
}
export interface BrainEdge {
  source: string;
  target: string;
  weight: number;
}
export interface BrainState {
  mode: BrainMode;
  phase: number;
  turn: number;
  values: Record<string, number>;
  action: Behavior;
}
export interface BrainOutput {
  action: Behavior;
  turn: number;
  speed: number;
  feed: boolean;
  drink: boolean;
  nodes: BrainNode[];
  edges: BrainEdge[];
}
export interface ExperimentEvent {
  id: number;
  time: number;
  kind: 'birth' | 'food' | 'threat' | 'rest' | 'death' | 'generation' | 'exploration';
  message: string;
}
export interface MetricSample {
  time: number;
  energy: number;
  health: number;
  hunger: number;
  hydration: number;
  distance: number;
  foodEaten: number;
  encounters: number;
}
export interface ExperimentState {
  /** Published circuit assay, separate from the roaming controller; replayable per-life state. */
  assay?: AssayCheckpoint;
  generation: number;
  world: World;
  fly: Fly;
  brain: BrainState;
  rngState: number;
  tick: number;
  events: ExperimentEvent[];
  history: MetricSample[];
  encounterActive: boolean;
  touch: boolean;
  energySum: number;
  energySamples: number;
  deathCause: string | null;
}
export interface ArchivedGeneration {
  generation: number;
  seed: string;
  mode: BrainMode;
  age: number;
  distance: number;
  foodEaten: number;
  encounters: number;
  averageEnergy: number;
  cause: string;
  finalState: ExperimentState;
}
export interface Snapshot {
  schemaVersion: 3;
  savedAt: string;
  current: ExperimentState;
  archive: ArchivedGeneration[];
}
export interface BrainEngine {
  readonly id: BrainMode;
  step(senses: SensoryFrame, state: BrainState, dt: number, random: () => number): BrainOutput;
}
