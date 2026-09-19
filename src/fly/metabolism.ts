import { CONFIG } from '../simulation/config';
import { clamp, distance } from '../shared/math';
import type { BrainOutput, Fly, World } from '../shared/types';
import { isInRefugeCore } from '../world/refuge';
export function metabolize(
  world: World,
  fly: Fly,
  output: BrainOutput,
  dt: number,
): { ate: boolean; cause: string | null } {
  const v = fly.vitals;
  let ate = false;
  v.hunger += CONFIG.hungerRate * dt;
  v.hydration -= (CONFIG.waterRate + output.speed * 0.055) * dt;
  v.energy -= (CONFIG.basalEnergy + CONFIG.movementEnergy * output.speed) * dt;
  v.fatigue += (output.speed > 0 ? CONFIG.fatigueRate * output.speed : -CONFIG.restRecovery) * dt;
  if (output.action === 'resting' && v.hunger < 75 && v.hydration > 20) v.energy += 0.17 * dt;
  if (output.feed || output.drink) {
    const resource = world.resources.find(
      (r) =>
        r.kind === (output.feed ? 'food' : 'water') &&
        r.amount > 0 &&
        distance(fly, r) < (output.feed ? 21 : 42),
    );
    if (resource) {
      const consumed = Math.min(
        resource.amount,
        (output.feed ? CONFIG.feedingRate : CONFIG.drinkingRate) * dt,
      );
      resource.amount -= consumed;
      if (output.feed) {
        v.hunger -= consumed;
        v.energy += consumed * 0.85;
        fly.foodEaten += consumed / 35;
        ate = true;
      } else v.hydration += consumed;
    }
  }
  // Cover blocks a bite even at its edge, where the attack radius reaches inside.
  const predator = !isInRefugeCore(world.regions, fly)
    ? world.predators.find((p) => distance(fly, p) < 15)
    : undefined;
  if (predator) v.health -= CONFIG.predatorDamage * dt;
  if (v.energy <= 0 || v.hunger >= 98 || v.hydration <= 0)
    v.health -= CONFIG.deprivationDamage * dt;
  // Recovery is an observable pause with adequate reserves, not a hidden bonus
  // that erases brief bites while the fly is still running through the habitat.
  else if (
    !predator &&
    output.action === 'resting' &&
    v.hunger < 65 &&
    v.hydration > 30 &&
    v.energy > 30
  )
    v.health += CONFIG.healthRecovery * dt;
  for (const key of Object.keys(v) as (keyof typeof v)[]) v[key] = clamp(v[key]);
  const cause =
    v.health <= 0
      ? predator
        ? 'Predation'
        : v.hydration <= 0
          ? 'Dehydration'
          : 'Energy depletion'
      : null;
  return { ate, cause };
}
