# MaleCNS integration: what is real and what comes next

Research checked 2026-09-19. MOSK now bundles **96 real MaleCNS annotation records** as an anatomical atlas and a **separate published Huang–Luo memory assay**. The full MaleCNS connection graph does not run the roaming fly. These additions do not establish a validated whole-animal model. See [OFFICIAL_ASSETS.md](./OFFICIAL_ASSETS.md) for exact provenance, the wider Google-associated inventory and practical boundaries.

## Verified dataset

[MaleCNS v1.0](https://male-cns.janelia.org/) reconstructs the brain, optic lobes and ventral nerve cord of one adult male _Drosophila melanogaster_. [Berg et al., Cell (2026)](https://doi.org/10.1016/j.cell.2026.08.015) report 166,700 annotated neurons (including sensory axons) and 11,710 cell types. The graph between proofread neurons contains 166,483 connected neurons, 25.58 million directed edges and 124.2 million synaptic connections; 217 neurons have no synapses. These quantities are different from raw automated detector counts. Individual synapses were not manually proofread.

The [official downloads](https://male-cns.janelia.org/download/) provide Feather annotation, neurotransmitter prediction and connection-weight tables under `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/`. The full segment graph is advertised as 1.1 GB. Morphologies are available as SWC and Neuroglancer formats; coordinate units depend on the format. Querying neuPrint uses dataset `male-cns:v1.0` and an account token. Bulk exports are preferable for reproducible offline preparation, and no token belongs in the frontend bundle.

Dataset license: **Creative Commons Attribution 4.0 (CC BY 4.0)**. The derived atlas credits FlyEM / HHMI Janelia, Cambridge / MRC LMB and Google Research, links the source/version/paper/license, and documents selection and transformations. Source body IDs and labels are retained. The source annotation table has 211,577 rows including non-neuronal and orphan categories; this is not a neuron count. No edges, activity or learned memories are inferred from the teaching sample.

## Reuse a model before inventing a simulator

[Shiu's Drosophila brain model](https://github.com/philshiu/Drosophila_brain_model) is an MIT-licensed Python/Brian2 leaky integrate-and-fire implementation with activation, silencing, spike times and firing-rate output. It is a valuable starting point, but it uses the **female FlyWire brain**, originally version 630 with configuration for 783. It is not a MaleCNS implementation, and validation does not automatically transfer to a different graph, body, or sensory mapping.

[FlyBody](https://github.com/TuragaLab/flybody) provides a MuJoCo fly body and locomotion tasks, not a complete connectome controller. [FlyGym / NeuroMechFly](https://github.com/NeLy-EPFL/flygym) provides biomechanical and sensory simulation based on a female body specimen. These are possible later embodiment tools; neither is required for the current two-dimensional terrarium.

## Proposed integration stages

The published memory assay is a separate program with fitted circuit dynamics and explicit plasticity. Its source-derived protocol checkpoints are saved per life; its GPLv3+ source is distributed in `public/learning-lab`. It does not invent a mapping to terrarium movement. The remaining stages below concern a future connectome-driven roaming controller.

This is an engineering proposal, not an established biological result.

1. **Prepare data offline.** Read version-pinned Feather files in Python. Preserve source body IDs, filter to a documented neuronal population, aggregate duplicate directed pairs, and emit sparse typed arrays. Include a manifest with source URLs, checksums, selection criteria, counts, license, attribution and transformations.
2. **Start with a bounded subgraph.** Select documented sensory-to-descending pathways. Keep anatomical synapse counts separate from assumed gains, neurotransmitter signs, membrane constants and motor mappings. Quantify what was excluded.
3. **Adapt existing dynamics.** Reproduce the original Shiu model's tests before adapting its approach. Run the resulting controller in a Web Worker/WASM port or a separate Python service. Budget runtime memory and step throughput before attempting the full graph. Package caching and genuine loading progress only when these large assets actually exist.
4. **Use the existing boundary.** A `BrainEngine` consumes `SensoryFrame` plus serializable internal state and returns `BrainOutput`. An asynchronous worker extension should expose explicit `initialize`, `step`, `serialize`, `restore`, and `dispose` operations, immutable topology identity and buffered telemetry. The present synchronous contract is sufficient for the lightweight MVP; it is not a full neural asset loader.
5. **Validate and compare.** Test sensory responses, motor readouts, timing, stability and lesion effects independently. Compare against the utility and random baselines under identical seeds. Label the result a _connectome-constrained computational model_, documenting all assumed mappings and parameters.

Wiring alone does not establish faithful behavior, learning, internal experience or consciousness. Brain Activity must distinguish measured graph structure from simulation activity and aggregation artifacts at every stage.
