export const CONFIG = {
  dt: 1 / 30,
  width: 1200,
  height: 760,
  flyRadius: 5,
  flySpeed: 40,
  fleeSpeed: 76,
  turnRate: 3.8,
  sightRadius: 185,
  scentRadius: 320,
  // Detect just before the utility fly's 130-unit escape threshold.
  predatorSight: 145,
  predatorSpeed: 25,
  predatorActiveRadius: 650,
  // Habitat balance parameters, not measured spider or Drosophila physiology.
  // A healthy fly can still escape on open ground (76), but with less margin.
  predatorChaseSpeed: 67,
  predatorLoseTime: 3,
  // One bounded encounter followed by a shared recovery gap prevents spider relays.
  predatorChaseDuration: 8,
  predatorRecoveryTime: 12,
  historyEvery: 150,
  trailLength: 160,
  hungerRate: 0.19,
  waterRate: 0.11,
  basalEnergy: 0.025,
  movementEnergy: 0.1,
  fatigueRate: 0.08,
  restRecovery: 0.9,
  feedingRate: 9,
  drinkingRate: 12,
  // Renewal must stay well below sustained food/water demand to make patches finite.
  resourceRegrowth: 0.025,
  predatorDamage: 18,
  healthRecovery: 0.035,
  deprivationDamage: 0.8,
  autoSaveMs: 10000,
} as const;
