# Bounded spider encounters

Spiders remain dangerous at close range, but a fly should get an opportunity to
leave an encounter. The habitat now separates a short encounter from a recovery
interval. These settings are gameplay abstractions, not estimates of real spider
vision, endurance, cooperation, or Drosophila physiology. They do not change the
published memory assay or add predator behavior to the MaleCNS model.

## Rules

- Newly generated terrain uses a 510-unit candidate spacing and a 38% acceptance
  threshold, compared with 405 units and 50% previously. Before habitat exclusions,
  that is approximately 52% fewer spiders per unit area. Existing animals remain
  in saved lives.
- Spider detection range is 145 world units, reduced from 155. This remains above
  the utility fly's 130-unit escape threshold so encounters can start. The exposed refuge
  rim still reduces this range to 35%; the dense core breaks sight and blocks bites.
- Only one spider can pursue or search for this fly at a time. The nearest eligible
  spider starts an encounter. Pursuit and searching share an eight-second budget;
  continued visual contact cannot replenish it.
- Losing sight allows up to three seconds of searching within that same budget.
  Reaching cover, exceeding the active radius, losing the pursuer, or exhausting
  the budget ends the encounter.
- Every ended encounter starts a twelve-second recovery interval shared by all
  spiders, including animals in newly streamed terrain. A second spider cannot
  immediately take over the chase.
- During an encounter and its recovery interval, nearby non-pursuers turn away
  from the fly. This creates room to leave instead of merely relabeling spiders
  while the fly keeps seeing them at close range. They retain their ordinary
  roaming speed. The fly continues to perceive their actual positions.
- Contact can still injure the fly during recovery. The interval limits pursuit;
  it does not grant invulnerability. Encounter rules do not prevent dehydration,
  hunger, fatigue, or energy loss.

All timings use simulation seconds and stop when the simulation is paused. Speed
controls affect their wall-clock duration in the same way as other habitat events.

## Continuity

`world.predatorEncounter` stores the pursuer ID and the two remaining budgets.
The optional field is preserved in snapshots, exported JSON, archived lives, and
terrain streaming. Older saves are accepted without it. On the first update, an
existing pursuit gets one bounded budget, after which the same rules apply. A
save/reload or sector revisit cannot restart a chase or bypass its recovery gap.

## Verification

`tests/predator-encounters.test.ts` checks a sustained visible target surrounded by
twelve spiders, newcomer exclusion during recovery, cover and sector transitions,
legacy-save continuation, invalid save rejection, and an actual sensory-utility
fly escaping an eight-spider group. Existing refuge and simulation tests cover
bites, refuge boundaries, searching, deterministic runs, and JSON continuation.
