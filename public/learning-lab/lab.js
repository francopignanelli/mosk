/* SPDX-License-Identifier: GPL-3.0-or-later; see README.md and LICENSE.txt. */
import {
  CELLS,
  MODEL,
  PROTOCOLS,
  defaultCheckpoint,
  isCheckpoint,
  protocolBouts,
  replay,
} from './model.js';

const $ = (id) => document.getElementById(id);
let checkpoint = defaultCheckpoint();
let flyId = 'standalone',
  flyName = 'this fly',
  readOnly = false,
  ready = window.parent === window,
  timer = null;
const signed = (value) => (value >= 0 ? '+' : '') + value.toFixed(3);
const time = (seconds) =>
  seconds < 60
    ? `${seconds} s`
    : seconds < 3600
      ? `${(seconds / 60).toFixed(1)} min`
      : `${(seconds / 3600).toFixed(2)} h`;
const names = {
  imaging: 'Odor test',
  training: 'Conditioning',
  extinction: 'Odor-only extinction',
  rest: 'Rest',
};
const make = (tag, text, className) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
};
for (const [value, label] of Object.entries(PROTOCOLS)) {
  const option = make('option', label);
  option.value = value;
  $('protocol').append(option);
}

function stop() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  $('play').textContent = 'Play bouts';
}
function publish() {
  if (window.parent !== window && ready && !readOnly)
    window.parent.postMessage(
      { type: 'mosk-lab:state', flyId, state: { ...checkpoint } },
      window.location.origin,
    );
}
function describe(item) {
  return `${names[item.name]} · ${item.cue === null ? 'no odor' : item.cue === 0 ? 'CS+' : 'CS−'} · ${time(item.duration)}${item.punishment ? ' · punishment paired' : ''}`;
}
function selectionNote() {
  const id = $('protocol').value;
  $('odor').disabled = readOnly || !ready || id.startsWith('feedback');
  $('protocol-note').textContent = id.startsWith('feedback')
    ? 'Figure 5e/f, 3 cycles and the 15-minute assay: neutral innate valence. Compare the intact circuit against removal of its published γ1 feedback connections.'
    : id.startsWith('extinction')
      ? 'Figure 5j: 3 cycles, the original 1.5× punishment-plasticity multiplier, and a matched 3-hour assay. Compare odor-only exposure at 10 minutes or 2 hours against no extinction.'
      : 'Original fitted-model protocol: odor tests before training, after 3 and 6 cycles, and after rest. The retention version adds the published 3-hour and 24-hour sampling schedule.';
}

