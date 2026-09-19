# A changing food supply

Food now has a lifecycle instead of endlessly refilling at one location. Water remains tied to existing ponds and refills slowly. Rocks, plants and refuge geometry remain stable. These are explicit habitat design rules, not processes supplied by MaleCNS or the published memory assay.

Each generated food slot has a deterministic 10–13 minute cycle in simulation time. Its initial fruit starts at a varied fresh age, preserving all previously consumed amounts. The first 65% of the cycle is fresh; during the next 20%, the maximum remaining edible amount falls to zero. The final 15% is empty. Eating can exhaust fruit earlier; it does not refill during that cycle. Exhausted fruit is invisible and has no food scent.

The next cycle places fresh fruit at a new seeded position within the same sector. It ripens from zero over 15 seconds, so it does not instantly appear as a full meal. Placement avoids rocks/plants, ponds and refuge regions, including geometry across sector boundaries. If no valid placement is found in 96 bounded attempts, that cycle remains empty. The next cycle can try again. Position selection uses a separate seeded stream and does not inspect the fly, camera or current controller RNG.

This makes repeated visits to one food coordinate less reliable while maintaining a bounded number of resource slots. A slot ID persists for storage; its cycle number identifies successive fruit. The fly still responds to local sensory cues and internal needs; these changing resources do not add learned map memory or navigation planning.

Water retains the existing 0.025-unit/s replenishment rate. Its rendered opacity tracks remaining water, while its location stays fixed. Fruit fades as its edible amount falls and disappears when exhausted. The compact map vitals show the same six values as the detailed card.

## Persistence and exploration

Optional `Resource.renewal` metadata stores the schedule origin, current cycle, last updated tick and placement availability. Older saves initialize it on their next resource update without moving existing food or restoring depleted amounts. No world reset is required. Archives retain the recorded state.

Dormant sectors advance their food schedule and water supply when revisited. Catch-up jumps directly to the final cycle; it does not simulate every missed cycle or expand the infinite world. Camera previews use copies of saved resources and the same schedule, so looking at old terrain neither changes its stored resources nor reveals new places. Static placement geometry uses a bounded derived cache. Counters are validated on import.

Schedules, positions and availability agree between active and dormant updates; incremental ripening amounts can differ by floating-point roundoff. Save/resume followed by the same simulation steps remains deterministic. Tests compare analytic catch-up amounts with numerical tolerance and check exact normal save continuation.

## Verification

`tests/resource-lifecycle.test.ts` checks consumed-food preservation, water refill, expiry, gradual replacement, placement exclusions, bounded long catch-up, dormant preview/revisit agreement, legacy saves, malformed state and deterministic continuation. Existing streaming tests verify negative coordinates, unique IDs and bounded active geometry.

Only simulation time advances these rules. Pausing, hidden-tab suspension and closing the app do not age resources offline.
