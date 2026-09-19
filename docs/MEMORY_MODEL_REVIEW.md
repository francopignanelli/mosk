# Published memory-model review

Research checked 2026-09-19. The resulting implementation is the **standalone published circuit assay** in [`public/learning-lab`](../public/learning-lab/README.md). It has its own complete source and GPLv3-or-later license and is separate from MOSK's habitat controller.

The user's requirement to reuse supplied models and make scientifically grounded decisions excludes treating the current hand-written utility controller as Google's brain or adding arbitrary memory claims. MaleCNS supplies anatomy; the checked Shiu whole-brain implementation supplies fixed-weight dynamics. Neither provides a ready implementation of acquired associative memory that can simply be enabled in this habitat.

## Selected bounded reproduction

[Huang, Luo et al. (Nature 2024)](https://doi.org/10.1038/s41586-024-07819-w) publish an experimentally constrained model with interacting mushroom-body memory components. The [authors' MATLAB implementation](https://github.com/schnitzer-lab/Luo_Huang_2024_MB_model) includes fitted parameters, conditioning and retention schedules, odor-only extinction, and a feedback-removal comparison. Revision `5d7c08a9a88f923169a0c3008aca68af421e9a7f` was pinned before translation.

The browser assay preserves the original dynamics, fitted mean values, bout durations and specific interventions. Its actual memory variables are the six odor-specific effective KC→MBON weight changes, with two odor adaptation values stored separately. A numerical log shows these values, their changes, the cue and punishment input, and the model's six DAN/MBON responses. It does not write sentences claiming what the fly “believes.”

The browser controller and an independent Python translation agree across 14 protocol/odor combinations and 470 bout checkpoints. The maximum numerical discrepancy was 7.11×10⁻¹⁵. This is cross-checking translations of the equations: **MATLAB itself was not executed**, and the paper's confidence-interval sampling and biological experiments were not reproduced. Full methods, exact coefficients, original sources, hashes and reproduction commands are in the [assay documentation](../public/learning-lab/README.md).

## Why the assay does not drive the habitat

The published model takes specified experimental odor and punishment bouts and predicts neural response changes. Turning proximity to food or a spider into its KC/DAN inputs, assigning weights to left/right motor commands, and choosing how a 30-second conditioning bout maps onto free behavior would introduce new assumptions. These are substantial new models, not consequences of the connectome. They require declared mappings and validation. This release therefore makes conditioning, retention, extinction and the published feedback intervention observable without claiming a validated whole-animal learner.

The assay is stored with a life as an experiment record. It is not evidence that the habitat fly learned from that life's experiences. A new life starts a fresh assay; reloading the same life reconstructs its exact state from a versioned deterministic checkpoint. An archive is observer data, and is not silently inherited.

## Other reusable implementations reviewed

- [Jiang & Litwin-Kumar (PLOS Computational Biology, 2021)](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1009205) publish a trainable mushroom-body network: [authors' code](https://github.com/alitwinkumar/jiang_litwin-kumar_mb_rnn), GPLv3. It is scientifically relevant, but not a permissively licensed drop-in replacement or a Google release.
- [Gkanias et al. (eLife, 2022)](https://doi.org/10.7554/eLife.75611) publish an incentive-circuit model and reproduction scripts: [authors' code](https://github.com/InsectRobotics/IncentiveCircuit). Its repository also supplies GPL licensing. Adopting it would require reproducing its specific experiments and keeping its assumptions visible.
- [Bennett, Philippides & Nowotny (Nature Communications, 2021)](https://doi.org/10.1038/s41467-021-22592-4) publish a reinforcement-prediction-error mushroom-body model and [authors' source](https://github.com/BrainsOnBoard/paper_RPEs_in_drosophila_mb). It is another relevant scientific candidate, but is not the Google model and was not integrated here.

Popular third-party fly demos claiming learning were not used as scientific validation or substitutes for authors' implementations. A permissive software license alone does not establish biological fidelity.

## Still requires a specified, tested extension

Reversal conditioning, multimodal conflicts, environmental reward maps, deliberate navigation, targeted interventions beyond the source's defined feedback removal, inherited memories and aging are **not implemented in this assay**. The next credible step is to choose a primary-source protocol and make its expected input/output behavior reproducible before connecting it to the habitat. A memory log should continue to expose actual model state, model version and input provenance rather than plausible-sounding interpretations.
