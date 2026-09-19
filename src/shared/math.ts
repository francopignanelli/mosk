import type { Vec2 } from './types';
export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export function hashSeed(seed: string) {
  let h = 2166136261;
  for (const c of seed) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}
export function randomFrom(state: { rngState: number }) {
  return () => {
    let x = state.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state.rngState = x >>> 0;
    return state.rngState / 4294967296;
  };
}
export function formatTime(seconds: number) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
