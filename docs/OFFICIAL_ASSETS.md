# Official fly resources and what MOSK actually uses

Checked 2026-09-19. The name “Google fly model” covers distinct research outputs. They cannot be treated as interchangeable versions of one pretrained agent.

## Included in this app

MOSK now bundles a **read-only, 96-cell MaleCNS v1.0 annotation sample** in `public/data/malecns-v1.0-atlas.json`. Its reference atlas displays actual source body IDs, cell types, instances, sides, and annotation classes. It does not display invented firing rates or inferred connections. These cells do not drive the fly.

The original annotation file is retained in `artifacts/research/`, outside the deployed bundle. It contains 211,577 annotation rows, including glia and unassigned entries; that number must not be described as a neuron count. This locally derived count is distinct from the publication's annotated-neuron totals.

The conversion script is `scripts/prepare-malecns-atlas.py`. It verifies the source SHA-256, selects exact source class/superclass values, retains traced entries with types, sorts numeric body IDs, and takes the first 12 per group. This deterministic teaching sample is **not a representative sample or a complete circuit**. No connections, neurotransmitter probabilities, activity, learned weights, or behavioral valence are inferred.

| Exact source annotation        | Matching source rows | Traced entries with types | Bundled cells |
| ------------------------------ | -------------------: | ------------------------: | ------------: |
| `class=olfactory`              |                2,639 |                     2,635 |            12 |
| `class=ALPN`                   |                  686 |                       682 |            12 |
| `class=Kenyon_Cell`            |                4,064 |                     4,064 |            12 |
| `class=DAN`                    |                  340 |                       340 |            12 |
| `class=MBON`                   |                   97 |                        97 |            12 |
| `superclass=descending_neuron` |                1,314 |                     1,310 |            12 |
| `class=gustatory`              |                1,428 |                     1,416 |            12 |
| `superclass=visual_projection` |                9,201 |                     9,201 |            12 |

Source: [official annotation Feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather), 14,483,314 bytes. SHA-256: `2177e246113e4cfbf1e7772ec37c6da1955ff22e8063d0b1f833101f99a9a3b2`. The JSON sample is 39,656 bytes before deployment compression. `public/data/NOTICE-MaleCNS.txt` accompanies redistribution. The complete provenance is embedded in the sample.

## MaleCNS: anatomy, not executable behavior

Google Research's September 2026 release describes a male central nervous system wiring map produced with Janelia and collaborators. It supplies anatomical structure rather than a pretrained survival policy, lifetime history, aging model, or memory log. Google's article separately discusses combining static connectomes with other information to investigate learning. [Google Research announcement](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/).

The official release is `v1.0`; neuPrint calls it `male-cns:v1.0`. These are the relevant bulk resources, with advertised sizes:

| Resource                                                                    | Published size | MOSK status                                    |
| --------------------------------------------------------------------------- | -------------: | ---------------------------------------------- |
| Body annotations                                                            |          13 MB | Downloaded; attributed 96-cell subset deployed |
| Body neurotransmitter predictions                                           |          42 MB | Available, not downloaded                      |
| Body synapse statistics                                                     |         780 MB | Available, not downloaded                      |
| Full segment connection graph                                               |         1.1 GB | Available, not downloaded or simulated         |
| Synapse coordinates                                                         |        12.7 GB | Available, not downloaded                      |
| Synaptic partner pairs                                                      |         6.8 GB | Available, not downloaded                      |
| Per-presynapse transmitter probabilities                                    |         2.7 GB | Available, not downloaded                      |
| Neuron skeletons, segmentation, EM images, neuropil volumes, Neo4j database |         Varies | Available, not bundled                         |

Bulk files require no neuPrint token; programmatic neuPrint access requires an account token. Original SWC skeleton coordinates use 8 nm units; precomputed skeleton coordinates use 1 nm. The dataset is CC BY 4.0. These resources and their exact download links are on the [official download page](https://male-cns.janelia.org/download/). Attribution, source links, transformations and license are provided with the MOSK derivative; no endorsement is implied.

## Related research is separate

**Shiu / FlyWire whole-brain simulation.** The authors provide an MIT-licensed Python/Brian2 leaky integrate-and-fire model, activation/silencing experiments, and spike output. The documented default graph is female FlyWire 630; version 783 data and configuration are also available. It is not a MaleCNS controller. Its checked source initializes weights from connectivity and defines fixed synaptic weights, rather than an experience-dependent learning rule. MOSK does not currently run or port it. [Repository and documented versions](https://github.com/philshiu/Drosophila_brain_model), [model source](https://github.com/philshiu/Drosophila_brain_model/blob/main/model.py), [MIT license](https://github.com/philshiu/Drosophila_brain_model/blob/main/LICENSE).

**Flybody.** Google DeepMind and HHMI Janelia provide a detailed MuJoCo body, locomotion environments, tutorials and reinforcement-learning tooling. The core physics installation is separate from optional ML/training dependencies. The repository uses Apache 2.0. It supplies embodiment and training tasks, not a connectome-based memory controller. It is not incorporated in the present 2D terrarium. [Official repository](https://github.com/TuragaLab/flybody), [license](https://github.com/TuragaLab/flybody/blob/main/LICENSE), [2025 paper](https://doi.org/10.1038/s41586-025-09029-4).

## What evidence-based integration requires

Using an official anatomical table does not turn MOSK's existing utility controller into a biological brain. The existing 18 activity nodes remain explained controller signals, and the reference atlas is displayed separately. A dopamine-class annotation does not measure a live reward signal; a Kenyon-cell annotation does not identify a specific stored memory.

The next genuine neural integration should reproduce a published model's documented experiment, retain its original graph/version and parameters, and compare the output before changing the input or embodiment. Any mapping from simulated food, water, or movement to that model needs a cited experimental basis and explicit validation. Anatomical synapse counts must remain distinguishable from assumed synaptic gains and motor mappings. These are engineering requirements, not claims that the current app already implements the published model.

For memory, instrument a published plasticity implementation directly: expose actual changed synaptic variables, stimulus identity, timing, and retention state. A prose event diary or camera exploration map alone would be an observer record, not learned fly memory. A memory implementation from another laboratory must be named and attributed separately instead of being labeled a Google-provided feature.

We have intentionally not added arbitrary age-related death, invented neurotransmitter activity, or unsupported inheritance to fill gaps in these releases. Scientific evidence can guide a later experiment, but the released anatomy cannot determine those mechanics by itself.

## Reproduce the annotation sample

Download the [official Feather file](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather), install `pyarrow` in a development environment, and run:

```text
python scripts/prepare-malecns-atlas.py path/to/body-annotations-male-cns-v1.0-minconf-0.5.feather
```

The script rejects a file that differs from the pinned checksum. Tests check source counts, annotation-group membership, original body IDs, ordering, unique sample IDs, and UI fetch/search/retry behavior. Full source data and Python preparation dependencies are not part of the Netlify deployment.
