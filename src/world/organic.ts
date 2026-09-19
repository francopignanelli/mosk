import { CONFIG } from '../simulation/config';
import { distance } from '../shared/math';
import type { Region, Vec2, World } from '../shared/types';
import { fieldRandom, landscapeAt } from './landscape';

type Chunk = Pick<World, 'resources' | 'obstacles' | 'regions' | 'predators'>;
const spawn = { x: 600, y: 380 };
const starterFood = { x: 635, y: 410 };
const starterWater = { x: 465, y: 425 };

/** Jittered world-space candidates, unrelated to the 1200×760 storage sectors. */
function candidates(
  seed: string,
  x: number,
  y: number,
  spacing: number,
  margin: number,
  channel: number,
) {
  const points: (Vec2 & { i: number; j: number; chance: number })[] = [];
  for (
    let j = Math.floor((y * CONFIG.height - margin) / spacing);
    j <= Math.floor(((y + 1) * CONFIG.height + margin) / spacing);
    j++
  )
    for (
      let i = Math.floor((x * CONFIG.width - margin) / spacing);
      i <= Math.floor(((x + 1) * CONFIG.width + margin) / spacing);
      i++
    )
      points.push({
        x: (i + 0.04 + fieldRandom(seed, i, j, channel) * 0.92) * spacing,
        y: (j + 0.04 + fieldRandom(seed, i, j, channel + 1) * 0.92) * spacing,
        i,
        j,
        chance: fieldRandom(seed, i, j, channel + 2),
      });
  return points;
}

export function organicChunk(seed: string, x: number, y: number): Chunk {
  const chunk: Chunk = { resources: [], obstacles: [], predators: [], regions: [] };
  const own = (p: Vec2) =>
    Math.floor(p.x / CONFIG.width) === x && Math.floor(p.y / CONFIG.height) === y;
  // Evaluate neighbors too: the same exclusion rules hold on either side of a sector seam.
  const regions: Region[] = candidates(seed, x, y, 535, 400, 10).flatMap((p) => {
    if (p.chance > 0.68 || distance(p, spawn) < 260) return [];
    const field = landscapeAt(seed, p.x, p.y);
    const refuge = fieldRandom(seed, p.i, p.j, 14) < 0.32;
    return [
      {
        x: p.x,
        y: p.y,
        kind: refuge ? 'refuge' : field.growth > 0.52 ? 'grove' : 'meadow',
        radius: refuge ? 90 + fieldRandom(seed, p.i, p.j, 15) * 48 : 135 + field.growth * 140,
      },
    ];
  });
  chunk.regions = regions.filter(own);
  const inCover = (p: Vec2, padding: number) =>
    regions.some((r) => r.kind === 'refuge' && distance(p, r) < r.radius + padding);
  const clearSpawn = (p: Vec2, padding: number) =>
    [spawn, starterFood, starterWater].some((s) => distance(p, s) < padding);
  const obstacles = candidates(seed, x, y, 96, 120, 20).flatMap((p) => {
    const field = landscapeAt(seed, p.x, p.y);
    const density = 0.13 + field.growth * 0.59 - field.clearing * 0.18;
    if (p.chance > density || clearSpawn(p, 105) || inCover(p, 10)) return [];
    const radius = 10 + fieldRandom(seed, p.i, p.j, 24) * 22;
    // A local priority comparison avoids overlapping candidates across chunk boundaries.
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const ni = p.i + dx,
          nj = p.j + dy;
        const neighbor = {
          x: (ni + 0.04 + fieldRandom(seed, ni, nj, 20) * 0.92) * 96,
          y: (nj + 0.04 + fieldRandom(seed, ni, nj, 21) * 0.92) * 96,
        };
        if (fieldRandom(seed, ni, nj, 22) < p.chance && distance(p, neighbor) < radius + 48)
          return [];
      }
    return [
      {
        x: p.x,
        y: p.y,
        radius,
        kind: fieldRandom(seed, p.i, p.j, 25) < 0.78 ? ('plant' as const) : ('rock' as const),
      },
    ];
  });
  chunk.obstacles = obstacles.filter(own);
  for (const p of candidates(seed, x, y, 158, 0, 30)) {
    if (!own(p)) continue;
    const field = landscapeAt(seed, p.x, p.y);
    if (p.chance > 0.27 + field.growth * 0.48 || inCover(p, 48) || clearSpawn(p, 110)) continue;
    const kind = fieldRandom(seed, p.i, p.j, 34) < 0.08 + field.moisture * 0.3 ? 'water' : 'food';
    const radius = kind === 'water' ? 20 + field.moisture * 20 : 11;
    if (obstacles.some((o) => distance(o, p) < o.radius + radius + 13)) continue;
    chunk.resources.push({
      x: p.x,
      y: p.y,
      id: `${x},${y}:resource:${p.i}:${p.j}`,
      kind,
      radius,
      amount: 100,
      capacity: 100,
    });
  }
  if (x === 0 && y === 0) {
    chunk.resources.unshift(
      { ...starterWater, id: 0, kind: 'water', radius: 27, amount: 100, capacity: 100 },
      { ...starterFood, id: 1, kind: 'food', radius: 11, amount: 100, capacity: 100 },
    );
  }
  for (const p of candidates(seed, x, y, 510, 0, 40)) {
    if (
      !own(p) ||
      p.chance > 0.38 ||
      clearSpawn(p, 310) ||
      inCover(p, 25) ||
      obstacles.some((o) => distance(o, p) < o.radius + 18)
    )
      continue;
    chunk.predators.push({
      x: p.x,
      y: p.y,
      id: x === 0 && y === 0 ? chunk.predators.length : `${x},${y}:predator:${p.i}:${p.j}`,
      heading: fieldRandom(seed, p.i, p.j, 44) * Math.PI * 2,
      mode: 'roaming',
      lastSeen: { x: p.x, y: p.y },
      attention: 0,
    });
  }
  return chunk;
}