function finalReadout(state) {
  const tests = state.history.filter((item) => item.name === 'imaging' && item.cue !== null);
  if (tests.length < 2) return [0, 0, 0];
  const pair = tests.slice(-2);
  return [3, 4, 5].map((i) => pair[0].activity[i] - pair[1].activity[i]);
}
function comparison(state) {
  const current = checkpoint.protocol;
  let controlId = null;
  if (current === 'feedback-control') controlId = 'feedback-intact';
  else if (current === 'feedback-intact') controlId = 'feedback-control';
  else if (current === 'extinction-control') controlId = 'extinction-10m';
  else if (current.startsWith('extinction')) controlId = 'extinction-control';
  $('comparison-label').textContent = controlId
    ? 'Same fitted parameters'
    : 'Select an extinction or feedback assay';
  const svg = $('comparison');
  svg.replaceChildren();
  if (!controlId) {
    $('comparison-note').textContent =
      'Matched causal comparisons are available in the extinction and feedback protocols. Conditioning and retention show the original time course without adding an invented control.';
    return;
  }
  $('comparison-note').textContent =
    `Matched control: ${PROTOCOLS[controlId]}. Gray points show its completed deterministic reference. Purple points appear when the selected protocol finishes.`;
  const control = replay({
    ...checkpoint,
    protocol: controlId,
    cursor: protocolBouts(controlId).length,
  });
  const controlValues = finalReadout(control);
  const finished = checkpoint.cursor === state.totalBouts;
  const values = finished ? finalReadout(state) : [0, 0, 0];
  const limit =
    Math.max(1, ...controlValues.map(Math.abs), ...(finished ? values.map(Math.abs) : [])) * 1.25;
  const element = (tag, attrs, text) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    svg.append(e);
    return e;
  };
  const y = (value) => 77 - (value / limit) * 54;
  element('line', {
    x1: 50,
    y1: 77,
    x2: 600,
    y2: 77,
    stroke: '#e8e2ee',
    'stroke-dasharray': '3 4',
  });
  element('text', { x: 5, y: 80, fill: '#9b92a4', 'font-size': 10 }, '0 Hz');
  for (let i = 0; i < 3; i++) {
    const x = 130 + i * 200;
    element('line', {
      x1: x + 9,
      y1: 77,
      x2: x + 9,
      y2: y(controlValues[i]),
      stroke: '#b9c7c4',
      'stroke-width': 2,
    });
    element('circle', { cx: x + 9, cy: y(controlValues[i]), r: 4, fill: '#b9c7c4' });
    element(
      'text',
      { x: x + 16, y: y(controlValues[i]) + 4, fill: '#829892', 'font-size': 10 },
      signed(controlValues[i]),
    );
    if (finished) {
      element('line', {
        x1: x - 9,
        y1: 77,
        x2: x - 9,
        y2: y(values[i]),
        stroke: '#9275b6',
        'stroke-width': 2,
      });
      element('circle', { cx: x - 9, cy: y(values[i]), r: 4, fill: '#9275b6' });
      element(
        'text',
        { x: x - 16, y: y(values[i]) - 7, fill: '#9275b6', 'font-size': 10, 'text-anchor': 'end' },
        signed(values[i]),
      );
    }
    element(
      'text',
      { x, y: 155, fill: '#9b92a4', 'font-size': 11, 'text-anchor': 'middle' },
      CELLS[i + 3],
    );
  }
}

function render() {
  const state = replay(checkpoint);
  $('fly-name').textContent = flyName;
  $('clock').textContent = time(state.timeSeconds);
  $('progress').textContent = `Bout ${checkpoint.cursor} of ${state.totalBouts}`;
  $('next-bout').textContent = state.next
    ? `Next: ${describe(state.next)}`
    : 'Assay complete. Inspect the log or start a fresh selected assay.';
  $('host-status').textContent = !ready
    ? 'Connecting to the experiment…'
    : readOnly
      ? 'Read-only record. Playback is temporary and does not change the saved checkpoint.'
      : window.parent === window
        ? 'Standalone session. Download your record to keep it.'
        : 'Checkpoint saved with this life whenever a bout changes.';
  $('restart').disabled = readOnly || !ready;
  $('protocol').disabled = readOnly || !ready;
  $('back').disabled = !ready || checkpoint.cursor === 0;
  $('step').disabled = !ready || checkpoint.cursor === state.totalBouts;
  $('play').disabled = !ready || checkpoint.cursor === state.totalBouts;
  selectionNote();
  $('weights').replaceChildren();
  state.plasticity.forEach((row, odor) => {
    const tr = make('tr');
    tr.append(make('td', odor === 0 ? 'CS+ · paired odor' : 'CS− · comparison'));
    row.forEach((value) => tr.append(make('td', signed(value), 'number')));
    $('weights').append(tr);
  });
  $('adaptation').textContent =
    `Odor responsiveness: CS+ ${(100 * state.adaptation[0]).toFixed(1)}%, CS− ${(100 * state.adaptation[1]).toFixed(1)}%. This separate adaptation state changes with exposure and recovers during gaps.`;
  $('activity').replaceChildren();
  state.activity.forEach((value, i) => {
    const e = make('div', undefined, 'cell');
    e.append(make('span', CELLS[i]), make('strong', signed(value)));
    $('activity').append(e);
  });
  $('log-count').textContent = `${state.history.length} recorded bouts`;
  $('memory-log').replaceChildren();
  for (const item of state.history.slice().reverse()) {
    const tr = make('tr');
    const stamp = make('td');
    const button = make('button', time(item.timeSeconds));
    button.addEventListener('click', () => {
      $('log-detail').textContent =
        `Bout ${item.index}: ${describe(item)}. Stored CS+ weights relative to initial: ${item.plasticity[0].map(signed).join(', ')}; CS−: ${item.plasticity[1].map(signed).join(', ')}. Responsiveness: ${item.adaptation.map((v) => (v * 100).toFixed(1) + '%').join(' / ')}.`;
    });
    stamp.append(button);
    tr.append(
      stamp,
      make('td', describe(item)),
      make('td', item.change[0].map(signed).join(' · '), 'number'),
      make('td', item.change[1].map(signed).join(' · '), 'number'),
    );
    $('memory-log').append(tr);
  }
  if (!state.history.length) {
    const tr = make('tr'),
      td = make('td', 'No experiences yet. Advance the first odor test to begin.');
    td.colSpan = 4;
    tr.append(td);
    $('memory-log').append(tr);
  }
  comparison(state);
}

