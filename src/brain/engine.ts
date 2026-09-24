import { clamp } from '../shared/math';
import type {
  Behavior,
  BrainEdge,
  BrainEngine,
  BrainNode,
  BrainOutput,
  BrainState,
  SensoryFrame,
} from '../shared/types';

export const BRAIN_DESCRIPTION = 'Sensory utility model · 18 signal channels';
const specs: [string, string, BrainNode['layer']][] = [
  ['odor', 'Food scent', 'sensory'],
  ['water', 'Water cue', 'sensory'],
  ['danger', 'Threat', 'sensory'],
  ['hunger', 'Hunger', 'sensory'],
  ['thirst', 'Thirst', 'sensory'],
  ['tired', 'Fatigue', 'sensory'],
  ['forage', 'Forage', 'drive'],
  ['hydrate', 'Hydrate', 'drive'],
  ['escape', 'Escape', 'drive'],
  ['recover', 'Recover', 'drive'],
  ['explore', 'Explore', 'drive'],
  ['contact', 'Touch', 'drive'],
  ['forward', 'Forward', 'motor'],
  ['left', 'Turn left', 'motor'],
  ['right', 'Turn right', 'motor'],
  ['feed', 'Feed', 'motor'],
  ['drink', 'Drink', 'motor'],
  ['rest', 'Rest', 'motor'],
];
export const BRAIN_EDGES: BrainEdge[] = [
  ['odor', 'forage', 0.5],
  ['hunger', 'forage', 0.8],
  ['water', 'hydrate', 0.5],
  ['thirst', 'hydrate', 0.9],
  ['danger', 'escape', 1],
  ['tired', 'recover', 1],
  ['danger', 'recover', -0.7],
  ['forage', 'forward', 0.8],
  ['forage', 'feed', 1],
  ['hydrate', 'forward', 0.7],
  ['hydrate', 'drink', 1],
  ['escape', 'forward', 1],
  ['escape', 'left', 0.7],
  ['escape', 'right', 0.7],
  ['recover', 'rest', 1],
  ['explore', 'forward', 0.6],
  ['explore', 'left', 0.5],
  ['explore', 'right', 0.5],
  ['contact', 'left', 0.8],
  ['contact', 'right', 0.8],
].map(([source, target, weight]) => ({
  source: String(source),
  target: String(target),
  weight: Number(weight),
}));

export function brainNodes(state: BrainState): BrainNode[] {
  return specs.map(([id, label, layer]) => ({ id, label, layer, value: state.values[id] ?? 0 }));
}
function output(
  state: BrainState,
  action: Behavior,
  turn: number,
  speed: number,
  senses: SensoryFrame,
  dt: number,
): BrainOutput {
  const values: Record<string, number> = {
    odor: senses.food?.strength ?? 0,
    water: senses.water?.strength ?? 0,
    danger: senses.predator?.strength ?? 0,
    hunger: senses.internal.hunger / 100,
    thirst: 1 - senses.internal.hydration / 100,
    tired: senses.internal.fatigue / 100,
    forage: Math.min(1, (senses.internal.hunger / 100) * 0.8 + (senses.food?.strength ?? 0) * 0.5),
    hydrate: Math.min(
      1,
      (1 - senses.internal.hydration / 100) * 0.9 + (senses.water?.strength ?? 0) * 0.5,
    ),
    escape: senses.predator?.strength ?? 0,
    recover: Math.max(0, senses.internal.fatigue / 100 - (senses.predator?.strength ?? 0) * 0.7),
    explore: action === 'exploring' ? 0.75 : 0.08,
    contact: senses.touch ? 1 : (senses.obstacle?.strength ?? 0),
    forward: speed,
    left: Math.max(0, -turn),
    right: Math.max(0, turn),
    feed: action === 'feeding' ? 1 : 0,
    drink: action === 'drinking' ? 1 : 0,
    rest: action === 'resting' ? 1 : 0,
  };
  for (const [id, value] of Object.entries(values))
    state.values[id] =
      (state.values[id] ?? 0) +
      (clamp(value, 0, 1) - (state.values[id] ?? 0)) * Math.min(1, dt * 9);
  state.action = action;
  return {
    action,
    turn: clamp(turn, -1, 1),
    speed,
    feed: action === 'feeding',
    drink: action === 'drinking',
    nodes: brainNodes(state),
    edges: BRAIN_EDGES,
  };
}
export class UtilityBrain implements BrainEngine {
  readonly id = 'adaptive' as const;
  step(s: SensoryFrame, state: BrainState, dt: number, random: () => number): BrainOutput {
    state.phase -= dt;
    if (state.phase <= 0) {
      state.phase = 0.8 + random() * 1.7;
      state.turn = (random() - 0.5) * 0.85;
    }
    let action: Behavior = 'exploring';
    let turn = state.turn;
    let speed = 0.65;
    const danger = s.predator && s.predator.distance < (state.action === 'fleeing' ? 180 : 130);
    if (danger && s.predator) {
      action = 'fleeing';
      turn =
        Math.atan2(Math.sin(s.predator.bearing + Math.PI), Math.cos(s.predator.bearing + Math.PI)) *
        1.7;
      speed = 1;
    } else if (
      s.water &&
      s.internal.hydration <
        (state.action === 'drinking' || state.action === 'seeking water' ? 96 : 58)
    ) {
      action = s.water.distance < 40 ? 'drinking' : 'seeking water';
      turn = s.water.bearing * 1.6;
      speed = action === 'drinking' ? 0 : 0.72;
    } else if (
      s.food &&
      (s.internal.hunger >
        (state.action === 'feeding' || state.action === 'seeking food' ? 8 : 28) ||
        s.internal.energy < 55)
    ) {
      action = s.food.distance < 19 ? 'feeding' : 'seeking food';
      turn = s.food.bearing * 1.6;
      speed = action === 'feeding' ? 0 : 0.72;
    } else if (
      s.internal.fatigue > (state.action === 'resting' ? 22 : 64) ||
      (s.internal.energy < 18 && s.internal.hunger < 50)
    ) {
      action = 'resting';
      speed = 0;
      turn = 0;
    }
    if (s.obstacle && speed > 0) {
      turn = s.obstacle.bearing >= 0 ? -1 : 1;
      // Keep the escape command at full speed while steering around cover.
      // Actual contact still limits displacement in the motor decoder.
      if (action !== 'fleeing') speed *= 0.65;
    }
    if (s.touch && speed > 0) turn = 1;
    return output(state, action, turn, speed, s, dt);
  }
}
export class RandomBrain implements BrainEngine {
  readonly id = 'random' as const;
  step(s: SensoryFrame, state: BrainState, dt: number, random: () => number): BrainOutput {
    state.phase -= dt;
    if (state.phase <= 0) {
      state.phase = 0.3 + random() * 2;
      state.turn = (random() - 0.5) * 2;
    }
    const action: Behavior =
      s.food && s.food.distance < 19 && s.internal.hunger > 15
        ? 'feeding'
        : s.water && s.water.distance < 40 && s.internal.hydration < 85
          ? 'drinking'
          : 'exploring';
    return output(state, action, s.touch ? 1 : state.turn, action === 'exploring' ? 0.7 : 0, s, dt);
  }
}
const engines: Record<BrainState['mode'], BrainEngine> = {
  adaptive: new UtilityBrain(),
  random: new RandomBrain(),
};
export const getBrain = (mode: BrainState['mode']) => engines[mode];
