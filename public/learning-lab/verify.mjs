/* SPDX-License-Identifier: GPL-3.0-or-later */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultCheckpoint, isCheckpoint, protocolBouts, replay } from './model.js';

const fixture = JSON.parse(
  readFileSync(new URL('./reference-output.json', import.meta.url), 'utf8'),
);
let checks = 0,
  maxError = 0;
for (const test of fixture.cases) {
  const checkpoint = {
    ...defaultCheckpoint(),
    protocol: test.protocol,
    odorSet: test.odorSet,
    cursor: test.history.length,
  };
  const actual = replay(checkpoint);
  assert.equal(actual.history.length, test.history.length);
  for (let i = 0; i < test.history.length; i++) {
    const expected = test.history[i],
      got = actual.history[i];
    assert.equal(got.timeSeconds, expected.timeSeconds);
    for (const field of ['activity', 'adaptation', 'plasticity']) {
      const a = got[field].flat(),
        b = expected[field].flat();
      for (let j = 0; j < a.length; j++) {
        const error = Math.abs(a[j] - b[j]);
        maxError = Math.max(maxError, error);
        assert.ok(
          error < 1e-9,
          `${test.protocol}/${test.odorSet} bout ${i + 1} ${field}[${j}] error=${error}`,
        );
        checks++;
      }
    }
    // Every persisted intermediate checkpoint must restore the same weights.
    const restored = replay({ ...checkpoint, cursor: i + 1 });
    assert.deepEqual(restored.plasticity, got.plasticity);
  }
}
assert.equal(protocolBouts('conditioning').length, 41);
assert.equal(protocolBouts('retention').length, 51);
assert.equal(protocolBouts('extinction-10m').length, 38);
for (const id of ['extinction-control', 'extinction-10m', 'extinction-2h']) {
  assert.equal(
    protocolBouts(id).reduce((sum, b) => sum + b.duration, 0),
    12335,
    'Matched extinction assay duration',
  );
}
assert.equal(isCheckpoint({ ...defaultCheckpoint(), cursor: 42 }), false);
assert.equal(isCheckpoint({ ...defaultCheckpoint(), protocol: 'constructor' }), false);
assert.equal(isCheckpoint({ ...defaultCheckpoint(), cursor: 0.5 }), false);
assert.equal(isCheckpoint({ ...defaultCheckpoint(), extra: 1 }), false);
const naive = replay(defaultCheckpoint());
assert.deepEqual(naive.plasticity, [
  [0, 0, 0],
  [0, 0, 0],
]);
const changed = replay({ ...defaultCheckpoint(), cursor: 41 });
assert.ok(changed.plasticity.flat().some((v) => Math.abs(v) > 1));
console.log(
  `PASS: ${fixture.cases.length} published protocol/odor combinations, ${checks} values cross-checked; maximum absolute error ${maxError}.`,
);
console.log(
  'PASS: all intermediate deterministic checkpoints restore; matched extinction duration and invalid-checkpoint checks.',
);
