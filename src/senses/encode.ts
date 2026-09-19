import { CONFIG } from '../simulation/config';
import { distance, wrapAngle } from '../shared/math';
import type { Fly, SensoryFrame, SensoryTarget, Vec2, World } from '../shared/types';
import { isInRefugeCore, refugeAt } from '../world/refuge';

export function encodeSenses(world: World, fly: Fly, touch: boolean): SensoryFrame {
  const target = (p: Vec2, range: number): SensoryTarget => {
    const d = distance(p, fly);
    return {
      distance: d,
      bearing: wrapAngle(Math.atan2(p.y - fly.y, p.x - fly.x) - fly.heading),
      strength: Math.max(0, 1 - d / range),
    };
  };
  const nearest = <T extends Vec2>(items: T[], range: number): SensoryTarget | null => {
    let best: T | null = null;
    let min = range;
    for (const p of items) {
      const d = distance(fly, p);
      if (d < min) {
        min = d;
        best = p;
      }
    }
    return best ? target(best, range) : null;
  };
  const closeObstacles = world.obstacles.filter(
    (o) =>
      distance(o, fly) < o.radius + 42 &&
      Math.abs(wrapAngle(Math.atan2(o.y - fly.y, o.x - fly.x) - fly.heading)) < 1.25,
  );
  const obstacles: Vec2[] = [...closeObstacles];
  return {
    food: nearest(
      world.resources.filter((r) => r.kind === 'food' && r.amount > 1),
      CONFIG.scentRadius,
    ),
    water: nearest(
      world.resources.filter((r) => r.kind === 'water' && r.amount > 1),
      CONFIG.sightRadius,
    ),
    // The same dense cover that hides the fly also occludes its view of spiders.
    predator: isInRefugeCore(world.regions, fly)
      ? null
      : nearest(world.predators, CONFIG.sightRadius),
    obstacle: nearest(obstacles, 80),
    touch,
    shelter: refugeAt(world.regions, fly) ? 1 : 0,
    internal: { ...fly.vitals },
    heading: fly.heading,
  };
}
