import { expect, it } from 'vitest';
import { createExperiment, stepExperiment } from '../src/simulation/engine';
import { CONFIG } from '../src/simulation/config';

it('retains viable early lives, injury, and survivors across seeded twenty-minute runs', () => {
  const rows = [];
  for (const seed of [
    'MOSK-0042',
    'orchard',
    'forest',
    '999',
    'field',
    'balance-1',
    'balance-2',
    'balance-3',
  ]) {
    const state = createExperiment(seed);
    let minimumHealth = 100;
    let injuredTicks = 0;
    let injuryTicks = 0;
    let fleeingTicks = 0;
    let minimumEnergy = 100;
    for (let tick = 0; tick < 36000 && state.fly.alive; tick++) {
      const health = state.fly.vitals.health;
      stepExperiment(state);
      minimumHealth = Math.min(minimumHealth, state.fly.vitals.health);
      minimumEnergy = Math.min(minimumEnergy, state.fly.vitals.energy);
      if (state.fly.vitals.health < 99) injuredTicks++;
      if (state.fly.vitals.health < health) injuryTicks++;
      if (state.fly.action === 'fleeing') fleeingTicks++;
    }
    expect(state.fly.age).toBeGreaterThan(60);
    rows.push({
      seed,
      seconds: Math.round(state.fly.age),
      health: +state.fly.vitals.health.toFixed(1),
      minHealth: +minimumHealth.toFixed(1),
      injurySeconds: +(injuryTicks * CONFIG.dt).toFixed(1),
      below99Seconds: +(injuredTicks * CONFIG.dt).toFixed(1),
      minEnergy: +minimumEnergy.toFixed(1),
      encounters: state.fly.encounters,
      fleeingSeconds: +(fleeingTicks * CONFIG.dt).toFixed(1),
      cause: state.deathCause,
    });
  }
  console.table(rows);
  expect(rows.some((row) => row.health < 99)).toBe(true);
  expect(rows.some((row) => row.cause === null)).toBe(true);
}, 120000);
