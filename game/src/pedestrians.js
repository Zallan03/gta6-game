// Port Verano — pedestrians. They stroll the sidewalks, cross at corners,
// scatter when a gun goes off or a car bears down on them, and a few wave
// for a taxi. Each one is a small person with a shirt, a pace and a mood.

import { WORLD } from './config.js';
import { resolveBuildingCollision, randomRoadPoint, onRoad } from './city.js';
import { clamp } from './rng.js';

const SHIRTS = ['#d94f3d', '#3d7dd9', '#e8b23a', '#57a04c', '#9e6bd9', '#e87ab0', '#3db5a6', '#f2f2f2'];

export function makePed(state, x, y) {
  return {
    x, y,
    angle: state.rng.range(0, Math.PI * 2),
    speed: state.rng.range(42, 68),
    walkPhase: state.rng.range(0, Math.PI * 2),
    shirt: state.rng.pick(SHIRTS),
    skin: state.rng.pick(['#e8b88a', '#c98d5f', '#8a5a3b', '#f2c9a0']),
    state: 'walk',
    road: 'v',
    line: x,
    dir: 1,
    scareX: 0,
    scareY: 0,
    scareTimer: 0,
    taxi: false,
    inCar: null,
    dead: false,
    fade: 0,
  };
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(state.rng);
    const ped = makePed(state, p.x, p.y);
    ped.road = p.road;
    ped.line = p.line;
    ped.dir = state.rng.chance(0.5) ? 1 : -1;
    // Stand on the sidewalk beside the road, not in traffic.
    const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2 + 3;
    if (p.road === 'v') ped.x = p.line + (ped.dir === 1 ? -off : off);
    else ped.y = p.line + (ped.dir === 1 ? off : -off);
    state.peds.push(ped);
  }
}

// Every pedestrian nearby runs from (x, y).
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee';
      ped.scareX = x;
      ped.scareY = y;
      ped.scareTimer = 2.2;
    }
  }
}

function stepPed(state, ped, dt) {
  if (ped.dead) {
    ped.fade += dt;
    return;
  }
  let speed = ped.speed;
  if (ped.state === 'flee') {
    speed = ped.speed * 2.6;
    ped.scareTimer -= dt;
    const away = Math.atan2(ped.y - ped.scareY, ped.x - ped.scareX);
    ped.angle = away;
    ped.x += Math.cos(away) * speed * dt;
    ped.y += Math.sin(away) * speed * dt;
    if (ped.scareTimer <= 0) ped.state = 'walk';
  } else {
    // Stroll along the sidewalk; turn at intersections, sometimes at random.
    const step = ped.speed * ped.dir * dt;
    if (ped.road === 'v') ped.y += step;
    else ped.x += step;
    const cross = ped.road === 'v' ? WORLD.roadsH : WORLD.roadsV;
    const along = ped.road === 'v' ? ped.y : ped.x;
    for (const line of cross) {
      if (Math.abs(along - line) < 20 && state.rng.chance(0.3)) {
        ped.road = ped.road === 'v' ? 'h' : 'v';
        ped.line = line;
        ped.dir = state.rng.chance(0.5) ? 1 : -1;
        if (ped.road === 'v') ped.y = line;
        else ped.x = line;
        break;
      }
    }
    const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2 + 3;
    if (ped.road === 'v') ped.x = ped.line + (ped.dir === 1 ? -off : off);
    else ped.y = ped.line + (ped.dir === 1 ? off : -off);
    ped.angle = ped.road === 'v' ? (ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir === 1 ? 0 : Math.PI);
    if (ped.road === 'v' && (ped.y < 50 || ped.y > WORLD.waterSouth - 50)) ped.dir *= -1;
    if (ped.road === 'h' && (ped.x < 50 || ped.x > WORLD.beachEast - 50)) ped.dir *= -1;
  }

  ped.x = clamp(ped.x, 24, WORLD.beachEast - 24);
  ped.y = clamp(ped.y, 24, WORLD.waterSouth - 24);
  const pos = { x: ped.x, y: ped.y };
  resolveBuildingCollision(state.city, pos, 10);
  ped.x = pos.x;
  ped.y = pos.y;
  ped.walkPhase += dt * (ped.state === 'flee' ? 14 : 8);
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) stepPed(state, ped, dt);
  // The dead fade out and leave.
  state.peds = state.peds.filter((p) => !p.dead || p.fade < 6);
  if (state.peds.filter((p) => !p.dead).length < 26) spawnPeds(state, 1);
}

// The closest living pedestrian within maxDist.
export function nearestPed(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const ped of state.peds) {
    if (ped.dead || ped.inCar) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
