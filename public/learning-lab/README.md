# Published memory assay

This is a standalone browser translation of the fitted, three-compartment mushroom-body model accompanying **Huang, Luo et al., “Dopamine-mediated interactions between short- and long-term memory dynamics,” Nature 634, 1141–1149 (2024)**. DOI: https://doi.org/10.1038/s41586-024-07819-w.

It is an explicit circuit experiment. It **does not control MOSK's habitat fly**, does not use Google's MaleCNS data, and does not claim to reproduce a whole brain or an animal's thoughts. Associating its checkpoint with a fly is experiment organization, not a biological claim. No habitat odor, food, predator or movement is fed into this assay. The habitat's utility and random controllers still do not learn.

## Source and license

- Authors' source: https://github.com/schnitzer-lab/Luo_Huang_2024_MB_model
- Pinned revision: `5d7c08a9a88f923169a0c3008aca68af421e9a7f`.
- License of this standalone program and its adaptations: **GPL-3.0-or-later**. Full text: [LICENSE.txt](./LICENSE.txt).
- Original copyright: Junjie Luo, Cheng Huang, Mark J. Schnitzer (2024). JavaScript/Python translation and interface: MOSK contributors (2026).
- Original model: [Dx_steady_state_MBON_0301_2023.m](./upstream/Dx_steady_state_MBON_0301_2023.m).
- Original protocols: [experimental_condition.m](./upstream/experimental_condition.m), [fit_nonlinear_models.m](./upstream/fit_nonlinear_models.m), [plotPanel_5j_R2_CI.m](./upstream/plotPanel_5j_R2_CI.m), [plotPanel_5e_R2.m](./upstream/plotPanel_5e_R2.m).
- Original fitted parameters: [three-module MAT file](./upstream/data_and_parameters/Dx_steady_state_nonlinear_3_27-Mar-2023_3modules.mat). SHA-256: `cb7b555026f97b59678adf8902b9f4a02975413a7eed9d6e03f2e2864821915d`.
- Human-readable extraction: [parameters-extracted.json](./parameters-extracted.json). [Extraction script](./upstream/read_parameters.py) uses Python's standard library and preserves the original double values.

Readable corresponding source is distributed alongside the page: [model.js](./model.js), [lab.js](./lab.js), [style.css](./style.css), [index.html](./index.html), [reference.py](./reference.py), and [verify.mjs](./verify.mjs). It requires no build step or external JavaScript packages. Serve this directory over HTTP and open `index.html`. It can run independently of MOSK and exports its own results as JSON. Its browser protocol sends only experiment checkpoints and receives participant labels; there is no imported app controller code.

## State and interpretation

The model has two odor channels and six recorded response variables, in this order:

1. PPL1-γ1pedc dopamine neuron response.
2. PPL1-α′2α2 dopamine neuron response.
3. PPL1-α3 dopamine neuron response.
4. MBON-γ1pedc output response.
5. MBON-α2sc output response.
6. MBON-α3 output response.

These are the original rate-model variables, not six individual cells sampled from MaleCNS. Each rate is a **change from baseline in hertz**. The three MBON baselines are 35.2, 9.0 and 11.2 Hz, with respective maxima 71.66, 17.9 and 31.16 Hz. The code retains the author's linear DAN response and bounded piecewise-linear MBON response. It retains the original initial `(I−W)⁻¹` estimate and ten fixed-point updates with transposed recurrent input.

Acquired memory is the 2×3 array `plasticity`: an effective KC→MBON weight change for each odor and compartment. It starts at zero and is added to the original fitted input weights. There are no invented confidence scores, remembered map locations or textual beliefs. Effective weights are allowed to be negative, as in the original source; they must not be interpreted as literal negative anatomical synapse counts. The interface separately shows the actual two-element odor adaptation state.

For each original experimental bout:

1. Update odor responsiveness using the authors' exposure adaptation rate, 0.05 s⁻¹, and fitted recovery time, 791.9841678866914 s; use the mean of beginning and ending responsiveness for that bout's KC input.
2. Solve the six neural response changes using current effective weights and the punishment input. The published punishment response increments are 27.85 Hz for γ1 and 11.38 Hz for α3.
3. Add the published dopamine-dependent weight change, scaled by the bout duration divided by the original standard three 30-second bouts. Fitted coefficients are −21.35073162171509 for the odor/feedback teaching component and −5.604318227436501 for the punishment-dependent component.
4. Apply the original exponential weight decay. The γ1 time constant is 2022.7098422193494 s. The α2/α3 time constant is 6219.828611270908 s during the first three hours after the final training session and 242787.59006247285 s afterwards. A bout crossing that threshold is split for decay exactly as in the source.
5. Record the actual pre-update neural activity, post-update memory weights, responsiveness, their changes and the elapsed biological assay time.

