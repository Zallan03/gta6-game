// Port Verano — cars. One arcade physics model drives the player, the
// traffic and the police: acceleration, steering that bites with speed,
// drag, and collisions with buildings, the shore and each other. Traffic
// follows the road network and turns at intersections; police chase the
// player and ram, and corner them on foot.

import { CARS, CAR_COLORS, WORLD, WANTED } from './config.js';
import { resolveBuildingCollision, onRoad, randomRoadPoint, nearestRoadPoint } from './city.js';
import { clamp, angleDiff, dist2 } from './rng.js';

let nextCarId = 1;

export function makeCar(x, y, angle, kind, driver) {
  const spec = CARS[kind];
  return {
    id: nextCarId,
    kind,
    color: kind === 'taxi' ? '#f2c230' : CAR_COLORS[kind][Math.floor(Math.random() * CAR_COLORS[kind].length)],
    x, y, angle,
    speed: 0,
    health: spec.health,
    maxHealth: spec.health,
    driver,
    road: 'v',
    line: x,
    dir: 1,
    targetSpeed: 0,
    stopTimer: 0,
    stuckTimer: 0,
    bustTimer: 0,
    siren: false,
    special: null,
    dead: false,
  };
}

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(state.rng);
    const kind = state.rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck']);
    const dir = state.rng.chance(0.5) ? 1 : -1;
    const car = makeCar(p.x, p.y, 0, kind, 'traffic');
    car.road = p.road;
    car.line = p.line;
    car.dir = dir;
    car.angle = p.road === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI);
    car.targetSpeed = state.rng.range(110, 175);
    car.speed = car.targetSpeed;
    placeOnRoad(car);
    state.cars.push(car);
  }
}

export function spawnParked(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(state.rng);
    const kind = state.rng.pick(['sedan', 'sedan', 'sport', 'van']);
    const dir = state.rng.chance(0.5) ? 1 : -1;
    const car = makeCar(p.x, p.y, 0, kind, 'parked');
    car.road = p.road;
    car.line = p.line;
    car.dir = dir;
    car.angle = p.road === 'v' ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI);
    // Parked tight against the curb, on the sidewalk edge, clear of the lane.
    const off = (WORLD.roadWidth / 2 + WORLD.sidewalk / 2) * (dir === 1 ? -1 : 1);
    if (p.road === 'v') car.x = p.line + off;
    else car.y = p.line + off;
    state.cars.push(car);
  }
}

// Put a traffic car exactly on its lane.
function placeOnRoad(car) {
  const off = 11;
  if (car.road === 'v') {
    car.x = car.line + (car.dir === 1 ? -off : off);
  } else {
    car.y = car.line + (car.dir === 1 ? off : -off);
  }
}

// A cruiser appears on a road near the player, out of immediate sight.
export function spawnPoliceCar(state) {
  const p = state.player;
  let spot = null;
  for (let tries = 0; tries < 12 && !spot; tries += 1) {
    const c = randomRoadPoint(state.rng);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d > 420 && d < 900) spot = c;
  }
  if (!spot) spot = nearestRoadPoint(p.x + 500, p.y);
  const car = makeCar(spot.x, spot.y, 0, 'police', 'police');
  car.road = spot.road;
  car.line = spot.line;
  car.dir = 1;
  car.siren = true;
  car.targetSpeed = CARS.police.maxSpeed;
  state.cars.push(car);
  return car;
}

export function nearestCar(state, x, y, maxDist, filter) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.dead) continue;
    if (filter && !filter(car)) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function damageCar(state, car, amount) {
  car.health -= amount;
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    car.speed = 0;
    state.fx.bursts.push({ x: car.x, y: car.y, t: 0, kind: 'explosion' });
    if (state.audio) state.audio.crash(true);
  }
}

function carAhead(state, car, lookAhead) {
  let best = null;
  let bestGap = lookAhead;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    if (other.driver === 'parked') continue;
    if (other.road !== car.road || other.line !== car.line || other.dir !== car.dir) continue;
    // Only a car actually in my lane, not one parked at the curb, counts.
    const lateral = car.road === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
    if (lateral > 26) continue;
    const along = car.road === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
    if (along > 0 && along < bestGap) {
      bestGap = along;
      best = other;
    }
  }
  return best;
}

function updateTrafficCar(state, car, dt) {
  if (car.stopTimer > 0) {
    car.stopTimer -= dt;
    car.speed = Math.max(0, car.speed - 300 * dt);
  } else {
    const ahead = carAhead(state, car, 90);
    const want = ahead ? Math.max(0, car.targetSpeed - 220) : car.targetSpeed;
    if (car.speed < want) car.speed = Math.min(want, car.speed + 160 * dt);
    else car.speed = Math.max(want, car.speed - 260 * dt);
    if (state.rng.chance(0.0012)) car.stopTimer = state.rng.range(0.8, 2.4);
  }
  const step = car.speed * car.dir * dt;
  if (car.road === 'v') car.y += step;
  else car.x += step;
  placeOnRoad(car);

  // At an intersection, sometimes turn onto the crossing road.
  const cross = car.road === 'v' ? WORLD.roadsH : WORLD.roadsV;
  const along = car.road === 'v' ? car.y : car.x;
  for (const line of cross) {
    if (Math.abs(along - line) < 26 && state.rng.chance(0.22)) {
      const oldRoad = car.road;
      car.road = oldRoad === 'v' ? 'h' : 'v';
      car.line = line;
      car.dir = state.rng.chance(0.5) ? 1 : -1;
      if (car.road === 'v') {
        car.y = line;
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = line;
        car.angle = car.dir === 1 ? 0 : Math.PI;
      }
      placeOnRoad(car);
      break;
    }
  }

  // Loop back inside the city instead of driving into the sea.
  if (car.road === 'v' && (car.y < 60 || car.y > WORLD.waterSouth - 60)) {
    car.dir *= -1;
    car.angle += Math.PI;
  }
  if (car.road === 'h' && (car.x < 60 || car.x > WORLD.beachEast - 60)) {
    car.dir *= -1;
    car.angle += Math.PI;
  }
}

