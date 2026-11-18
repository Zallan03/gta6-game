// Port Verano — Mara "Rook" Delgado on foot and behind the wheel: walking,
// sprinting, stealing cars, punching, and shooting. Crimes committed here
// are what the wanted system in wanted.js answers for.

import { PLAYER, WANTED, WORLD } from './config.js';
import { resolveBuildingCollision, hitBuilding } from './city.js';
import { nearestCar, damageCar } from './vehicles.js';
import { nearestPed, scarePeds } from './pedestrians.js';
import { addHeat } from './wanted.js';
import { clamp, angleTo } from './rng.js';

export function createPlayer(state) {
  return {
    x: 600,
    y: 560,
    angle: 0,
    speed: 0,
    onFoot: true,
    car: null,
    health: PLAYER.maxHealth,
    money: PLAYER.startMoney,
    ammo: 24,
    punchTimer: 0,
    fireTimer: 0,
    hurtTimer: 0,
  };
}

export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.hurtTimer > 0) return;
  p.health -= amount;
  p.hurtTimer = 0.5;
  if (state.audio) state.audio.crash(false);
  if (p.health <= 0) {
    p.health = 0;
    state.events.push({ type: 'wasted' });
  }
}

// A hitscan shot from the player toward a world point.
export function shootAt(state, tx, ty) {
  const p = state.player;
  if (p.fireTimer > 0 || p.ammo <= 0) return;
  p.fireTimer = PLAYER.fireInterval;
  p.ammo -= 1;
  p.angle = angleTo(p.x, p.y, tx, ty);
  const range = PLAYER.pistolRange;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const reach = Math.min(range, d);
  const ex = p.x + (dx / (d || 1)) * reach;
  const ey = p.y + (dy / (d || 1)) * reach;
  state.fx.tracers.push({ x1: p.x, y1: p.y, x2: ex, y2: ey, t: 0 });
  state.fx.bursts.push({ x: p.x + Math.cos(p.angle) * 22, y: p.y + Math.sin(p.angle) * 22, t: 0, kind: 'muzzle' });
  if (state.audio) state.audio.shot();
  scarePeds(state, p.x, p.y, 320);

  // Enemies first, then pedestrians, then cars along the line.
  let hitEnemy = null;
  let hitD = reach;
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    const t = rayHit(p.x, p.y, ex, ey, e.x, e.y, 16);
    if (t !== null && t < hitD) {
      hitD = t;
      hitEnemy = e;
    }
  }
  if (hitEnemy) {
    hitEnemy.health -= PLAYER.pistolDamage;
    hitEnemy.lastHit = state.time;
    state.fx.bursts.push({ x: hitEnemy.x, y: hitEnemy.y, t: 0, kind: 'hit' });
    if (hitEnemy.health <= 0) {
      state.stats.kills += 1;
      if (state.rng.chance(0.5)) p.ammo += 6;
      state.fx.bursts.push({ x: hitEnemy.x, y: hitEnemy.y, t: 0, kind: 'down' });
    }
    return;
  }
  const ped = nearestPedAlong(state, p.x, p.y, ex, ey, 14);
  if (ped) {
    ped.dead = true;
    ped.fade = 0;
    state.stats.pedsHit += 1;
    addHeat(state, WANTED.shootPed, 'shot a pedestrian');
    state.fx.bursts.push({ x: ped.x, y: ped.y, t: 0, kind: 'down' });
    scarePeds(state, ped.x, ped.y, 300);
    return;
  }
  const car = nearestCarAlong(state, p.x, p.y, ex, ey, 22);
  if (car) damageCar(state, car, PLAYER.pistolDamage);
}

// Distance along the segment where it passes within r of (cx, cy), or null.
function rayHit(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return null;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  const d = Math.hypot(cx - px, cy - py);
  return d <= r ? Math.sqrt(len2) * t : null;
}

function nearestPedAlong(state, x1, y1, x2, y2, r) {
  let best = null;
  let bestT = Infinity;
  for (const ped of state.peds) {
    if (ped.dead || ped.inCar) continue;
    const t = rayHit(x1, y1, x2, y2, ped.x, ped.y, r);
    if (t !== null && t < bestT) {
      bestT = t;
      best = ped;
    }
  }
  return best;
}

