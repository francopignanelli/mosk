# Memory, lifespan and experiments in MOSK

Research checked 2026-09-19. **Implementation update:** Research & learning now includes the source-derived Huang–Luo circuit assay with original conditioning, retention, extinction and feedback-removal protocols, completed-bout synaptic logs, and per-life replayable checkpoints. It runs separately from the roaming controller. The MaleCNS atlas also includes real anatomical annotations. Navigation learning, reversal, sensory-conflict experiments, cross-life transfer and aging remain proposals. See [the tutorial](./TUTORIAL.md) and the deployed assay's README for operational boundaries.

## What the current fly actually does

MOSK's roaming fly runs a hand-written sensory utility controller, or a seeded random baseline. It does not use MaleCNS neurons to choose movement. The 18 Brain Activity nodes display normalized sensory, motivational and motor signals; the displayed edges explain associations in this controller, not anatomical synapses. The separate assay exposes real computational plasticity variables from a published circuit. A brighter roaming-controller node alone is not evidence of learning or conscious intent.

There is limited state over time: the previous action changes some decision thresholds, wandering has a short-lived direction, and displayed activity is smoothed. For example, the fly starts seeking water at one hydration threshold and continues until a higher one, preventing rapid indecisive switching. This is action persistence, not an acquired association or a remembered route.

Saving and restoring preserves the current fly, controller state, world state and records. Starting a new generation creates a fresh controller. Archives preserve previous results for the observer; the next fly does not read them. The word _generation_ currently means a new experimental life, not a simulated genetic lineage. Exploration records and fog of war are also observer/world state, not proof that the fly has a cognitive map. Its controller still receives local sensory cues rather than unrestricted access to the map.

Age is currently elapsed simulation time. It causes no decline and imposes no lifespan limit. A fly that continuously meets its needs and avoids damage can, in principle, survive indefinitely. Faster playback advances the same simulation steps; it does not introduce a separate biological aging rule.

## Is memory part of the research?

Memory is a real feature of biological flies, but it is not automatically included when loading a connectome. Google's September 2026 announcement concerns **MaleCNS, an anatomical wiring map** produced with HHMI Janelia and collaborators. A map supplies a structural constraint; it does not by itself supply an executable learning rule, current physiological state or recoverable autobiographical memories. That distinction follows from what the release contains, rather than a claim that anatomy is irrelevant to memory. [Google Research announcement](https://www.research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/), [MaleCNS project](https://male-cns.janelia.org/).

