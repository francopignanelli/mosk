import { hashSeed } from '../shared/math';

const seeds = new Map<string, number>();
function seedNumber(seed: string) {
  let value = seeds.get(seed);
  if (value === undefined) {
    value = hashSeed(seed);
    if (seeds.size >= 32) seeds.delete(seeds.keys().next().value!);
    seeds.set(seed, value);
  }
  return value;
}

/** Coordinate hashing: independent of visit order and of the animal's random stream. */
export function fieldRandom(seed: string, x: number, y: number, channel = 0): number {
  let h =
    seedNumber(seed) ^
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(channel, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const ease = (v: number) => v * v * v * (v * (v * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function smoothNoise(seed: string, x: number, y: number, channel = 0): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = ease(x - ix),
    fy = ease(y - iy);
  return mix(
    mix(fieldRandom(seed, ix, iy, channel), fieldRandom(seed, ix + 1, iy, channel), fx),
    mix(fieldRandom(seed, ix, iy + 1, channel), fieldRandom(seed, ix + 1, iy + 1, channel), fx),
    fy,
  );
}

/** Smooth, warped fields shared by decoration and ecology, across all storage boundaries. */
export function landscapeAt(seed: string, x: number, y: number) {
  const wx = x + (smoothNoise(seed, x / 1250, y / 1250, 2) - 0.5) * 640;
  const wy = y + (smoothNoise(seed, x / 1250, y / 1250, 3) - 0.5) * 640;
  const moisture =
    smoothNoise(seed, wx / 740, wy / 740, 4) * 0.64 +
    smoothNoise(seed, wx / 270, wy / 270, 5) * 0.36;
  const growth =
    smoothNoise(seed, wx / 510, wy / 510, 6) * 0.7 + smoothNoise(seed, wx / 145, wy / 145, 7) * 0.3;
  const clearing = smoothNoise(seed, wx / 360, wy / 360, 8);
  return { moisture, growth, clearing };
}
