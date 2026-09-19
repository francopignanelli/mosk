"""Independent numerical cross-check of the published Huang/Luo equations.

Copyright (C) 2024 Junjie Luo, Cheng Huang, Mark J. Schnitzer
Modifications (C) 2026 MOSK contributors
SPDX-License-Identifier: GPL-3.0-or-later

This is a Python translation, not results obtained by executing MATLAB.
The reference solves the acyclic MBON response directly; model.js preserves
the MATLAB matrix estimate followed by ten recurrent fixed-point updates.
Run with Python 3, without third-party dependencies, to regenerate fixtures.
"""
import copy
import json
import math
from pathlib import Path

ROOT = Path(__file__).parent
PARAMETERS = json.loads((ROOT / 'parameters-extracted.json').read_text())['parameterCells']
BASE = [35.2, 9, 11.2]
MAXIMUM = [71.66, 17.9, 31.16]
PUN = [27.85, 0, 11.38]


def session(name, cycles=1):
    d, gap = (5, 120) if name == 'imaging' else (30, 135)
    return [(name, 0, d, int(name == 'training')), (name, None, gap, 0),
            (name, 1, d, 0), (name, None, gap, 0)] * cycles


def protocol(name):
    if name in ('conditioning', 'retention'):
        p = (session('imaging') + session('training', 3) + session('imaging') +
             session('training', 3) + session('imaging') + [('rest', None, 3600, 0)] + session('imaging'))
        if name == 'retention':
            p += [('rest', None, 6950, 0)] + session('imaging') + [('rest', None, 75100, 0)] + session('imaging')
        return p
    if name.startswith('feedback'):
        p = session('imaging') + session('training', 3) + [('rest', None, 765, 0)] + session('imaging')
        p[3] = ('imaging', None, 300, 0)
        return p
    p = session('imaging') + session('training', 3) + session('imaging')
    p[3] = ('imaging', None, 300, 0)
    p[15] = ('training', None, 300, 0)
    if name == 'extinction-control':
        p += [('rest', None, 10250, 0)]
    else:
        first = 50 if name == 'extinction-10m' else 6650
        p += [('rest', None, first, 0)] + session('extinction', 3) + [('rest', None, 10250-first-990, 0)]
    return p + session('imaging')


def simulate(name, odor):
    raw, fw0, fwdt, recurrent, tau, odor_tau = copy.deepcopy(PARAMETERS)
    raw = raw[0]
    fw0, fwdt, tau, odor_tau = fw0[0][0], fwdt[0][0], tau[0], odor_tau[0][0]
    if name == 'feedback-control':
        for i in (0, 1, 2, 4, 5):
            recurrent[3][i] = 0
    if name.startswith(('extinction', 'feedback')):
        if name.startswith('feedback'):
            v = [0, 0, 0]
        else:
            v = [-3.42, -4.58, -5.60] if odor == 'attractive' else [2.57, 2.24, 3.35]
            fwdt *= 1.5
        firing = v + [31.6, 5.8, 17.8]
        input_weights = [(firing[i] - sum(recurrent[j][i] * firing[j] for j in range(6))) *
                         2 / (1 + math.exp(-0.25)) for i in range(6)]
    else:
        input_weights = raw[:6] if odor == 'attractive' else raw[6:9] + raw[3:6]
    bouts = protocol(name)
    last_training = max(i for i, b in enumerate(bouts) if b[0] == 'training')
    adaptation = [1, 1]
    delta = [[0, 0, 0], [0, 0, 0]]
    elapsed = post = 0
    history = []
    for index, (phase, cue, duration, punishment) in enumerate(bouts):
        end = [1 - (1 - adaptation[o] * math.exp(-0.05 * duration * int(o == cue))) *
               math.exp(-duration / odor_tau) for o in range(2)]
        kc = [(adaptation[o] + end[o]) * 0.5 * int(o == cue) for o in range(2)]
        drive = [sum((input_weights[i] + (delta[o][i - 3] if i >= 3 else 0)) * kc[o]
                     for o in range(2)) + (PUN[i] * punishment if i < 3 else 0) for i in range(6)]
        # Direct evaluation of this fitted circuit's feedforward MBON portion.
        mbon = []
        for m in range(3):
            response = drive[m+3] + BASE[m] + sum(recurrent[j+3][m+3] * mbon[j] for j in range(m))
            mbon.append(min(MAXIMUM[m], max(0, response)) - BASE[m])
        dan = [drive[d] + sum(recurrent[m+3][d] * mbon[m] for m in range(3)) for d in range(3)]
        activity = dan + mbon
        for o in range(2):
            for m in range(3):
                teaching = input_weights[m] * sum(kc) + sum(recurrent[j+3][m] * mbon[j] for j in range(3))
                delta[o][m] += duration / 90 * (fw0 * teaching + fwdt * PUN[m] * punishment) * kc[o]
        before = post
        if index > last_training:
            post += duration
        early = duration if post <= 10800 else max(0, 10800-before)
        for row in delta:
            for m in range(3):
                row[m] *= math.exp(-early/tau[0 if m == 0 else 1] - (duration-early)/tau[0 if m == 0 else 2])
        elapsed += duration
        adaptation = end
        history.append({'cursor': index+1, 'timeSeconds': elapsed, 'activity': activity,
                        'adaptation': adaptation[:], 'plasticity': copy.deepcopy(delta)})
    return history


if __name__ == '__main__':
    names = ['conditioning', 'retention', 'extinction-control', 'extinction-10m', 'extinction-2h', 'feedback-intact', 'feedback-control']
    cases = [{'protocol': p, 'odorSet': odor, 'history': simulate(p, odor)}
             for p in names for odor in ['attractive', 'repulsive']]
    fixture = {'provenance': 'Independent Python translation of published equations, not MATLAB execution.', 'cases': cases}
    (ROOT/'reference-output.json').write_text(json.dumps(fixture, indent=2))
    print(f'Wrote {len(cases)} protocols, {sum(len(c["history"]) for c in cases)} bout checkpoints.')
