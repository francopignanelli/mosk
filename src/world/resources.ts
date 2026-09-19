import { CONFIG } from '../simulation/config';
import { distance, hashSeed, randomFrom } from '../shared/math';
import type { Resource, World } from '../shared/types';

type Geometry = Pick<World, 'obstacles' | 'regions' | 'resources'>;
type Habitat = Pick<World, 'seed' | 'width' | 'height'>;
const periods = new WeakMap<
  Pick<Resource, 'id'>,
  { seed: string; id: Resource['id']; ticks: number }
>();

/** Designed habitat timing in simulation ticks, not measured fruit biology. */
export function foodPeriod(seed: string, resource: Pick<Resource, 'id'>): number {
  const cached = periods.get(resource);
  if (cached?.seed === seed && cached.id === resource.id) return cached.ticks;
  const ticks = (600 + (hashSeed(`${seed}|food-period|${resource.id}`) % 181)) * 30;
  periods.set(resource, { seed, id: resource.id, ticks });
  return ticks;
}

export function foodPhase(resource: Resource, seed: string, tick: number) {
  if (!resource.renewal) return 0;
  const period = foodPeriod(seed, resource);
  return ((tick - resource.renewal.originTick) % period) / period;
}

/** No controller RNG, fly location, camera state, or other dynamic food enters placement. */
function relocate(
  resource: Resource,
  world: Habitat,
  cycle: number,
  geometry: (x: number, y: number) => Geometry,
): boolean {
  const x = Math.floor(resource.x / world.width);
  const y = Math.floor(resource.y / world.height);
  const terrain = geometry(x, y);
  const random = randomFrom({ rngState: hashSeed(`${world.seed}|fruit|${resource.id}|${cycle}`) });
  for (let attempt = 0; attempt < 96; attempt++) {
    const point = {
      x: (x + 0.02 + random() * 0.96) * world.width,
      y: (y + 0.02 + random() * 0.96) * world.height,
    };
    if (
      terrain.obstacles.some((o) => distance(o, point) < o.radius + resource.radius + 15) ||
      terrain.regions.some((r) => r.kind === 'refuge' && distance(r, point) < r.radius + 35) ||
      terrain.resources.some((r) => r.kind === 'water' && distance(r, point) < r.radius + 28)
    )
      continue;
    resource.x = point.x;
    resource.y = point.y;
    return true;
  }
  // An invisible, unavailable slot still needs the same position after long catch-up.
  resource.x = (x + 0.5) * world.width;
  resource.y = (y + 0.5) * world.height;
  return false;
}

/** Bounded catch-up: whole skipped food cycles cost the same as one cycle. */
export function advanceResources(
  resources: Resource[],
  world: Habitat,
  tick: number,
  fromTick: number,
  geometry: (x: number, y: number) => Geometry,
) {
  for (const resource of resources) {
    if (resource.kind === 'water') {
      resource.amount = Math.min(
        resource.capacity,
        resource.amount + Math.max(0, tick - fromTick) * CONFIG.dt * CONFIG.resourceRegrowth,
      );
      continue;
    }
    const period = foodPeriod(world.seed, resource);
    if (!resource.renewal) {
      // Start existing fruit at varied, still-fresh ages without restoring any consumed amount.
      const age = Math.floor(
        (hashSeed(`${world.seed}|fruit-age|${resource.id}`) / 4294967296) * period * 0.45,
      );
      resource.renewal = {
        originTick: fromTick - age,
        cycle: 0,
        updatedTick: fromTick,
        viable: true,
      };
    }
    const renewal = resource.renewal;
    if (tick <= renewal.updatedTick) continue;
    const cycle = Math.floor((tick - renewal.originTick) / period);
    const phase = tick - renewal.originTick - cycle * period;
    const changed = cycle !== renewal.cycle;
    if (changed) {
      renewal.viable = relocate(resource, world, cycle, geometry);
      renewal.cycle = cycle;
      resource.amount = 0;
    }
    if (renewal.viable) {
      // New fruit becomes available gradually over 15 s, rather than appearing full under the fly.
      const previousPhase = changed ? 0 : renewal.updatedTick - renewal.originTick - cycle * period;
      const ripen = (t: number) => Math.max(0, Math.min(1, t / (15 * 30)));
      if (cycle > 0)
        resource.amount = Math.min(
          resource.capacity,
          resource.amount + resource.capacity * (ripen(phase) - ripen(previousPhase)),
        );
      // The last fifth of available life decays to zero; the final 15% remains empty.
      const remaining = Math.max(0, Math.min(1, (0.85 - phase / period) / 0.2));
      resource.amount = Math.min(resource.amount, resource.capacity * remaining);
    } else resource.amount = 0;
    renewal.updatedTick = tick;
  }
}
