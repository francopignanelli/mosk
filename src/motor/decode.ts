import { CONFIG } from '../simulation/config';
import { distance, wrapAngle } from '../shared/math';
import type { BrainOutput, Fly, World } from '../shared/types';
export function applyMotor(world: World, fly: Fly, output: BrainOutput, dt: number): boolean {
  fly.heading = wrapAngle(fly.heading + output.turn * CONFIG.turnRate * dt);
  const weakened = Math.max(0.4, Math.min(fly.vitals.energy / 25, fly.vitals.health / 30, 1));
  const speed =
    (output.action === 'fleeing' ? CONFIG.fleeSpeed : CONFIG.flySpeed) * output.speed * weakened;
  const next = {
    x: fly.x + Math.cos(fly.heading) * speed * dt,
    y: fly.y + Math.sin(fly.heading) * speed * dt,
  };
  let touch = false;
  for (const obstacle of world.obstacles) {
    const d = distance(obstacle, next);
    const min = obstacle.radius + CONFIG.flyRadius;
    if (d < min) {
      const angle = Math.atan2(next.y - obstacle.y, next.x - obstacle.x);
      next.x = obstacle.x + Math.cos(angle) * min;
      next.y = obstacle.y + Math.sin(angle) * min;
      touch = true;
    }
  }
  fly.distance += distance(fly, next);
  fly.x = next.x;
  fly.y = next.y;
  fly.action = output.action;
  return touch;
}