The separate **Shiu et al. whole-brain computational model** uses the female FlyWire connectome. It simulates spiking responses and allows neural activation and silencing. In the checked implementation, synaptic weights are initialized from signed connectivity; the synaptic event transmits that weight, and each trial builds a new network. There is no experience-dependent weight-update rule in that implementation. Transient neural activity is therefore different from learned associations. [Published paper](https://www.nature.com/articles/s41586-024-07763-9), [model source](https://github.com/philshiu/Drosophila_brain_model/blob/main/model.py).

Experimental work on real flies shows that pairing an odor with activation of particular dopamine neurons produces odor-specific changes in mushroom-body output synapses. Kenyon cells represent odors, dopamine provides teaching signals, and altered output can change later approach or avoidance. This supports a biologically motivated conditioning feature; it does not validate an arbitrary navigation-memory implementation. [Hige et al., Neuron 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4674068/).

A particularly relevant later study combines physiology and connectomic constraints in a small mushroom-body model with interacting short- and long-term memory components. It includes explicit dopamine-dependent plasticity and tests predictions experimentally. Its compact model suggests that meaningful learning experiments need not begin by simulating an entire brain. Reusing its MATLAB implementation requires respecting its GPLv3-or-later license. [Huang, Luo et al., Nature 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11525173/), [authors' implementation](https://github.com/schnitzer-lab/Luo_Huang_2024_MB_model).

## Proposed memory lifecycle

The default should be **individual experience within one life**. A memory system should retain uncertainty, forget or update outdated evidence, and expose why it changes a decision.

| Information                  | What it would represent                                                       | Reload the same life | New life                                    |
| ---------------------------- | ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------- |
| Working state                | Recent cue direction, last action, short sensory history                      | Restore              | Reset                                       |
| Learned associations         | An odor predicts food or danger, with confidence and decay                    | Restore              | Reset by default                            |
| Spatial experience           | Approximate remembered resource or refuge locations, with age and uncertainty | Restore              | Reset by default                            |
| Observer records             | Maps, plots, events and archived experiments                                  | Keep                 | Keep for comparison, outside the controller |
| Optional training checkpoint | Explicitly transferred learned parameters                                     | Restore              | Carry only in a labeled transfer experiment |
| Optional inherited traits    | Mutated sensory sensitivity or learning-rate parameters                       | Restore              | Inherit only in a separate evolution mode   |

Transferring learned weights across lives is a useful machine-learning experiment, but it should be labeled **continued training**, not biological ancestral memory. Evolution of traits is another distinct mechanism; it need not copy specific experiences. Neither exists in MOSK today.

An interpretable first memory could record: “odor A predicted food in 4 of 5 encounters; evidence is becoming stale.” Spatial memory should hold an estimated location, not reveal undiscovered terrain. If a remembered fruit disappears, the fly should revise its expectation. The interface can show the remembered estimate beside the true environment without giving that privileged information to the controller.

## Risk, refuges and stability

A stable strategy is a legitimate experimental result. We should create understandable trade-offs and then measure adaptation, instead of making success trigger arbitrary punishment.

- Separate safety from nourishment: a refuge can allow recovery while food and water still require excursions. Size-based predator exclusion is a designed environmental abstraction; it is not a feature furnished by a brain dataset.
- Make resources depletable and unevenly replenished. A rich exposed patch can offer more energy per visit, while a sheltered patch offers less. Keep at least some viable routes so “risk” does not mean unavoidable death.
- Introduce slow, visible, seeded changes such as fruit ripening, drying puddles and moving odor plumes. Record the change so observers can connect a new strategy to a cause.
- Let internal need alter the value of risk. A well-fed fly can prefer a detour; a starving one may accept exposure. A learned controller must acquire useful predictions from its own observations.

Compare stable and changing environments under matched seeds. Measure time outside shelter, energy gained per exposed second, revisit efficiency and avoidance after an encounter. A repeated route only demonstrates habit or learning if the controller and experimental controls actually support that interpretation.

## Lifespan and aging

There is no maximum lifespan encoded in MaleCNS. Biological longevity depends on conditions, so importing a single number as a hard deadline would create false precision. As one concrete laboratory example, a lifespan protocol reports mean and median longevity above 50 days for its wild-type populations on a specified diet at 25°C; it also demonstrates temperature and diet effects. That is a result under those conditions, not a species-wide maximum or a conversion to MOSK minutes. [Linford et al., 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3582515/).

Two explicit modes would serve different goals:

- **Controlled experiment:** aging disabled, fixed observation duration. A fly alive at the end is recorded as surviving to the time limit, not as a death. This makes learning and controller comparisons easier to interpret.
- **Naturalistic life:** a separate, configurable biological age gradually reduces recovery and physical reserve, with increasing age-related mortality even when current needs are met. Display those changes and log age-related deaths separately. Choose and validate the time scale against a stated target; do not silently reinterpret elapsed seconds as biological days.

A naturalistic lifespan distribution is preferable to killing every successful fly at the same birthday. A hard duration cap can still stop an experiment for practical reasons. It should be called an observation limit and preserve the living fly's final state. Existing runs should not suddenly receive an age penalty when this option is introduced.

## Experiments worth adding first

| Priority | Experiment                             | Observable question                                                                            | Required comparison                                                                |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1        | Odor conditioning and reversal         | Does a cue change approach after reward, and does the fly adapt when the reward switches cues? | Plasticity enabled versus frozen; paired versus unpaired cue and reward            |
| 2        | Memory retention and extinction        | How quickly does the association weaken without reinforcement?                                 | Equal exposure and initial training, varied delay; immediate versus delayed reward |
| 3        | Conflicting senses                     | How does choice change when odor suggests food but vision suggests danger?                     | Present each cue alone and together; vary cue reliability                          |
| 4        | Targeted neural intervention           | Which modeled pathway is necessary or sufficient for a response?                               | Temporary silencing or stimulation versus matched sham intervention                |
| 5        | Exploration after environmental change | Can the fly stop revisiting a depleted patch and discover a better one?                        | Naive versus trained fly; unchanged versus moved resource                          |
| 6        | Internal-state-dependent choice        | Does the same stimulus produce different choices when hungry, thirsty or rested?               | Matched sensory input and history with one internal variable changed               |

The most valuable interface addition after node explanations would be an **experiment replay**: pause at a choice, inspect sensed evidence and learned expectations, then compare matched runs with one pathway or learning rule altered. The difference is interpretable evidence within the model; it is not automatically a finding about a real fly.

## Incremental integration with real neural data

1. Keep the utility and random controllers as honest baselines. Version the model, input mappings, parameters, world seed and experimental protocol together.
2. Reproduce a published bounded circuit and its original input/output tests offline. For associative memory, the mushroom-body work above is more directly relevant than merely importing a large static graph. A hemibrain- or FlyWire-based result must retain that attribution; moving to MaleCNS requires a documented cell-type mapping and new checks.
3. Adapt a clearly labeled sensory encoder and motor readout to the terrarium. Report which connections are measured, which dynamics are assumed, and which behavior is imposed by the decoder.
4. Add an explicit, cited plasticity rule where the chosen experiment requires learning. Record weight changes and their teaching signals. Test frozen weights, shuffled connectivity and simple baselines to establish what contributes to the behavior.
5. Run batches across seeds and report distributions, not a selected entertaining life. Keep an intervention log and distinguish observer knowledge from what the controller sensed.

The objective is a useful experimental instrument: behavior with traceable causes, reproducible interventions and honest limitations. More neurons, more hazards or longer survival are not by themselves stronger evidence of biological fidelity. See [MALECNS.md](./MALECNS.md) for dataset provenance and integration boundaries.
