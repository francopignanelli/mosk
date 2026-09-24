# MOSK field guide

This guide describes the observatory, source atlas, and attached memory assay. They serve different purposes: the habitat uses a sensory utility controller; the MaleCNS atlas contains anatomical reference data; the memory assay runs a separate published mushroom-body model. The assay does not control the fly's roaming decisions.

## 1. Name and observe an individual

Choose **Name this fly** below the habitat. A name can contain 1–32 Unicode characters; leading and trailing whitespace is removed. Renaming preserves the individual's age, controller state, world, and records. You can also choose a name when creating a new generation.

Start at **1×** and watch one transition: exploration to feeding, drinking, escape, or rest. Pause and compare the action with hunger, hydration, fatigue, and arousal. Higher hunger means greater need; higher hydration and energy mean more available reserves. **2×** and **5×** advance the same fixed simulation steps more quickly.

Names are observer labels. They do not change the random seed, behavior, or physiology.

Every **New generation** dialog selects **Sensory utility model** by default, including after a random-baseline experiment. Choose **Random baseline** explicitly when needed for a comparison. Restoring an existing life preserves that life's chosen controller.

## 2. Explore the map

| Control                                           | Use                                                    |
| ------------------------------------------------- | ------------------------------------------------------ |
| Drag, or focus the map and press arrow keys       | Move the camera                                        |
| **F** while the map is focused, or **Follow fly** | Return to following the individual                     |
| Mouse wheel over the map, or zoom buttons         | Zoom between 50% and 250%                              |
| Fullscreen                                        | Expand the habitat view                                |
| **Movement trail**                                | Show the fly's recent path                             |
| **Food scent field**                              | Show a soft visualization around food sources          |
| **Food / Water / Spider** map brush               | Place one type of stimulus in explored, active terrain |
| **Move map**                                      | Leave the brush and pan the camera again               |

Exploration reveals terrain around the fly; moving the camera does not reveal new territory. The map is generated progressively, with nearby terrain loaded for sensing and movement. Previously discovered terrain remains part of the observer's record. The utility controller does not acquire spatial memory from this record.

Choose a map brush, then click or drag to place food, water or spiders within the explored, active area. Pause first and place one stimulus at a time when you want to compare a response. The added objects enter the simulated world, are recorded and saved with this experiment, and can change what the fly senses locally. A spider you place follows the same pursuit rules as a naturally generated one. It remains visible in explored, active terrain so you can inspect the intervention even before the fly senses it. Map interventions do not train the separate published memory assay. Select **Move map** to return to camera panning.

The scent overlay deliberately uses low contrast. Changing its appearance or switching it off does not alter the scent signal available to the controller.

The leafy inner refuge excludes spiders and prevents detection, pursuit, and bites there. Its outer rim still carries risk. Hunger and thirst continue inside, and newly generated refuges place food and water outside their cores. Refuge geometry, metabolism, and predator behavior are designed habitat abstractions; these mechanics are not provided or calibrated by MaleCNS.

Food can be eaten or decay, disappear, and later ripen at a new location. Ponds stay in place and refill slowly. The compact icon-and-number strip inside the map repeats all six vital signs, including in fullscreen; hover or focus a number for its label. The larger explanatory card stays below the habitat. Wheel zoom follows the fly while Follow fly is enabled and anchors beneath your pointer after panning.

New terrain contains fewer spiders. For a controlled chase, place one within about 145 world units of an exposed fly, outside dense refuge cover, then resume. If no other chase is active, a deliberately placed spider can start one even during the usual recovery interval. If placed farther away or while the fly is sheltered, it roams until detection becomes possible. Faint observer-placed spiders on the map are outside detection range or behind cover. Only one spider pursues at a time, with an eight-second chase/search budget followed by a twelve-second recovery interval for ordinary encounters. Nearby non-pursuers move away to open an escape route. A healthy fly's base escape speed is 76 world units per simulation second; obstacle avoidance no longer reduces this speed, though low energy, poor health and collisions can still hinder it. The Random baseline never enters the fleeing state; use a Sensory utility model life for this experiment. Contact still causes damage, and the fly still senses actual spider positions. Health repairs slowly during rest with adequate reserves and no bite. A successful fly can stay at 100%. See [resource lifecycle](./RESOURCE_LIFECYCLE.md) and [predator encounters](./PREDATOR_ENCOUNTERS.md) for the rules, continuity checks and scientific limits.

## 3. Inspect an actual controller signal

Hover over, focus, or tap a node in **Brain Activity**. Its inspector explains the represented channel, current normalized activation, inputs, and illustrated influences. Pin a node to follow it while the simulation changes.

The 18 channels describe the current controller's sensory, drive, and motor values. The small satellite dots are part of the visual glyph. The connecting lines illustrate relationships; they are not anatomical synapses or an executable neural wiring diagram. A brighter node means more of that channel's current value. It does not establish that learning occurred.

The random baseline is available when starting a new generation. Use matching seeds and a planned observation duration when comparing controllers, rather than comparing selected interesting moments.

