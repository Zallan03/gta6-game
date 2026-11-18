// Port Verano — screenshot scenes. Each scene plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a small
// autopilot, so the frame is what a short stretch of real play looks like
// and the same seed always gives the same frame. ?shot=chase|drive|foot|
// mission, with ?seed= to vary the city.

import { PLACES, nearestRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { clamp, angleDiff } from './rng.js';

const STEP = 1 / 60;

// Steer down the road the car is already on: aim at a point 380 ahead
// along its own road, so the car holds its lane instead of cutting
// corners across blocks.
function driveToward(state) {
  const car = state.player.car;
  if (!car) return { throttle: 0, steer: 0 };
  const spot = nearestRoadPoint(car.x, car.y);
  let dir;
  if (spot.road === 'v') dir = Math.sin(car.angle) >= 0 ? 1 : -1;
  else dir = Math.cos(car.angle) >= 0 ? 1 : -1;
  // Hold the right-hand lane, like the traffic does.
  const lane = spot.road === 'v' ? (dir === 1 ? -11 : 11) : (dir === 1 ? 11 : -11);
  let tx;
  let ty;
  if (spot.road === 'v') {
    tx = spot.line + lane;
    ty = car.y + dir * 380;
  } else {
    tx = car.x + dir * 380;
    ty = spot.line + lane;
  }
  // A car right ahead in my lane: swing out to pass it.
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (ahead > 0 && ahead < 120 && Math.abs(side) < 26) {
      tx += -Math.sin(car.angle) * 42;
      ty += Math.cos(car.angle) * 42;
      break;
    }
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.4, -1, 1);
  return { throttle: 1, steer };
}

// A fake input object shaped like the real one, driven by the autopilot.
function autoInput(state, shot) {
  const input = {
    down: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    isDown: () => false,
    wasPressed: () => false,
    axis: () => 0,
    endFrame: () => {},
  };
  const p = state.player;
  if (shot === 'chase' || shot === 'drive') {
    const car = p.car;
    if (car) {
      const d = driveToward(state);
      input.axis = (neg, pos) => {
        if (pos === 'up') return d.throttle;
        if (neg === 'left' && pos === 'right') return d.steer;
        return 0;
      };
    }
  } else if (shot === 'foot') {
    const tx = PLACES.garage.x;
    const ty = PLACES.garage.y;
    const dx = tx - p.x;
    const dy = ty - p.y;
    input.axis = (neg, pos) => {
      if (pos === 'right') return dx > 12 ? 1 : 0;
      if (neg === 'left') return dx < -12 ? 1 : 0;
      if (pos === 'down') return dy > 12 ? 1 : 0;
      if (neg === 'up') return dy < -12 ? 1 : 0;
      return 0;
    };
  }
  return input;
}

function autoMouse(state, shot) {
  const p = state.player;
  if (shot === 'mission') {
    const alive = state.enemies.find((e) => e.health > 0);
    if (alive) return { x: alive.x, y: alive.y, fire: true };
  }
  if (shot === 'foot') return { x: PLACES.garage.x, y: PLACES.garage.y, fire: false };
  if (p.car) return { x: p.x + Math.cos(p.angle) * 200, y: p.y + Math.sin(p.angle) * 200, fire: false };
  return { x: p.x + 100, y: p.y, fire: false };
}

export function stageShot(name, state, stepWorld) {
  const shot = ['chase', 'drive', 'foot', 'mission'].includes(name) ? name : 'chase';
  state.shot = shot;

  if (shot === 'chase') {
    startMission(state, 3);
    // Mara in a sport car, mid-avenue downtown, three stars already on her.
    // A long straight east along y=1000, so the chase never reaches the shore.
    const car = makeCar(300, 1000, 0, 'sport', 'player');
    car.color = '#e8722a';
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = car.x;
    state.player.y = car.y;
    state.cars.push(car);
    car.speed = 320;
    // Two cruisers already on her tail, in frame, so the chase reads.
    for (const [ox, oy] of [[-260, -24], [-330, 30]]) {
      const cop = makeCar(car.x + ox, car.y + oy, 0, 'police', 'police');
      cop.siren = true;
      cop.speed = 380;
      state.cars.push(cop);
    }
    for (let i = 0; i < 200; i += 1) stepWorld(state, STEP, autoInput(state, shot), autoMouse(state, shot));
    state.msg = { text: 'WANTED LEVEL 3', sub: 'Lose the cops', until: state.time + 10 };
  } else if (shot === 'drive') {
    startMission(state, 1);
    // A long straight east along y=1840, through the Marina district.
    const car = makeCar(300, 1840, 0, 'sedan', 'player');
    car.color = '#4a7fb5';
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = car.x;
    state.player.y = car.y;
    state.cars.push(car);
    car.speed = 280;
    for (let i = 0; i < 150; i += 1) stepWorld(state, STEP, autoInput(state, shot), autoMouse(state, shot));
    state.msg = { text: 'THE PICKUP', sub: 'Drive to Pier 9, The Docks', until: state.time + 10 };
  } else if (shot === 'foot') {
    startMission(state, 0);
    state.player.x = PLACES.plaza.x;
    state.player.y = PLACES.plaza.y;
    for (let i = 0; i < 120; i += 1) stepWorld(state, STEP, autoInput(state, shot), autoMouse(state, shot));
    state.msg = { text: 'HOMECOMING', sub: "Go to Sal's Garage in Old Town", until: state.time + 10 };
  } else {
    startMission(state, 4);
    state.player.x = PLACES.beachExchange.x - 60;
    state.player.y = PLACES.beachExchange.y - 90;
    state.player.ammo = 48;
    // Walk into the meet so the crew spawns, then hold the line.
    for (let i = 0; i < 150; i += 1) stepWorld(state, STEP, autoInput(state, shot), autoMouse(state, shot));
    state.msg = { text: 'AMBUSH', sub: '4 Kings crew — take them down', until: state.time + 10 };
  }
  state.screen = 'play';
  state.shotReady = true;
}

// The live loop keeps the scene moving with the same autopilot.
export function shotInput(state, stepWorld) {
  void stepWorld;
  return autoInput(state, state.shot);
}

export function shotMouse(state) {
  return autoMouse(state, state.shot);
}
