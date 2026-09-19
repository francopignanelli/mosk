# Habitat pressure and health

**Historical balance measurement:** the cohort below records the first hostility adjustment. The later [predator encounter limits](./PREDATOR_ENCOUNTERS.md) and [food lifecycle](./RESOURCE_LIFECYCLE.md) supersede unrestricted pursuit and same-location food renewal. Run the retained benchmark for current-version results; do not treat the old cohort as a forecast for the current app.

This is an engineering balance adjustment to the existing sensory utility habitat. It does not change the published Huang–Luo memory assay, add connectome-derived behavior, or claim that habitat time and health percentages reproduce a biological lifespan.

## Why health stayed at 100%

The previous habitat usually let the fly escape long before a spider made contact: open-ground escape speed was 76 world units/s, compared with a spider pursuit speed of 43. Resources renewed at 0.13 units/s, close to the fly's 0.19 units/s food requirement. A brief bite removed little health, and adequately nourished flies recovered health even while walking or feeding. In eight fixed 20-minute runs, every individual ended at 100% health. Five never sustained injury; the other three experienced only 0.3–0.5 seconds of damage.

## Current rules

| Existing mechanism     | Previous value                                            | Current value                                            | Purpose                                                                                                                  |
| ---------------------- | --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Spider pursuit speed   | 43 world units/s                                          | 67 world units/s                                         | A healthy fly's 76-unit/s escape remains faster, but obstacles, turning and low reserves matter more.                    |
| Contact damage         | 5 health points/s                                         | 18 health points/s                                       | Brief physical contact leaves visible injury. Damage still requires distance under 15 world units outside a refuge core. |
| Food and water renewal | 0.13 units/s                                              | 0.025 units/s                                            | Consumed patches remain depleted for longer; returning repeatedly cannot make one patch an unlimited supply.             |
| Health recovery        | 0.035 points/s with adequate reserves during any activity | The same rate, only while resting with adequate reserves | Injury persists while moving, feeding or fleeing. Recovery is a visible pause.                                           |

Adequate reserves for healing mean hunger below 65, hydration above 30 and energy above 30. Contact and deprivation block healing. Deprivation damage remains 0.8 health points/s when energy reaches zero, hunger reaches 98, or hydration reaches zero. Normal hunger, water, energy and fatigue rates are unchanged. There is no added random damage, aging damage, unavoidable health countdown, or requirement that every life lose health.

A completely emptied 100-unit resource now takes about 66.7 simulation minutes to renew fully, rather than 12.8. Live and dormant resources use the same renewal rate. Water loss is 0.11–0.165 units/s depending on activity, so a single depleted water patch cannot sustain the fly from renewal alone. Food demand likewise exceeds a single patch's renewal.

Refuge cores still exclude spider bodies, break pursuit, and prevent bites crossing the core boundary. Their exposed rims remain dangerous, and cover provides neither food nor water. A healthy fly can still outrun a spider on clear ground. Existing weakness from low energy or health can prevent escape.

These values are deliberately documented as simulation parameters. Evidence supports distinguishing starvation from water stress, but it does not establish these particular rates, spider speeds or percentage-health rules. [Marron, Markow, Kain and Gibbs (2003)](<https://doi.org/10.1016/S0022-1910(02)00287-1>) experimentally compared starvation and desiccation across Drosophila species and found different patterns of energy use. This informs the qualitative separation of food and water constraints; the application is not a reproduction of those experiments.

## Seeded balance check

The sensory utility controller ran at the fixed 1/30-second timestep, from each seed's normal initial conditions, until 20 simulation minutes or death. The same eight seeds were run before and after the change. This is a reproducible regression sample, not an estimate of wild fly survival or a comprehensive balance study.

| Seed      | Previous minimum health | Previous final health | Current minimum health | Current final health | Current outcome      |
| --------- | ----------------------: | --------------------: | ---------------------: | -------------------: | -------------------- |
| MOSK-0042 |                   100.0 |                 100.0 |                   68.1 |                 68.1 | Survived 20 min      |
| orchard   |                   100.0 |                 100.0 |                   96.4 |                 96.4 | Survived 20 min      |
| forest    |                    97.3 |                 100.0 |                   95.8 |                 95.8 | Survived 20 min      |
| 999       |                    98.7 |                 100.0 |                  100.0 |                100.0 | Survived 20 min      |
| field     |                   100.0 |                 100.0 |                  100.0 |                100.0 | Survived 20 min      |
| balance-1 |                    98.7 |                 100.0 |                    0.0 |                  0.0 | Dehydration at 687 s |
| balance-2 |                   100.0 |                 100.0 |                  100.0 |                100.0 | Survived 20 min      |
| balance-3 |                   100.0 |                 100.0 |                   95.2 |                 95.2 | Survived 20 min      |

All eight lives survived the first minute. Five sustained health loss after the adjustment, seven survived to 20 minutes, and three stayed at full health. Different trajectories mean a given seed can become safer even when aggregate pressure increases. Full health remains a valid outcome when supplies and escape are managed successfully. Longer runs and more seeds may reveal further balance issues.

Reproduce the current batch and print detailed measurements:

```powershell
node node_modules/vitest/vitest.mjs run tests/habitat-benchmark.test.ts --configLoader native
```

Focused regression checks in `tests/habitat-pressure.test.ts` verify open-ground escape versus capture with depleted energy, visible contact injury with rest-dependent recovery, and starvation when trying to subsist on a depleted food patch's renewal. Existing refuge, world-streaming and deterministic snapshot-continuation tests remain applicable.

## Existing lives and archives

The changed runtime rules apply to the current live individual without starting a new generation. Its position, explored terrain, resources, predators, vitals and history remain intact. Older archived states and their recorded histories are not recomputed. A saved life resumed under this version continues under the new rules; replaying an old trajectory with the new parameters is not expected to reproduce the former version's behavior. Snapshot continuation remains deterministic within the current version.
