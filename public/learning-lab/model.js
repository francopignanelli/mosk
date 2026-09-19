/*
 * MOSK standalone memory assay, adapted from Luo, Huang & Schnitzer (2024).
 * Copyright (C) 2024 Junjie Luo, Cheng Huang, Mark J. Schnitzer
 * Modifications (C) 2026 MOSK contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 * See LICENSE.txt and README.md. This program has no habitat motor decoder.
 */

export const MODEL = 'huang-luo-2024@5d7c08a9';
export const PROTOCOLS = {
  conditioning: 'Conditioning · 6 cycles, 1-hour retention',
  retention: 'Retention · 6 cycles, up to 24 hours',
  'extinction-control': 'Extinction control · no odor-only training',
  'extinction-10m': 'Extinction · odor-only training at 10 minutes',
  'extinction-2h': 'Extinction · odor-only training at 2 hours',
  'feedback-intact': 'Feedback control · intact circuit',
  'feedback-control': 'Feedback intervention · remove γ1 feedback',
};
export const CELLS = [
  'PPL1-γ1pedc',
  'PPL1-α′2α2',
  'PPL1-α3',
  'MBON-γ1pedc',
  'MBON-α2sc',
  'MBON-α3',
];

// Extracted without rounding from the authors' 3-module fitted .mat file.
const INPUT = [
  -2.114659931486826, -3.7536848556073035, 4.679765879399402, 25.409349826326743, 17.34076969514443,
  16.325998593348324, 5.144328666233586, 2.940453898912807, 13.719957724943319,
];
const FW0 = -21.35073162171509;
const FWDT = -5.604318227436501;
const RECURRENT = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [
    -0.038317847418581054, -0.07480898095987185, -0.3816454088221073, 0, -0.3087498160313475,
    -2.0897919221366294e-9,
  ],
  [0, 0.15474228901722345, 2.0897965087825323e-9, 0, 0, 0],
  [0, 0, 2.0897915132938865e-9, 0, 0, 0],
];
const TAU = [2022.7098422193494, 6219.828611270908, 242787.59006247285];
const ODOR_TAU = 791.9841678866914;
const BASELINE = [0, 0, 0, 35.2, 9, 11.2];
const MAXIMUM = [Infinity, Infinity, Infinity, 71.66, 17.9, 31.16];
const PUNISHMENT = [27.85, 0, 11.38, 0, 0, 0];

function bout(name, cue, duration, punishment = 0) {
  return { name, cue, duration, punishment };
}
function session(name, cycles = 1) {
  const imaging = name === 'imaging';
  const duration = imaging ? 5 : 30;
  const gap = imaging ? 120 : 135;
  return Array.from({ length: cycles }, () => [
    bout(name, 0, duration, name === 'training' ? 1 : 0),
    bout(name, null, gap),
    bout(name, 1, duration),
    bout(name, null, gap),
  ]).flat();
}

export function protocolBouts(id) {
  if (!(id in PROTOCOLS)) throw new Error('Unknown published protocol.');
  if (id === 'conditioning' || id === 'retention') {
    const result = [
      ...session('imaging'),
      ...session('training', 3),
      ...session('imaging'),
      ...session('training', 3),
      ...session('imaging'),
      bout('rest', null, 3600),
      ...session('imaging'),
    ];
    if (id === 'retention')
      result.push(
        bout('rest', null, 7200 - 250),
        ...session('imaging'),
        bout('rest', null, 75600 - 500),
        ...session('imaging'),
      );
    return result;
  }
  if (id.startsWith('feedback-')) {
    const result = [
      ...session('imaging'),
      ...session('training', 3),
      bout('rest', null, 900 - 135),
      ...session('imaging'),
    ];
    result[3].duration = 300;
    return result;
  }
  // Figure 5j: identical training and final assay time; only extinction differs.
  const result = [...session('imaging'), ...session('training', 3), ...session('imaging')];
  result[3].duration = 300;
  result[15].duration = 300;
  const restBudget = 10800 - 300 - 250;
  if (id === 'extinction-control') result.push(bout('rest', null, restBudget));
  else {
    const wait = (id === 'extinction-10m' ? 10 : 120) * 60 - 300 - 250;
    result.push(
      bout('rest', null, wait),
      ...session('extinction', 3),
      bout('rest', null, restBudget - wait - 990),
    );
  }
  result.push(...session('imaging'));
  return result;
}

export function defaultCheckpoint() {
  return { version: 1, model: MODEL, odorSet: 'attractive', protocol: 'conditioning', cursor: 0 };
}
export function isCheckpoint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(',');
  return (
    keys === 'cursor,model,odorSet,protocol,version' &&
    value.version === 1 &&
    value.model === MODEL &&
    ['attractive', 'repulsive'].includes(value.odorSet) &&
    Object.hasOwn(PROTOCOLS, value.protocol) &&
    Number.isInteger(value.cursor) &&
    value.cursor >= 0 &&
    value.cursor <= protocolBouts(value.protocol).length
  );
}

