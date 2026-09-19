import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../src/persistence/storage';
import { normalizeFlyName } from '../src/shared/flyName';
import {
  archiveGeneration,
  createExperiment,
  createSnapshot,
  stepExperiment,
} from '../src/simulation/engine';

describe('individual fly names', () => {
  it('round-trips a named life and retains the archived individual name', () => {
    const first = createExperiment('name-test', 1, 'adaptive', '  Lucía 🪰  ');
    const second = createExperiment('name-test', 2, 'adaptive', 'Sol');
    const restored = parseSnapshot(
      JSON.stringify(createSnapshot(second, [archiveGeneration(first)])),
    );
    expect(restored.current.fly.name).toBe('Sol');
    expect(restored.archive[0].finalState.fly.name).toBe('Lucía 🪰');
  });

  it('migrates unnamed current and archived lives without changing their records', () => {
    const current = createExperiment('current', 6);
    const earlier = createExperiment('earlier', 1);
    stepExperiment(current);
    const old = JSON.parse(JSON.stringify(createSnapshot(current, [archiveGeneration(earlier)])));
    delete old.current.fly.name;
    delete old.archive[0].finalState.fly.name;
    const restored = parseSnapshot(JSON.stringify(old));
    expect(restored.current).toEqual(current);
    expect(restored.archive[0].finalState).toEqual(earlier);
  });

  it('rejects invalid provided names instead of silently repairing imported records', () => {
    for (const name of ['', '   ', 'a'.repeat(33), 'Nora\nMosk', 17, null]) {
      const invalid = JSON.parse(JSON.stringify(createSnapshot(createExperiment(), [])));
      invalid.current.fly.name = name;
      expect(() => parseSnapshot(JSON.stringify(invalid))).toThrow('fly name');
    }
    expect(normalizeFlyName('🪰'.repeat(32))).toHaveLength(64);
    expect(() => normalizeFlyName('🪰'.repeat(33))).toThrow('1–32');
  });

  it('does not let observer naming affect the seeded behavior', () => {
    const first = createExperiment('same-life', 1, 'adaptive', 'Nora');
    const second = createExperiment('same-life', 1, 'adaptive', 'Luz');
    for (let i = 0; i < 120; i++) {
      stepExperiment(first);
      stepExperiment(second);
    }
    second.fly.name = first.fly.name;
    expect(second).toEqual(first);
  });
});