function updatePoliceCar(state, car, dt) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const targetAngle = Math.atan2(py - car.y, px - car.x);
  const steer = clamp(angleDiff(car.angle, targetAngle) * 2.4, -1, 1);
  const d = Math.hypot(px - car.x, py - car.y);
  const throttle = d > 60 ? 1 : 0.6;
  drivePhysics(state, car, throttle, steer, dt);
  car.siren = true;

  // Cornering the player on foot ends in an arrest.
  if (!p.car && d < 58) {
    car.bustTimer += dt;
    if (car.bustTimer > 1.4) {
      state.events.push({ type: 'busted' });
      car.bustTimer = 0;
    }
  } else {
    car.bustTimer = Math.max(0, car.bustTimer - dt * 2);
  }
  // Ramming the player's car damages it.
  if (p.car && d < 52) {
    damageCar(state, p.car, 6 * dt * 10);
    p.car.speed *= 0.985;
    if (state.audio && Math.random() < 0.1) state.audio.crash(false);
  }
}

export function drivePhysics(state, car, throttle, steer, dt) {
  const spec = CARS[car.kind];
  const speedFactor = clamp(Math.abs(car.speed) / 180, 0, 1);
  const turnRate = steer * 2.7 * speedFactor * (car.speed >= 0 ? 1 : -1);
  car.angle += turnRate * dt;

  if (throttle > 0) car.speed += spec.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 8) car.speed -= spec.accel * 1.4 * dt;
    else car.speed = Math.max(-170, car.speed + spec.accel * 0.7 * dt);
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.35 * dt;
  if (throttle === 0) car.speed -= car.speed * 0.9 * dt;
  const max = spec.maxSpeed;
  car.speed = clamp(car.speed, -180, max);

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;

  // Stay inside the land: the shore and the bay stop cars.
  car.x = clamp(car.x, 30, WORLD.beachEast - 20);
  car.y = clamp(car.y, 30, WORLD.waterSouth - 20);

  // Buildings stop cars at the front, centre and rear.
  const half = spec.length / 2;
  for (const s of [-half, 0, half]) {
    const px = car.x + Math.cos(car.angle) * s;
    const py = car.y + Math.sin(car.angle) * s;
    const pos = { x: px, y: py };
    if (resolveBuildingCollision(state.city, pos, 13)) {
      const pushX = pos.x - px;
      const pushY = pos.y - py;
      car.x += pushX;
      car.y += pushY;
      if (Math.abs(car.speed) > 120) {
        damageCar(state, car, 6);
        if (state.audio) state.audio.crash(false);
      }
      car.speed *= 0.55;
    }
  }

  // Skid marks when sliding hard through a turn.
  if (Math.abs(steer) > 0.7 && Math.abs(car.speed) > 260) {
    state.fx.skids.push({ x: car.x, y: car.y, angle: car.angle, t: 0 });
    if (state.fx.skids.length > 220) state.fx.skids.shift();
  }
}

function collideCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const hard = Math.abs(a.speed - b.speed) > 200;
        if (hard) {
          damageCar(state, a, 4);
          damageCar(state, b, 4);
          if (state.audio) state.audio.crash(false);
          a.speed *= 0.5;
          b.speed *= 0.5;
        }
      }
    }
  }
}

export function updateCars(state, dt, input) {
  for (const car of state.cars) {
    if (car.dead) continue;
    if (car.driver === 'player') {
      const throttle = input.axis('down', 'up');
      const steer = input.axis('left', 'right');
      drivePhysics(state, car, throttle, steer, dt);
      // Keep the player's road and direction current, so traffic ahead
      // slows for the player's car and police read the same road.
      const spot = nearestRoadPoint(car.x, car.y);
      car.road = spot.road;
      car.line = spot.line;
      const along = spot.road === 'v' ? Math.sin(car.angle) : Math.cos(car.angle);
      car.dir = along >= 0 ? 1 : -1;
    } else if (car.driver === 'traffic') {
      updateTrafficCar(state, car, dt);
    } else if (car.driver === 'police') {
      updatePoliceCar(state, car, dt);
    }
  }
  collideCars(state);
  // Drop wrecks the player can no longer drive.
  for (const car of state.cars) {
    if (car.dead && car.driver === 'player') car.driver = 'parked';
  }
  // Keep traffic topped up near the player.
  const traffic = state.cars.filter((c) => c.driver === 'traffic' && !c.dead).length;
  if (traffic < 18) spawnTraffic(state, 1);
}
