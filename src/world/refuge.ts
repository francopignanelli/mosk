import { distance } from '../shared/math';
import type { Region, Vec2 } from '../shared/types';

/** A designed dense-cover abstraction, not a measured fly or spider body model. */
export const REFUGE_CORE_RATIO = 0.68;

export function refugeCoreRadius(region: Region): number {
  return region.radius * REFUGE_CORE_RATIO;
}

export function refugeAt(regions: Region[], point: Vec2, coreOnly = false): Region | undefined {
  return regions.find(
    (region) =>
      region.kind === 'refuge' &&
      distance(region, point) <= (coreOnly ? refugeCoreRadius(region) : region.radius),
  );
}

export function isInRefugeCore(regions: Region[], point: Vec2): boolean {
  return !!refugeAt(regions, point, true);
}