Times are **biological seconds within the published assay**, not a conversion from habitat time. Display playback spends 650 milliseconds per bout solely to make the sequence inspectable. Rest bouts may advance hours instantly. Neither habitat speed nor browser frame rate changes the model calculation.

## Protocols provided

All runs start from the same fitted initial state. Selecting a new assay resets that assay; it does not continue training from the previous protocol.

| ID                   | Source                              | Bouts | What is reproduced                                                                                                                 |
| -------------------- | ----------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `conditioning`       | `experimental_condition.m` defaults |    41 | Odor imaging, 3 paired training cycles, imaging, 3 more cycles, imaging, 3600-second rest, imaging.                                |
| `retention`          | `fit_nonlinear_models.m`            |    51 | Original conditioning plus the source's 3-hour and 24-hour sampling schedule, including intervening imaging gaps.                  |
| `extinction-control` | Figure 5j                           |    25 | Matched training and final test without the extinction sessions.                                                                   |
| `extinction-10m`     | Figure 5j                           |    38 | Original odor-only extinction beginning at 10 minutes.                                                                             |
| `extinction-2h`      | Figure 5j                           |    38 | Original odor-only extinction beginning at 2 hours.                                                                                |
| `feedback-intact`    | Figure 5e/f                         |    21 | The authors' neutral-valence, 3-cycle, 15-minute intact-circuit condition.                                                         |
| `feedback-control`   | Figure 5e/f                         |    21 | That condition with the five specified γ1 feedback parameters removed: original one-based parameter indices 12, 13, 15, 18 and 19. |

The default imaging bouts present CS+ for 5 seconds, a 120-second gap, CS− for 5 seconds, then a 120-second gap. Training uses 30-second odor bouts and 135-second gaps; only CS+ receives the modeled punishment. Extinction follows the authors' three-cycle odor-only session. The Figure 5j variants retain their 300-second modified gaps, specified odor-valence resets and 1.5× multiplier on the punishment-plasticity coefficient. Their total duration is identical, 12335 seconds. The feedback pair uses the original neutral-valence reset and identical 2435-second total duration.

The two odor options reproduce the source's attractive and repulsive parameter selections. The model represents paired aggregate odor responses; it is not an independent chemical receptor model. The feedback experiment fixes neutral innate valence, so the odor selector is disabled there.

The paper's confidence intervals were generated by sampling parameters. This implementation uses the **fitted mean parameter vector only** and does not reproduce those uncertainty bands. A graph difference is a prediction within this model, not new evidence from a living fly. No arbitrary silencing, reversal protocol, reward replacement, navigation decoder or biological aging rule is added.

## Numerical verification and limits

Run:

```sh
python reference.py
node verify.mjs
```

The independent Python translation reads the extracted original parameter values and evaluates the MBON portion directly in feedforward order. The browser translation retains the MATLAB solver's ten recurrent iterations. The fixture compares **14 protocol/odor combinations, 470 bout checkpoints and 6580 activity, adaptation and plasticity values**, with maximum absolute difference 7.11×10⁻¹⁵ in the checked environment. Every intermediate save/replay checkpoint is also checked, and extinction control durations are identical.

**MATLAB was not executed.** These checks establish agreement between two translations of the published equations and protocols; they do not constitute an independent replication of the paper's biological experiments, MATLAB execution or confidence intervals. Original-source comparison, dimensional checks and deterministic replay complement the numerical cross-check. [reference-output.json](./reference-output.json) states this provenance explicitly.

## Saving and host integration

The persisted checkpoint has exactly five fields:

```json
{
  "version": 1,
  "model": "huang-luo-2024@5d7c08a9",
  "odorSet": "attractive",
  "protocol": "conditioning",
  "cursor": 0
}
```

The model is deterministic, so reconstructing the first `cursor` original bouts recovers all weights, adaptation and the log exactly. The bounded checkpoint avoids saving user-supplied weight arrays. Same-life reload restores it; a new life starts at zero unless an explicitly separate transfer protocol is introduced in future. Rewinding the interface is replay, not a biological forgetting mechanism.

Embedding protocol, restricted to the parent window and same origin:

- Child sends `{type:"mosk-lab:ready"}`.
- Host sends `{type:"mosk-lab:restore",flyId,flyName,readOnly,state:checkpointOrNull}`.
- Child sends `{type:"mosk-lab:state",flyId,state:checkpoint}` after authorized changes.
- Host may send `{type:"mosk-lab:context",flyId,flyName,readOnly}` to change labels and permissions without altering the checkpoint.
- Child sends `{type:"mosk-lab:height",height}` for layout.

The host validates the source window, origin, participant identifier and exact checkpoint bounds. A read-only assay can be replayed locally but never publishes checkpoint changes; playback stops when the host changes it to read-only. Downloads contain the complete numerical record and attribution.
