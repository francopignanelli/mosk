import { describe, expect, it } from 'vitest';
import { parseSnapshot, validateSnapshot } from '../src/persistence/storage';
import { ASSAY_MODEL, ASSAY_PROTOCOLS, type AssayCheckpoint } from '../src/research/assay';
import {
  archiveGeneration,
  createExperiment,
  createSnapshot,
  stepExperiment,
} from '../src/simulation/engine';

const checkpoint = (cursor = 3): AssayCheckpoint => ({
  version: 1,
  model: ASSAY_MODEL,
  odorSet: 'attractive',
  protocol: 'conditioning',
  cursor,
});

describe('per-life memory assay checkpoint', () => {
  it('round-trips the pinned protocol and progress separately for current and archived lives', () => {
    const previous = createExperiment('first-assay', 1, 'adaptive', 'Luna');
    previous.assay = checkpoint(5);
    const current = createExperiment('second-assay', 2, 'adaptive', 'Sol');
    current.assay = { ...checkpoint(2), odorSet: 'repulsive', protocol: 'extinction-control' };
    const snapshot = createSnapshot(current, [archiveGeneration(previous)]);
    const restored = parseSnapshot(JSON.stringify(snapshot));
    expect(restored.current.assay).toEqual(current.assay);
    expect(restored.archive[0].finalState.assay).toEqual(previous.assay);
    expect(restored.current.fly.name).toBe('Sol');
    expect(restored.archive[0].finalState.fly.name).toBe('Luna');
  });

  it('keeps older records without assay state valid and new lives naive', () => {
    const trained = createExperiment('trained', 1);
    trained.assay = checkpoint();
    const naive = createExperiment('naive', 2);
    const restored = parseSnapshot(
      JSON.stringify(createSnapshot(naive, [archiveGeneration(trained)])),
    );
    expect(restored.current.assay).toBeUndefined();
    expect(restored.archive[0].finalState.assay).toEqual(checkpoint());
    expect(
      parseSnapshot(JSON.stringify(createSnapshot(createExperiment('old-life'), []))).current.assay,
    ).toBeUndefined();
  });

  it('keeps checkpoint copies independent when recording another life', () => {
    const live = createExperiment();
    live.assay = checkpoint();
    const archived = archiveGeneration(live);
    const saved = createSnapshot(live, [archived]);
    live.assay.cursor = 4;
    expect(archived.finalState.assay?.cursor).toBe(3);
    expect(saved.current.assay?.cursor).toBe(3);
    expect(saved.archive[0].finalState.assay?.cursor).toBe(3);
  });

  it('does not train or steer the habitat controller from attached assay data', () => {
    const baseline = createExperiment('matched-habitat');
    const attached = createExperiment('matched-habitat');
    attached.assay = checkpoint();
    for (let i = 0; i < 300; i++) {
      stepExperiment(baseline);
      stepExperiment(attached);
    }
    expect(attached.assay).toEqual(checkpoint());
    const { assay: _assay, ...withoutAssay } = attached;
    expect(withoutAssay).toEqual(baseline);
  });

  it('accepts only source protocols and declared odor sets', () => {
    for (const protocol of ASSAY_PROTOCOLS) {
      for (const odorSet of ['attractive', 'repulsive'] as const) {
        const current = createExperiment();
        current.assay = { ...checkpoint(0), protocol, odorSet };
        expect(validateSnapshot(createSnapshot(current, [])).current.assay).toEqual(current.assay);
      }
    }
  });

  it('rejects invalid or extended checkpoint objects in current and archived lives', () => {
    const badCheckpoints = [
      { ...checkpoint(), model: 'unknown-model' },
      { ...checkpoint(), version: 2 },
      { ...checkpoint(), cursor: NaN },
      { ...checkpoint(), cursor: Infinity },
      { ...checkpoint(), cursor: -1 },
      { ...checkpoint(), cursor: 1.5 },
      { ...checkpoint(), cursor: 101 },
      { ...checkpoint(), protocol: 'reversal' },
      { ...checkpoint(), odorSet: 'custom' },
      { ...checkpoint(), injectedWeights: [0.1, 0.2] },
      { version: 1, model: ASSAY_MODEL, odorSet: 'attractive', protocol: 'conditioning' },
      [],
      null,
    ];
    for (const invalid of badCheckpoints) {
      const snapshot = createSnapshot(createExperiment(), [
        archiveGeneration(createExperiment('old')),
      ]);
      const current = { ...snapshot, current: { ...snapshot.current, assay: invalid } };
      expect(() => validateSnapshot(current)).toThrow('memory assay checkpoint');
      const archived = {
        ...snapshot,
        archive: [
          {
            ...snapshot.archive[0],
            finalState: { ...snapshot.archive[0].finalState, assay: invalid },
          },
        ],
      };
      expect(() => validateSnapshot(archived)).toThrow('memory assay checkpoint');
    }
  });
});
