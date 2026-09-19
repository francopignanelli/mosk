import { hashSeed, randomFrom } from '../shared/math';
import type { ExperimentState, Vec2 } from '../shared/types';
import { viewBounds } from './camera';
import { visibleTerrain } from './terrain';
import { CONFIG } from '../simulation/config';
import { drawScentField } from './scent';
import { drawFog, drawGround } from './landscape';
import { fieldRandom, landscapeAt } from '../world/landscape';
import { refugeCoreRadius, isInRefugeCore } from '../world/refuge';
export interface ViewOptions {
  scent: boolean;
  trail: boolean;
  zoom: number;
  center: Vec2;
}
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};
function plant(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = '#789a85';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    ctx.rotate(Math.PI * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.43, r * 0.24, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#bacfc0' : '#c8d9c8';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.9);
    ctx.stroke();
  }
  circle(ctx, 0, 0, 3, '#88a28b');
  ctx.restore();
}
function spider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  danger: boolean,
  time: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.strokeStyle = danger ? '#b26d68' : '#817b8a';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++)
    for (const side of [-1, 1]) {
      const wobble = Math.sin(time * 9 + i * 2) * 1.8;
      ctx.beginPath();
      ctx.moveTo(i * 2 - 4, side * 3);
      ctx.lineTo(i * 5 - 9 + wobble, side * 9);
      ctx.lineTo(i * 6 - 12, side * 15);
      ctx.stroke();
    }
  ctx.fillStyle = danger ? '#8e5754' : '#77717e';
  ctx.beginPath();
  ctx.ellipse(-3, 0, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, 5, 0, 4, danger ? '#a66a62' : '#96909f');
  ctx.restore();
}
function drawFly(ctx: CanvasRenderingContext2D, state: ExperimentState) {
  const f = state.fly;
  const t = f.age;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.strokeStyle = '#8c69d266';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, 27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  circle(ctx, 0, 0, 17, '#9971df13');
  ctx.rotate(f.heading);
  const moving = !['feeding', 'resting', 'drinking', 'deceased'].includes(f.action);
  const flutter = moving ? Math.sin(t * 75) * 0.24 : 0;
  ctx.strokeStyle = '#514556';
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1])
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, side * 2);
      ctx.lineTo(i * 6 - 2, side * 8);
      ctx.stroke();
    }
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-5, side * 6, 10, 4.5, side * (0.5 + flutter), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffffdd';
    ctx.fill();
    ctx.strokeStyle = '#a8a0bf';
    ctx.stroke();
  }
  ctx.fillStyle = f.alive ? '#39303f' : '#aaa1ad';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 8, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, 6, 0, 3.4, '#514055');
  circle(ctx, 7, -2, 1.4, '#bf867d');
  circle(ctx, 7, 2, 1.4, '#bf867d');
  ctx.restore();
  const label = f.alive
    ? `${f.name ?? 'MOSK'} / ${String(state.generation).padStart(3, '0')}`
    : `${f.name ?? 'MOSK'} · LIFE CONCLUDED`;
  ctx.font = '500 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#736184';
  ctx.fillText(label, f.x, f.y + 43);
}
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: ExperimentState,
  options: ViewOptions,
) {
  const bounds = viewBounds(width, height, options.zoom, options.center);
  const world = visibleTerrain(state.world, bounds, state.tick);
  const scale = bounds.scale;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f0eff5';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  const center = options.center;
  ctx.translate(-center.x, -center.y);
  ctx.fillStyle = '#f3f1f7';
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  drawGround(ctx, state, bounds);
  for (const region of world.regions) {
    const gradient = ctx.createRadialGradient(
      region.x,
      region.y,
      0,
      region.x,
      region.y,
      region.radius * 1.5,
    );
    gradient.addColorStop(
      0,
      region.kind === 'grove' ? '#dce5d9b0' : region.kind === 'refuge' ? '#e2dbf4b0' : '#e9e4d7b0',
    );
    gradient.addColorStop(1, '#f3f1f700');
    ctx.fillStyle = gradient;
    ctx.fillRect(
      region.x - region.radius * 1.5,
      region.y - region.radius * 1.5,
      region.radius * 3,
      region.radius * 3,
    );
    if (region.kind === 'refuge') {
      const core = refugeCoreRadius(region);
      circle(ctx, region.x, region.y, core, '#abc6aa45');
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#91a78a99';
      ctx.beginPath();
      ctx.arc(region.x, region.y, core, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 13; i++) {
        const angle = (i / 13) * Math.PI * 2;
        plant(
          ctx,
          region.x + Math.cos(angle) * core,
          region.y + Math.sin(angle) * core,
          9 + (i % 4),
          angle,
        );
      }
      ctx.strokeStyle = '#a6ac9460';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(region.x, region.y, region.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (
    let cy = Math.floor(bounds.top / CONFIG.height);
    cy <= Math.floor(bounds.bottom / CONFIG.height);
    cy++
  )
    for (
      let cx = Math.floor(bounds.left / CONFIG.width);
      cx <= Math.floor(bounds.right / CONFIG.width);
      cx++
    ) {
      const key = `${cx},${cy}`;
      if (!state.world.activeChunkKeys.includes(key) && !state.world.sleepingChunks[key]) continue;
      const random = randomFrom({
        rngState: hashSeed(`${state.world.seed}:decorations:${cx},${cy}`),
      });
      for (let i = 0; i < 210; i++) {
        const x = cx * CONFIG.width + random() * CONFIG.width;
        const y = cy * CONFIG.height + random() * CONFIG.height;
        const size = random() * 2;
        const field = landscapeAt(state.world.seed, x, y);
        if (random() > field.growth) continue;
        ctx.strokeStyle = '#9da89542';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x, y - 4 - size);
        ctx.lineTo(x + 1, y + 2);
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + 5, y - 3);
        ctx.stroke();
      }
    }
  if (options.scent) drawScentField(ctx, width, height, world.resources, bounds, center);
  for (const r of world.resources) {
    if (r.kind === 'water') {
      ctx.globalAlpha = 0.35 + 0.65 * (r.amount / r.capacity);
      const phase =
        fieldRandom(state.world.seed, Math.floor(r.x), Math.floor(r.y), 60) * Math.PI * 2;
      for (let ring = 3; ring >= 0; ring--) {
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const ripple = 1 + Math.sin(a * 3 + phase) * 0.12 + Math.cos(a * 5 - phase) * 0.065;
          const px = r.x + Math.cos(a) * (r.radius + ring * 7) * ripple;
          const py = r.y + Math.sin(a) * (r.radius * 0.72 + ring * 5) * ripple;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = ['#a9cbd8', '#bfdae3', '#d5e4ea', '#e3ebef'][ring];
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(
        r.x - 4,
        r.y - 2,
        r.radius * 0.55,
        r.radius * 0.31,
        -0.35,
        Math.PI,
        Math.PI * 1.8,
      );
      ctx.strokeStyle = '#e8f4f8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      if (r.amount <= 0.25) continue;
      ctx.globalAlpha = 0.2 + (r.amount / r.capacity) * 0.8;
      circle(ctx, r.x, r.y, 18, '#ecdbaf45');
      circle(ctx, r.x - 3, r.y + 1, 6.5, '#e4b275');
      circle(ctx, r.x + 4, r.y + 2, 5.5, '#db9e74');
      circle(ctx, r.x + 1, r.y - 4, 5, '#efc481');
      ctx.strokeStyle = '#a49473';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - 6);
      ctx.quadraticCurveTo(r.x + 1, r.y - 13, r.x + 6, r.y - 11);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < world.obstacles.length; i++) {
    const o = world.obstacles[i];
    if (o.kind === 'plant') plant(ctx, o.x, o.y, o.radius, o.x * 0.017 + o.y * 0.009);
    else {
      ctx.beginPath();
      ctx.moveTo(o.x - o.radius, o.y + 3);
      ctx.lineTo(o.x - o.radius * 0.5, o.y - o.radius * 0.6);
      ctx.lineTo(o.x + o.radius * 0.55, o.y - o.radius * 0.7);
      ctx.lineTo(o.x + o.radius, o.y + o.radius * 0.4);
      ctx.lineTo(o.x + o.radius * 0.2, o.y + o.radius * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#c7c5cf';
      ctx.fill();
      ctx.strokeStyle = '#b7b4c0';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x - o.radius * 0.5, o.y - o.radius * 0.6);
      ctx.lineTo(o.x, o.y);
      ctx.lineTo(o.x + o.radius, o.y + o.radius * 0.4);
      ctx.strokeStyle = '#dcd9e2';
      ctx.stroke();
    }
  }
  if (options.trail && state.fly.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(state.fly.trail[0].x, state.fly.trail[0].y);
    for (const p of state.fly.trail) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#8d70c759';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const p of world.predators)
    if (
      Math.hypot(p.x - state.fly.x, p.y - state.fly.y) <= CONFIG.sightRadius &&
      !isInRefugeCore(world.regions, state.fly)
    )
      spider(ctx, p.x, p.y, p.heading, p.mode === 'pursuing', state.fly.age);
  ctx.font = '500 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a29aaa';
  const labels: Vec2[] = [];
  for (const r of world.regions) {
    const labelPosition = { x: r.x, y: r.y + r.radius * 0.73 };
    if (
      labels.some(
        (p) => Math.abs(p.x - labelPosition.x) < 200 && Math.abs(p.y - labelPosition.y) < 32,
      )
    )
      continue;
    labels.push(labelPosition);
    ctx.fillText(
      r.kind === 'grove'
        ? 'THE GROVE'
        : r.kind === 'refuge'
          ? 'DENSE COVER · SAFE CORE'
          : 'OPEN MEADOW',
      labelPosition.x,
      labelPosition.y,
    );
  }
  drawFog(ctx, width, height, state, bounds, center);
  drawFly(ctx, state);
  if (isInRefugeCore(world.regions, state.fly)) {
    ctx.fillStyle = '#647e5b';
    ctx.font = '500 10px monospace';
    ctx.fillText('SHELTERED · NEEDS CONTINUE', state.fly.x, state.fly.y + 58);
  }
  ctx.restore();
}