function parameters(checkpoint) {
  const recurrent = RECURRENT.map((row) => row.slice());
  if (checkpoint.protocol === 'feedback-control') {
    // Original parameter indices [12,13,15,18,19], one-based, Fig. 5e/f.
    for (const column of [0, 1, 2, 4, 5]) recurrent[3][column] = 0;
  }
  let input =
    checkpoint.odorSet === 'attractive'
      ? INPUT.slice(0, 6)
      : [...INPUT.slice(6, 9), ...INPUT.slice(3, 6)];
  let fwDt = FWDT;
  if (checkpoint.protocol.startsWith('extinction') || checkpoint.protocol.startsWith('feedback')) {
    const valence = checkpoint.protocol.startsWith('feedback')
      ? [0, 0, 0]
      : checkpoint.odorSet === 'attractive'
        ? [-3.42, -4.58, -5.6]
        : [2.57, 2.24, 3.35];
    const firing = [...valence, 31.6, 5.8, 17.8];
    const factor = 2 / (1 + Math.exp(-0.05 * 5));
    input = firing.map(
      (v, i) => (v - recurrent.reduce((sum, row, j) => sum + row[i] * firing[j], 0)) * factor,
    );
    if (checkpoint.protocol.startsWith('extinction')) fwDt *= 1.5;
  }
  return { recurrent, input, fwDt };
}

function solveLinear(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let column = 0; column < rhs.length; column++) {
    let pivot = column;
    for (let row = column + 1; row < rhs.length; row++)
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    for (let j = column; j <= rhs.length; j++) a[column][j] /= divisor;
    for (let row = 0; row < rhs.length; row++)
      if (row !== column) {
        const multiplier = a[row][column];
        for (let j = column; j <= rhs.length; j++) a[row][j] -= multiplier * a[column][j];
      }
  }
  return a.map((row) => row[rhs.length]);
}

export function replay(checkpoint) {
  if (!isCheckpoint(checkpoint)) throw new Error('Invalid assay checkpoint.');
  const { recurrent, input, fwDt } = parameters(checkpoint);
  const bouts = protocolBouts(checkpoint.protocol);
  const lastTraining = bouts.findLastIndex((item) => item.name === 'training');
  let adaptation = [1, 1],
    plasticity = [
      [0, 0, 0],
      [0, 0, 0],
    ],
    activity = [0, 0, 0, 0, 0, 0];
  let elapsed = 0,
    postTraining = 0;
  const history = [];
  for (let index = 0; index < checkpoint.cursor; index++) {
    const current = bouts[index];
    const cue = [Number(current.cue === 0), Number(current.cue === 1)];
    const nextAdaptation = adaptation.map(
      (value, i) =>
        1 -
        (1 - value * Math.exp(-0.05 * current.duration * cue[i])) *
          Math.exp(-current.duration / ODOR_TAU),
    );
    const kc = adaptation.map((value, i) => ((value + nextAdaptation[i]) / 2) * cue[i]);
    const weights = plasticity.map((row) =>
      input.map((value, i) => value + (i < 3 ? 0 : row[i - 3])),
    );
    const drive = input.map(
      (_, i) => weights[0][i] * kc[0] + weights[1][i] * kc[1] + PUNISHMENT[i] * current.punishment,
    );
    // Preserve MATLAB's initial (I-W)^-1 estimate and ten fixed-point updates.
    activity = solveLinear(
      recurrent.map((row, i) => row.map((weight, j) => Number(i === j) - weight)),
      drive,
    );
    for (let iteration = 0; iteration < 10; iteration++) {
      activity = activity.map((_, i) => {
        const total =
          drive[i] + BASELINE[i] + recurrent.reduce((sum, row, j) => sum + row[i] * activity[j], 0);
        return (i < 3 ? total : Math.min(MAXIMUM[i], Math.max(0, total))) - BASELINE[i];
      });
    }
    const before = plasticity.map((row) => row.slice());
    for (let odor = 0; odor < 2; odor++)
      for (let compartment = 0; compartment < 3; compartment++) {
        const teaching =
          weights[0][compartment] * kc[0] +
          weights[1][compartment] * kc[1] +
          recurrent.slice(3).reduce((sum, row, j) => sum + row[compartment] * activity[j + 3], 0);
        plasticity[odor][compartment] +=
          (((FW0 * current.duration) / 90) * teaching +
            ((fwDt * PUNISHMENT[compartment] * current.duration) / 90) * current.punishment) *
          kc[odor];
      }
    // The publication switches α2/α3 decay after 3 hours since the last complete training session.
    const beforePost = postTraining;
    if (index > lastTraining) postTraining += current.duration;
    let earlyDuration = current.duration;
    if (postTraining > 10800) earlyDuration = Math.max(0, 10800 - beforePost);
    for (const row of plasticity)
      for (let compartment = 0; compartment < 3; compartment++) {
        const earlyTau = compartment === 0 ? TAU[0] : TAU[1];
        const lateTau = compartment === 0 ? TAU[0] : TAU[2];
        row[compartment] *= Math.exp(
          -earlyDuration / earlyTau - (current.duration - earlyDuration) / lateTau,
        );
      }
    elapsed += current.duration;
    adaptation = nextAdaptation;
    history.push({
      index: index + 1,
      timeSeconds: elapsed,
      name: current.name,
      cue: current.cue,
      duration: current.duration,
      punishment: current.punishment,
      activity: activity.slice(),
      adaptation: adaptation.slice(),
      plasticity: plasticity.map((row) => row.slice()),
      change: plasticity.map((row, i) => row.map((value, j) => value - before[i][j])),
    });
  }
  return {
    checkpoint: { ...checkpoint },
    timeSeconds: elapsed,
    adaptation,
    plasticity,
    activity,
    history,
    totalBouts: bouts.length,
    next: bouts[checkpoint.cursor] ?? null,
    weights: plasticity.map((row) => row.map((value, i) => value + input[i + 3])),
  };
}

export function advance(checkpoint) {
  return replay({
    ...checkpoint,
    cursor: Math.min(checkpoint.cursor + 1, protocolBouts(checkpoint.protocol).length),
  });
}
