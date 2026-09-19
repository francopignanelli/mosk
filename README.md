# MOSK

A digital terrarium for an autonomous virtual fruit fly in an endlessly generated world, with a source-backed research workbench. **The roaming controller is an artificial sensory utility model, not the MaleCNS connectome.** Research & learning adds real MaleCNS anatomical records and a separate published mushroom-body memory assay. The assay does not steer the roaming fly.

## Run

Use Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`).

```sh
npm test
npm run build
npm run preview
```

## Architecture

React + TypeScript + Vite provide the interface. Canvas 2D renders the ecosystem; SVG renders the controller graph and history. Lucide provides interface icons. No backend, API keys, large assets, or authentication are required. Fonts load from Google Fonts with local fallbacks.

```text
world → senses → BrainEngine → motor → fly
  ↕                                  ↕
predators ← simulation (fixed 30 Hz) → metrics
                  ↓
         versioned persistence
                  ↓
         Canvas + React UI + SVG
```

Domain code has no React dependencies. `shared/types.ts` defines explicit contracts. `simulation/config.ts` contains tunable physical and metabolic parameters. The simulation uses fixed timesteps and one serialized seeded PRNG; rendering has a separate deterministic source of decoration. Changing playback speed runs more steps, not larger steps. The UI updates at 10 Hz and Canvas uses requestAnimationFrame. At this small population size, a worker or spatial index would add overhead without an established benefit.

- `world`: deterministic sector generation, local streaming, dormant state, resources, regions, refuge and obstacles.
- `senses`: local bearings, distances, scent, touch, refuge and internal state. The brain cannot inspect the full world.
- `brain`: replaceable `BrainEngine`, utility controller, random baseline, actual signal telemetry.
- `motor`, `fly`, `predators`: movement/collision, homeostasis, and roam/pursue/search behavior.
- `simulation`: stepping, lifecycle, event recording, periodic metrics and archive construction.
- `rendering`, `ui`: world renderer, observatory, brain activity, journal and experiment controls.
- `persistence`: storage interface, IndexedDB implementation, schema validation and JSON import/export.
- `research`, `public/learning-lab`: validated per-life checkpoints and a standalone GPLv3+ adaptation of the published Huang–Luo circuit. The host and assay communicate through a checked same-origin message protocol; readable assay source is distributed with the application.
- `public/data`, `scripts/prepare-malecns-atlas.py`: a reproducible sample of official MaleCNS annotations with exact body IDs, source checksum, selection criteria, counts and attribution.

## Names and research

Choose a name for a new generation or use **Name this fly** beside the vital signs. Names accept 1–32 Unicode characters and stay with each archived individual. Renaming changes no random state or behavior; existing unnamed lives default to MOSK.

The new-generation dialog always defaults to **Sensory utility model**. Random baseline remains an explicit comparison option; saved lives keep their existing controller when restored.

**Research & learning → Memory assay** runs the fitted model from Huang, Luo et al., Nature (2024). It uses the authors' source, parameters and original conditioning, retention, extinction and feedback-removal protocols. The numerical log exposes odor-specific plastic weight changes, adaptation and six circuit response readouts after each completed bout. Saved model-version-pinned checkpoints reconstruct the same state after reload. A new generation starts without an assay checkpoint; archives retain the previous one. Concluded lives and secondary read-only observers cannot train it.

This is a distinct scientific program associated with the current life. Its biological seconds and stimulus bouts differ from habitat ticks. Its weights do not change the utility controller. Reversal, sensory-conflict experiments, navigation learning and a validated motor bridge remain future research work. No narrative or inferred location memory is substituted for model state.

**Research & learning → MaleCNS atlas** contains 96 actual annotation records in eight groups, with source IDs and labels. The source table's 211,577 rows include glia, orphans and other categories; that is not a modeled neuron count. The sample is deterministic, not a complete or representative circuit. No connections or activity are invented. The full 1.1 GB connection graph is not bundled.

**Research & learning → How to observe** is the in-app tutorial. See [TUTORIAL.md](docs/TUTORIAL.md), [official assets](docs/OFFICIAL_ASSETS.md), and [assay source and license](public/learning-lab/README.md). The deployed assay includes readable implementation, original reference material, fitted parameters and GPLv3+ license.

## An endless world

The world expands in all directions without a designed edge or wraparound. Smooth, warped world-space fields shape vegetation, moisture and clearings. Jittered candidates create uneven clusters, irregular ponds and varying numbers of resources, cover patches and predators. The 1,200 × 760-unit sectors are storage units, not repeating layouts: vegetation and landscape fields continue across their boundaries without empty border strips. Generation never advances the animal's random generator. Upgraded experiments retain terrain already generated under the old rules; new territory uses the organic generator.

Only a 3 × 3 neighborhood around the fly is generated and active, including a hidden buffer for senses and movement. Faraway static terrain already visited can be recreated from its seed; depleted resources and predator positions are saved when sectors unload. Food cycles and pond refill catch up when revisited, while dormant predators remain frozen. Within the loaded neighborhood, predators farther than 650 units from the fly are inactive. This is a local simulation, not a continuously simulated infinite population.

The camera follows the fly at every zoom level. Drag the map or focus it and use arrow keys to pan; press **F** or the crosshair to return to the fly. Soft exploration fog opens around the animal and remembers visited places across reloads. Panning never generates or reveals new territory. Spiders are drawn only within the fly's current sight range, so old explored terrain does not reveal distant predator activity. A sector counts as explored when the fly enters it, and first visits appear in the journal. Discovery is an observer record, not a cognitive map available to the controller. Old saves reconstruct initial fog coverage from the current position and retained trail; older travel was not recorded precisely enough to reconstruct full historical visibility.

Scroll the mouse wheel over the map to zoom between 50% and 250%; the existing buttons remain available. Zoom stays centered in follow mode and anchored beneath the pointer in free-camera mode. A compact six-value vitals strip stays inside the map, including fullscreen, while the detailed explanations remain in their original card below.

Active geometry and the renderer's terrain cache are bounded. Saved sector changes, exploration records and history grow with actual travel. “Infinite” means procedurally unbounded, subject to normal floating-point precision, memory and browser storage limits; imports cap coordinate magnitude at 10¹² and files at 50 MB.

## Behavior and scientific limits

The utility controller uses explicit rules with hysteresis: escape danger, seek water, seek food, recover, or explore. Energy, hunger, hydration, fatigue, arousal and health create internal pressure. Resources regenerate; plants/rocks block motion. A refuge's leafy inner 68% of its radius blocks spider bodies, visual detection, pursuit and bites. The outer rim reduces detection but remains risky. Hunger and thirst continue in shelter; new refuges exclude resources. This represents size-selective dense cover, a gameplay abstraction rather than calibrated biology. Food consumed is expressed as normalized portions, distance in world units, and time in simulated seconds. These values are **not calibrated biological measurements**. Aging is not implemented and currently imposes no lifespan limit.

The brain panel displays 18 real controller values: sensory signals, derived motivations and motor outputs. Hover, focus or tap any node for a live percentage, its meaning, input source and illustrated influences. Pin a card to keep watching; arrow keys navigate nodes and Escape dismisses it. Channel intensities are smoothed for readability. Edges show designed functional relationships; the graph is not neuronal anatomy or an executable weighted neural network. Satellite marks repeat their parent channel value and are visual glyphs, not extra simulated neurons. The random baseline uses seeded random turns with local feeding/drinking reflexes. Neither mode learns.

The atlas uses real anatomical annotations, and the separate assay implements published computational plasticity. Neither is a whole-brain MaleCNS simulation, live recorded neural activity or evidence of consciousness. Habitat physiology and refuge mechanics remain designed abstractions. See [MaleCNS integration](docs/MALECNS.md) and [experiment design](docs/EXPERIMENT_DESIGN.md) for provenance and remaining scientific questions.

Inside the little mind continues to show the roaming controller's 18 signals and now links to the distinct research readouts. The scent overlay is composited once at at most 14% opacity, so overlapping patches stay subtle. Its softness changes the display only.

Food can be consumed or decay and disappear, then fresh fruit ripens at a new seeded location. Ponds stay in place and refill slowly. [Resource lifecycle](docs/RESOURCE_LIFECYCLE.md) describes the bounded schedules, dormant catch-up and save compatibility. Newly generated terrain has fewer spiders and shorter detection range; pursuit/search is limited to one spider and eight seconds, followed by a shared twelve-second recovery interval. [Predator encounters](docs/PREDATOR_ENCOUNTERS.md) documents the rules and tests preventing chase relays. Contact injury remains consequential, and healing requires well-supplied rest without bites. These runtime rules apply to continuing lives without resetting their terrain or archives; reduced population density applies to newly generated terrain.

## Persistence and continuity

Names and optional assay checkpoints are validated in schema 3 alongside all previous state. Checkpoints pin the original model and protocol; deterministic replay recovers the complete published assay state and per-bout history. This is separate from the fly's local controller state and the observer's exploration record.

IndexedDB stores atomic, versioned experiment snapshots every 10 wall-clock seconds and when the document becomes hidden. A synchronous localStorage checkpoint on page hide provides a final recovery opportunity; the newest valid save is restored. Storage errors are visible. Browsers supporting Web Locks allow only one active writer per origin, avoiding conflicting tabs.

Schema 3 snapshots include active terrain, dormant sector changes, explored sectors, fog discovery points, generator compatibility metadata, random generator state, controller state, fly state, predator state, generation, trail, all sampled historical metrics, and recorded events. Schema 1 and 2 experiments are validated and automatically migrated, including archived generations; storage keys remain compatible. Existing flies, resource depletion, metrics and events are preserved. Metrics sample every 5 simulated seconds; traces are downsampled only for rendering. New generations preserve the previous state and its recorded history, but reset the controller and discovery map. Death freezes the current life; the observer explicitly begins its successor. There is no offline progression or hidden-tab catch-up.

Export downloads a JSON snapshot. Import validates the version, types, finiteness, ranges and entity limits before writing; an explicit preview explains replacement of the local experiment. A failed storage commit leaves the current state intact. Imported runs start paused. Files are limited to 50 MB. Browser storage is device- and origin-local, not cloud backup; clearing it removes experiments. Export important records. The growing archive is intentionally not silently pruned; a future release should move individual histories to separate IndexedDB records for long-running studies.

## Netlify

The included `netlify.toml` sets Node 22, build command `npm run build`, publish directory `dist`, hashed-asset caching, and SPA fallback. Connect this folder's Git repository to Netlify, or build locally and upload `dist` through Netlify's manual deployment interface. No server-side runtime is needed. See [Netlify's Vite documentation](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/).

The repository is prepared for Netlify; a deployment requires your Netlify account/site. No deployment credentials are embedded and no live deployment is implied.

## Verification

`npm test` covers deterministic generation and stepping, sector transitions and revisits, negative coordinates, local perception, camera independence, exact JSON continuation, legacy save migration, feeding/drinking/rest/escape decisions, spider behavior, death and archive continuity, ten-minute runs across multiple seeds, IndexedDB restoration, invalid imports, atomic import queues, storage failures, checkpoint recovery, and export construction. `npm run build` type-checks all application and test code before producing the static app. `npm run format` formats the maintained source.

The observatory, pause/view controls, generation changes, archived charts, and reload restoration were also checked in a browser, along with desktop and 390px mobile layouts. Naming, same-life assay restoration, atlas search and archived read-only assay inspection were checked through the interface. The embedded browser accepted the import fixture but its file/download automation was unreliable; import commit, rollback, and export-link behavior were verified in the DOM session tests.

`npm run verify:memory` compares the published circuit translation against an independent Python translation: 14 protocol/odor combinations, 470 bout checkpoints and 6,580 numerical values, plus every intermediate deterministic replay checkpoint. MATLAB was not executed; this cross-check is numerical agreement between translations, not a new biological replication. Application checks include checkpoint validation, life isolation, read-only message boundaries, bounded predator encounters, rest-dependent healing, food succession, wheel zoom and an eight-seed habitat balance check.

## Next steps

1. Import a version-pinned MaleCNS subgraph offline with provenance and license metadata.
2. Adapt and validate an existing integrate-and-fire implementation behind `BrainEngine` in a worker or service.
3. Keep anatomical data separate from assumed neuron parameters and sensory/motor mappings.
4. Compare responses, lesion experiments and survival against the utility and random baselines before making biological claims.
