import { CONFIG } from '../simulation/config';
import { clamp, distance, wrapAngle } from '../shared/math';
import type { Fly, Predator, Region, World } from '../shared/types';
import { isInRefugeCore, refugeAt, refugeCoreRadius } from '../world/refuge';

const SPIDER_RADIUS = 7;

function keepOutsideCover(predator: Predator, refuges: Region[]) {
  const occupied = refuges.find(
    (refuge) => distance(predator, refuge) < refugeCoreRadius(refuge) + SPIDER_RADIUS,
  );
  if (!occupied) return;
  const outward =
    distance(predator, occupied) > 0.000001
      ? Math.atan2(predator.y - occupied.y, predator.x - occupied.x)
      : predator.heading;
  const radius = refugeCoreRadius(occupied) + SPIDER_RADIUS + 0.01;
  const candidate = {
    x: occupied.x + Math.cos(outward) * radius,
    y: occupied.y + Math.sin(outward) * radius,
  };
  if (
    refuges.every(
      (refuge) => distance(candidate, refuge) >= refugeCoreRadius(refuge) + SPIDER_RADIUS,
    )
  ) {
    Object.assign(predator, candidate, { heading: outward });
    return;
  }
  // In overlapping cover, alternating radial pushes can oscillate forever.
  // Find a short exit from the connected union of circles along sampled rays.
  let best = { distance: Infinity, angle: outward };
  for (let ray = 0; ray < 16; ray++) {
    const angle = outward + (ray * Math.PI) / 8;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const intervals = refuges
      .flatMap((refuge) => {
        const rx = refuge.x - predator.x;
        const ry = refuge.y - predator.y;
        const projection = rx * dx + ry * dy;
        const r = refugeCoreRadius(refuge) + SPIDER_RADIUS + 0.01;
        const discriminant = r * r - (rx * rx + ry * ry - projection * projection);
        if (discriminant < 0) return [];
        const halfChord = Math.sqrt(discriminant);
        return [{ enter: projection - halfChord, exit: projection + halfChord }];
      })
      .filter((interval) => interval.exit >= 0)
      .sort((a, b) => a.enter - b.enter);
    let exit = 0;
    for (const interval of intervals) {
      if (interval.enter > exit) break;
      exit = Math.max(exit, interval.exit);
    }
    if (exit < best.distance) best = { distance: exit, angle };
  }
  predator.x += Math.cos(best.angle) * (best.distance + 0.001);
  predator.y += Math.sin(best.angle) * (best.distance + 0.001);
  predator.heading = best.angle;
}

export function updatePredators(world: World, fly: Fly, dt: number, random: () => number) {
  const hidden = isInRefugeCore(world.regions, fly);
  const sheltered = !!refugeAt(world.regions, fly);
  const refuges = world.regions.filter((region) => region.kind === 'refuge');
  const legacy = !world.predatorEncounter;
  const encounter = (world.predatorEncounter ??= {
    pursuerId: null,
    chaseRemaining: 0,
    cooldownRemaining: 0,
  });
  const endEncounter = () => {
    encounter.pursuerId = null;
    encounter.chaseRemaining = 0;
    encounter.cooldownRemaining = CONFIG.predatorRecoveryTime;
  };
  encounter.cooldownRemaining = Math.max(0, encounter.cooldownRemaining - dt);
  let pursuer = world.predators.find((p) => p.id === encounter.pursuerId);
  if (
    encounter.pursuerId !== null &&
    (!pursuer || hidden || !fly.alive || distance(pursuer, fly) > CONFIG.predatorActiveRadius)
  ) {
    endEncounter();
    pursuer = undefined;
  }
  if (encounter.pursuerId === null && encounter.cooldownRemaining === 0 && !hidden && fly.alive) {
    // One nearest spider owns the whole encounter, including searches. An older
    // saved pursuit receives one finite budget rather than being reset each tick.
    const candidates = world.predators.filter((p) => {
      const d = distance(p, fly);
      return (
        d < CONFIG.predatorSight * (sheltered ? 0.35 : 1) ||
        (legacy && p.mode !== 'roaming' && p.attention > 0 && d <= CONFIG.predatorActiveRadius)
      );
    });
    candidates.sort((a, b) => distance(a, fly) - distance(b, fly));
    pursuer = candidates[0];
    if (pursuer) {
      encounter.pursuerId = pursuer.id;
      encounter.chaseRemaining = CONFIG.predatorChaseDuration;
    }
  }
  if (pursuer) {
    encounter.chaseRemaining = Math.max(0, encounter.chaseRemaining - dt);
    if (encounter.chaseRemaining === 0) {
      endEncounter();
      pursuer = undefined;
    }
  }
  for (const p of world.predators) {
    // Also repair old saved positions or newly streamed predators inside dense cover.
    keepOutsideCover(p, refuges);
    const d = distance(p, fly);
    // Distant animals sleep. This keeps simulation work local without world-edge walls.
    if (p !== pursuer) {
      p.attention = 0;
      p.mode = 'roaming';
    }
    if (d > CONFIG.predatorActiveRadius) continue;
    if (p === pursuer && d < CONFIG.predatorSight * (sheltered ? 0.35 : 1)) {
      p.mode = 'pursuing';
      p.lastSeen = { x: fly.x, y: fly.y };
      p.attention = CONFIG.predatorLoseTime;
    } else if (p === pursuer && p.attention > 0) {
      p.attention = Math.max(0, p.attention - dt);
      p.mode = 'searching';
    } else if (p === pursuer) {
      endEncounter();
      pursuer = undefined;
      p.mode = 'roaming';
    }
    let desired = p.heading;
    if (p.mode !== 'roaming') desired = Math.atan2(p.lastSeen.y - p.y, p.lastSeen.x - p.x);
    else if (
      fly.alive &&
      d < CONFIG.sightRadius + 40 &&
      (encounter.pursuerId !== null || encounter.cooldownRemaining > 0)
    )
      // Releasing a chase should open physical space, not leave idle spiders
      // surrounding the fly and continuously driving its visual escape signal.
      desired = Math.atan2(p.y - fly.y, p.x - fly.x);
    else desired += (random() - 0.5) * 1.1;
    p.heading = wrapAngle(p.heading + clamp(wrapAngle(desired - p.heading), -2 * dt, 2 * dt));
    const speed = p.mode === 'pursuing' ? CONFIG.predatorChaseSpeed : CONFIG.predatorSpeed;
    p.x += Math.cos(p.heading) * speed * dt;
    p.y += Math.sin(p.heading) * speed * dt;
    for (const o of world.obstacles)
      if (distance(o, p) < o.radius + SPIDER_RADIUS) {
        const a = Math.atan2(p.y - o.y, p.x - o.x);
        p.x = o.x + Math.cos(a) * (o.radius + SPIDER_RADIUS);
        p.y = o.y + Math.sin(a) * (o.radius + SPIDER_RADIUS);
        p.heading = a;
      }
    keepOutsideCover(p, refuges);
  }
}