function nearestCarAlong(state, x1, y1, x2, y2, r) {
  let best = null;
  let bestT = Infinity;
  for (const car of state.cars) {
    if (car.dead) continue;
    const t = rayHit(x1, y1, x2, y2, car.x, car.y, r);
    if (t !== null && t < bestT) {
      bestT = t;
      best = car;
    }
  }
  return best;
}

function punch(state) {
  const p = state.player;
  if (p.punchTimer > 0) return;
  p.punchTimer = 0.45;
  if (state.audio) state.audio.punch();
  const fx = p.x + Math.cos(p.angle) * 34;
  const fy = p.y + Math.sin(p.angle) * 34;
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    if (Math.hypot(e.x - fx, e.y - fy) < 40) {
      e.health -= PLAYER.punchDamage;
      e.x += Math.cos(p.angle) * 26;
      e.y += Math.sin(p.angle) * 26;
      if (e.health <= 0) state.stats.kills += 1;
      return;
    }
  }
  const ped = nearestPed(state, fx, fy, 34);
  if (ped) {
    ped.dead = true;
    ped.fade = 0;
    state.stats.pedsHit += 1;
    addHeat(state, WANTED.punchPed, 'attacked a pedestrian');
    scarePeds(state, ped.x, ped.y, 260);
  }
}

function enterCar(state, car) {
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (state.audio) state.audio.door();
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
  const pos = { x: side.x, y: side.y };
  if (hitBuilding(state.city, pos.x, pos.y, 12)) {
    pos.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    pos.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
  }
  p.x = pos.x;
  p.y = pos.y;
  p.car = null;
  p.onFoot = true;
  if (state.audio) state.audio.door();
}

function updateOnFoot(state, dt, input, mouseWorld) {
  const p = state.player;
  const moveX = input.axis('left', 'right');
  const moveY = input.axis('up', 'down');
  const sprint = input.isDown('sprint');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = moveX;
  let my = moveY;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  // Face the mouse when aiming, otherwise face the walk direction.
  if (mouseWorld) p.angle = angleTo(p.x, p.y, mouseWorld.x, mouseWorld.y);

  p.x = clamp(p.x, 24, WORLD.beachEast - 24);
  p.y = clamp(p.y, 24, WORLD.waterSouth - 24);
  const pos = { x: p.x, y: p.y };
  resolveBuildingCollision(state.city, pos, PLAYER.radius);
  p.x = pos.x;
  p.y = pos.y;

  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);

  if (input.wasPressed('enter')) {
    const car = nearestCar(state, p.x, p.y, 64, (c) => c.driver !== 'player');
    if (car) {
      const stolen = car.driver === 'traffic' || car.driver === 'police';
      if (stolen) {
        state.stats.carsStolen += 1;
        addHeat(state, WANTED.stealCar, 'stole a car');
        state.msg = { text: 'CAR STOLEN', sub: 'The heat is on', until: state.time + 2.5 };
        scarePeds(state, p.x, p.y, 220);
      }
      enterCar(state, car);
    }
  }
  if (input.wasPressed('punch')) punch(state);
  if (input.mousePressed || input.mouseDown) shootAt(state, mouseWorld.x, mouseWorld.y);
}

function updateInCar(state, dt, input) {
  const p = state.player;
  const car = p.car;
  if (!car || car.dead) {
    if (car) exitCar(state);
    return;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  if (input.wasPressed('enter')) exitCar(state);
  // Running over pedestrians while driving is a crime.
  for (const ped of state.peds) {
    if (ped.dead || ped.inCar) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      ped.fade = 0;
      state.stats.pedsHit += 1;
      addHeat(state, WANTED.hitPed, 'ran over a pedestrian');
      car.speed *= 0.85;
      scarePeds(state, ped.x, ped.y, 320);
      if (state.audio) state.audio.crash(false);
    }
  }
  // Running over an enemy counts as a takedown, not a crime.
  for (const e of state.enemies) {
    if (e.health <= 0) continue;
    if (Math.hypot(e.x - car.x, e.y - car.y) < 30 && Math.abs(car.speed) > 80) {
      e.health = 0;
      state.stats.kills += 1;
      state.fx.bursts.push({ x: e.x, y: e.y, t: 0, kind: 'down' });
      if (state.audio) state.audio.crash(false);
    }
  }
}

export function updatePlayer(state, dt, input, mouseWorld) {
  if (state.player.onFoot) updateOnFoot(state, dt, input, mouseWorld);
  else updateInCar(state, dt, input);
}
