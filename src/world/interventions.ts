import { distance } from '../shared/math';
import { predatorDetectionRange } from '../predators/update';
import { CONFIG } from '../simulation/config';
import type { ExperimentState, Predator, Resource, Vec2, World } from '../shared/types';
import { chunkKeyAt } from './generate';
import { isRevealed } from './discovery';
import { isInRefugeCore, refugeCoreRadius } from './refuge';

export type InterventionKind = 'food' | 'water' | 'spider';
export type InterventionResult = { ok: true; message: string } | { ok: false; reason: string };

const SPIDER_RADIUS = 7;
const MAX_COORDINATE = 1e12; // Keep observer edits inside the save format's precision limit.
const MAX_INTERVENTIONS_PER_LIFE = 2000;
const MAX_OBSERVER_RESOURCES_PER_SECTOR = 24;
const MAX_OBSERVER_SPIDERS_PER_SECTOR = 8;
const MAX_OBSERVER_SPIDERS_PER_LIFE = 120;

function existingIds(world: World, kind: InterventionKind): Set<string | number> {
  const ids = new Set<string | number>();
  const add = (entries: { id: string | number }[]) => entries.forEach((entry) => ids.add(entry.id));
  if (kind === 'spider') {
    add(world.predators);
    Object.values(world.sleepingChunks).forEach((chunk) => add(chunk.predators));
  } else {
    add(world.resources);
    Object.values(world.sleepingChunks).forEach((chunk) => add(chunk.resources));
  }
  return ids;
}

function observerId(state: ExperimentState, kind: InterventionKind): string {
  const ids = existingIds(state.world, kind);
  const base = `observer:${kind}:${state.tick}:${state.events.length}`;
  let id = base;
  for (let suffix = 1; ids.has(id); suffix++) id = `${base}:${suffix}`;
  return id;
}

/**
 * Observer interventions change this life and its saved world only. They do not
 * consume the controller RNG or claim to model synaptic learning in the fly.
 */
export function placeIntervention(
  state: ExperimentState,
  kind: InterventionKind,
  point: Vec2,
): InterventionResult {
  if (!state.fly.alive)
    return { ok: false, reason: 'Start a new life before editing the habitat.' };
  if (kind !== 'food' && kind !== 'water' && kind !== 'spider')
    return { ok: false, reason: 'Choose food, water, or a spider.' };
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    Math.abs(point.x) > MAX_COORDINATE ||
    Math.abs(point.y) > MAX_COORDINATE
  )
    return { ok: false, reason: 'Choose a valid position on the map.' };
  const world = state.world;
  const sector = chunkKeyAt(world, point);
  if (!world.activeChunkKeys.includes(sector) || !isRevealed(world, point))
    return { ok: false, reason: 'Explore this area before editing it.' };
  if (
    state.events.filter((event) => event.kind === 'intervention').length >=
    MAX_INTERVENTIONS_PER_LIFE
  )
    return { ok: false, reason: 'This life has reached its habitat edit limit.' };

  const radius = kind === 'food' ? 11 : kind === 'water' ? 27 : SPIDER_RADIUS;
  const inRefuge = world.regions.some(
    (region) =>
      region.kind === 'refuge' &&
      distance(region, point) <
        (kind === 'spider' ? refugeCoreRadius(region) : region.radius) + radius,
  );
  if (inRefuge) return { ok: false, reason: 'Refuges cannot be edited here.' };
  if (world.obstacles.some((obstacle) => distance(obstacle, point) < obstacle.radius + radius + 8))
    return { ok: false, reason: 'Move the brush away from the obstacle.' };
  if (world.resources.some((resource) => distance(resource, point) < resource.radius + radius + 8))
    return { ok: false, reason: 'Move the brush away from the existing resource.' };
  if (world.predators.some((predator) => distance(predator, point) < SPIDER_RADIUS + radius + 12))
    return { ok: false, reason: 'Move the brush away from the spider.' };
  if (kind === 'spider' && distance(state.fly, point) < 50)
    return { ok: false, reason: 'Place the spider farther from the fly.' };

  let response = '';
  if (kind === 'spider') {
    const observerSpiders = [
      ...world.predators,
      ...Object.values(world.sleepingChunks).flatMap((chunk) => chunk.predators),
    ].filter(
      (predator) => typeof predator.id === 'string' && predator.id.startsWith('observer:spider:'),
    );
    if (observerSpiders.length >= MAX_OBSERVER_SPIDERS_PER_LIFE)
      return { ok: false, reason: 'This life has reached its spider edit limit.' };
    if (
      world.predators.filter(
        (predator) =>
          typeof predator.id === 'string' &&
          predator.id.startsWith('observer:spider:') &&
          chunkKeyAt(world, predator) === sector,
      ).length >= MAX_OBSERVER_SPIDERS_PER_SECTOR
    )
      return { ok: false, reason: 'This sector has reached its spider edit limit.' };
    const spider: Predator = {
      id: observerId(state, kind),
      x: point.x,
      y: point.y,
      heading: Math.atan2(state.fly.y - point.y, state.fly.x - point.x),
      mode: 'roaming',
      lastSeen: { x: point.x, y: point.y },
      attention: 0,
    };
    world.predators.push(spider);
    const detectionRange = predatorDetectionRange(world, state.fly);
    if (isInRefugeCore(world.regions, state.fly)) {
      response = 'Dense cover hides the fly; this spider roams until it emerges.';
    } else if (distance(spider, state.fly) >= detectionRange) {
      response = `Outside spider detection range (${Math.round(detectionRange)} units here); it roams until the fly comes closer.`;
    } else if (world.predatorEncounter?.pursuerId != null) {
      response = 'Another spider owns the current chase; this one roams for now.';
    } else {
      // An observer deliberately introducing a visible predator starts a new
      // controlled encounter, even during the automatic recovery interval.
      // The same finite chase budget and update loop apply thereafter.
      spider.mode = 'pursuing';
      spider.lastSeen = { x: state.fly.x, y: state.fly.y };
      spider.attention = CONFIG.predatorLoseTime;
      world.predatorEncounter = {
        pursuerId: spider.id,
        chaseRemaining: CONFIG.predatorChaseDuration,
        cooldownRemaining: 0,
      };
      response = 'It detected the fly and will pursue when the simulation runs.';
    }
    if (state.brain.mode === 'random')
      response += ' Random baseline does not trigger an escape response.';
  } else {
    if (
      world.resources.filter(
        (resource) =>
          typeof resource.id === 'string' &&
          resource.id.startsWith('observer:') &&
          chunkKeyAt(world, resource) === sector,
      ).length >= MAX_OBSERVER_RESOURCES_PER_SECTOR ||
      world.resources.length >= 2250
    )
      return { ok: false, reason: 'This sector has reached its resource edit limit.' };
    const resource: Resource = {
      id: observerId(state, kind),
      x: point.x,
      y: point.y,
      kind,
      radius,
      amount: 100,
      capacity: 100,
    };
    if (kind === 'food')
      resource.renewal = {
        originTick: state.tick,
        cycle: 0,
        updatedTick: state.tick,
        viable: true,
      };
    world.resources.push(resource);
  }
  const message = `Observer placed ${kind === 'spider' ? 'a spider' : kind} at (${Math.round(point.x)}, ${Math.round(point.y)}).${response ? ` ${response}` : ''}`;
  state.events.push({ id: state.tick, time: state.fly.age, kind: 'intervention', message });
  return { ok: true, message };
}