function move(amount) {
  if (!ready) return;
  const total = protocolBouts(checkpoint.protocol).length;
  checkpoint = { ...checkpoint, cursor: Math.max(0, Math.min(total, checkpoint.cursor + amount)) };
  if (checkpoint.cursor === total) stop();
  render();
  publish();
}
$('protocol').addEventListener('change', selectionNote);
$('restart').addEventListener('click', () => {
  if (!ready || readOnly) return;
  stop();
  checkpoint = { ...defaultCheckpoint(), protocol: $('protocol').value, odorSet: $('odor').value };
  $('log-detail').textContent = '';
  render();
  publish();
});
$('step').addEventListener('click', () => {
  stop();
  move(1);
});
$('back').addEventListener('click', () => {
  stop();
  move(-1);
});
$('play').addEventListener('click', () => {
  if (timer !== null) {
    stop();
    return;
  }
  if (!ready) return;
  timer = setInterval(() => move(1), 650);
  $('play').textContent = 'Pause playback';
});
$('export').addEventListener('click', () => {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          model: MODEL,
          flyName,
          checkpoint,
          state: replay(checkpoint),
          source: 'https://doi.org/10.1038/s41586-024-07819-w',
          interpretation: 'Separate published circuit assay; no habitat motor control.',
        },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const a = make('a');
  a.href = url;
  a.download = 'mosk-memory-assay.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
window.addEventListener('message', (event) => {
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  const incoming = event.data;
  if (incoming?.type === 'mosk-lab:context') {
    if (
      incoming.flyId !== flyId ||
      typeof incoming.flyName !== 'string' ||
      typeof incoming.readOnly !== 'boolean'
    )
      return;
    flyName = incoming.flyName.slice(0, 80);
    readOnly = incoming.readOnly;
    if (readOnly) stop();
    render();
    return;
  }
  if (incoming?.type !== 'mosk-lab:restore') return;
  if (
    typeof incoming.flyId !== 'string' ||
    typeof incoming.flyName !== 'string' ||
    typeof incoming.readOnly !== 'boolean' ||
    (incoming.state !== null && !isCheckpoint(incoming.state))
  )
    return;
  stop();
  flyId = incoming.flyId;
  flyName = incoming.flyName.slice(0, 80);
  readOnly = incoming.readOnly;
  checkpoint = incoming.state === null ? defaultCheckpoint() : { ...incoming.state };
  ready = true;
  $('protocol').value = checkpoint.protocol;
  $('odor').value = checkpoint.odorSet;
  $('log-detail').textContent = '';
  render();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
});
window.addEventListener('error', () => {
  stop();
  $('host-status').textContent =
    'The assay encountered an error. Reload the lab to restore the saved checkpoint.';
});
window.addEventListener('unhandledrejection', () => {
  stop();
  $('host-status').textContent =
    'The assay could not complete a calculation. Reload the lab to restore the saved checkpoint.';
});
if (window.parent !== window)
  new ResizeObserver(() =>
    window.parent.postMessage(
      { type: 'mosk-lab:height', height: Math.ceil(document.body.getBoundingClientRect().height) },
      window.location.origin,
    ),
  ).observe(document.body);
$('protocol').value = checkpoint.protocol;
$('odor').value = checkpoint.odorSet;
render();
if (window.parent !== window)
  window.parent.postMessage({ type: 'mosk-lab:ready' }, window.location.origin);