## 4. Use the source atlas

Open **Research → MaleCNS atlas** and inspect the reference data. Read the cell annotations and identifiers, then follow the source links when you need anatomical detail. These are reference annotations, not live recordings or simulated activity. The **How to observe** tab contains the in-app version of this guide.

MaleCNS is the FlyEM collaboration's anatomical reconstruction of the adult male fly central nervous system. Google Research is one of the collaborators. The source project supplies exploration tools, annotations, connectivity, images, skeletons, and other data. MOSK does not load and execute all of these as a complete functioning animal. [MaleCNS project](https://male-cns.janelia.org/), [official downloads](https://male-cns.janelia.org/download/).

## 5. Run a memory assay

Open **Research → Memory assay**. The attached assay uses the separate **Huang, Luo and colleagues, 2024** mushroom-body model. Its equations, fitted parameters, and original bout timing come from the study and its implementation. The authors' code is licensed under GPLv3-or-later. This is a compact research circuit, not a full MaleCNS simulation. [Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11525173/), [authors' implementation and license](https://github.com/schnitzer-lab/Luo_Huang_2024_MB_model).

Read the assay's protocol and establish a baseline before changing the stimulus. Then compare responses to its two odor inputs:

1. **Conditioning:** pair an odor with the protocol's teaching signal and compare the weights before and after.
2. **Retention:** examine the state after the protocol's delay.
3. **Extinction:** compare the source's 10-minute, 2-hour, and control protocols. Present a previously conditioned cue without reinforcement and inspect the resulting change.
4. **Feedback control:** compare the source circuit with the control that removes five MBON-γ1 feedback links. Keep the remaining protocol matched when interpreting a difference.

Reversal conditioning and conflicting-sense experiments are not implemented here because they would require additional protocols beyond this source implementation.

Use comparable starting states and protocols. Differences after changing several inputs at once are hard to attribute. A simulated result is evidence about this implementation under that protocol, not automatically a new finding about real flies.

### Reading the memory log

The weight table holds a **2 × 3 set of plastic synaptic weights**: two odor inputs across three modeled pathways. Their values are the stored numerical state. Compare current values, starting values, and changes from the preceding bout.

The **six rate readouts** describe the model's responses for each completed bout. Activity and memory are different measurements: a temporary rate response can return toward baseline while changed weights remain. The log records stimuli and changes to this circuit state. It does not contain autobiographical stories or remembered map locations.

The assay has its own experimental timing and record. Its original biological seconds are not habitat simulation seconds. Habitat hunger, spider encounters, and camera movements do not silently train it. Its learned state does not influence the roaming utility controller. This separation allows the published mechanism to be inspected without inventing an unvalidated sensory-to-navigation mapping.

## 6. Save, resume, and compare

The current life, name, habitat, map placements, controller, and attached assay checkpoint are saved automatically on this device. The checkpoint records the pinned model version, odor set, protocol, and progress cursor. Reload restores the same individual and deterministically replays the protocol to reconstruct the same synaptic weights; the save does not need a second independently editable copy of those weights. **Export JSON** downloads a portable backup of the current experiment and its archives for safekeeping, sharing, or moving to another device. **Import JSON** restores such a file here, replacing this device's current experiment and archives; the imported life opens paused. Export before importing if you want to keep both runs. Neither button is needed for normal autosave and reload.

Starting a **New generation** archives the current individual and starts fresh controller and assay state. The journal retains previous records for comparison. They are not inherited by the new fly. Here, “generation” names a new experimental life; genetic evolution and cross-life training are not implemented.

To inspect an earlier assay, open **Experiment journal**, choose an individual in **Viewing**, then expand **Inspect saved memory assay**. This panel appears only when that life has an assay checkpoint. It reconstructs the saved weights in a read-only replay; opening, closing, or inspecting it never changes the saved record. Choosing another life closes the panel, so you can deliberately open the corresponding individual's assay. The same journal inspection is read-only for the current life; use **Research → Memory assay** to continue a living individual's experiment.

The simulation does not advance while the page is hidden. The displayed age measures elapsed simulation time. There is currently no aging rule or hard maximum lifespan: an individual that meets its needs and avoids injury can theoretically continue indefinitely.

## Common interpretation traps

- **A revealed map is not a learned map.** It is an observer record; the fly receives local sensory information.
- **An active channel is not necessarily a neuron.** Brain Activity shows utility-controller telemetry; the atlas separately identifies anatomical cells.
- **Stored weights are not a written diary.** They are the memory assay's numerical state.
- **An atlas is not an executable brain.** Anatomy constrains a model, but dynamics, sensory inputs, plasticity, and motor outputs require their own explicit implementation and validation.
- **Survival is not the only outcome.** Reproducible differences between controlled stimuli and recorded weight changes can be more informative than a long, entertaining run.

See [model provenance](./MALECNS.md) and [experiment design](./EXPERIMENT_DESIGN.md) for the boundary between implemented behavior, source findings, and future experiments.
