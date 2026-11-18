// The screenshot scenes behind ?shot=start|drive|chase|heist. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (drive toward waypoints, or run and shoot on
// foot), so the frame is what a short game really looks like — and the same
// seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createScriptedInput } from './input.js';
import { angleDiff } from './random.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 3.5;
const CHASE_SECONDS = 6;
const HEIST_SECONDS = 8;
const SAMPLE = STEP;

// Steer a car toward the current waypoint; returns the next waypoint index.
function steerCarTo(state, input, waypoints, index) {
  const player = state.player;
  const car = state.cars.find((c) => c.id === player.inCar);
  if (!car || index >= waypoints.length) {
    input.up = false; input.down = false; input.left = false; input.right = false; input.sprint = false;
    return index;
  }
  const ap = input._ap ?? (input._ap = { stuckT: 0, mode: 'drive', modeT: 0 });
  const wp = waypoints[index];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 60) return index + 1;
  const desired = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, desired);
  // Stuck against a wall: rock out — reverse briefly, then drive off.
  if (Math.abs(car.speed) < 20 && dist > 80) ap.stuckT += STEP;
  else ap.stuckT = 0;
  if (ap.stuckT > 0.8) {
    ap.stuckT = 0;
    ap.mode = ap.mode === 'drive' ? 'reverse' : 'drive';
    ap.modeT = 0.8;
  }
  if (ap.modeT > 0) ap.modeT -= STEP;
  else if (Math.abs(diff) > 2.4) { ap.mode = 'reverse'; ap.modeT = 0.9; }
  else ap.mode = 'drive';
  if (ap.mode === 'reverse') {
    // Nose pointing the wrong way: back out while swinging round.
    input.up = false;
    input.down = true;
    input.left = diff > 0.12;
    input.right = diff < -0.12;
    input.sprint = false;
  } else {
    input.left = diff > 0.12;
    input.right = diff < -0.12;
    if (Math.abs(diff) > 0.3 && Math.abs(car.speed) > 120) {
      // Brake for the corner: a 90-degree turn at full speed cannot stay on the road.
      input.up = false;
      input.down = true;
    } else {
      input.up = true;
      input.down = false;
    }
    input.sprint = Math.abs(diff) < 0.25;
  }
  return index;
}

// Walk toward a point in screen axes; returns true when there.
function walkTo(state, input, x, y) {
  const p = state.player;
  const dx = x - p.x;
  const dy = y - p.y;
  input.up = dy < -12;
  input.down = dy > 12;
  input.left = dx < -12;
  input.right = dx > 12;
  input.sprint = Math.hypot(dx, dy) > 160;
  return Math.hypot(dx, dy) < 30;
}

function seatPlayer(world, car) {
  const p = world.state.player;
  car.driver = 'player';
  p.inCar = car.id;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

// Set `world` to the named scene (start, drive, chase or heist; any other
// name is start) and return the screen to draw over it and the best haul.
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  const input = createScriptedInput();
  if (name !== 'drive' && name !== 'chase' && name !== 'heist') {
    for (let i = 0; i < START_SECONDS / SAMPLE; i += 1) world.step(SAMPLE, input);
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'drive') {
    // Mission 1: the coupe, driven home up the long north avenue — a straight
    // run past downtown, the bank and the mall, with traffic to weave through.
    const coupe = state.cars.find((c) => c.owner === 'mission');
    coupe.x = 480;
    coupe.y = 2400;
    coupe.angle = -Math.PI / 2;
    coupe.speed = 0;
    seatPlayer(world, coupe);
    // The garage step is already done: this is the drive home.
    state.stepIndex = 1;
    state.message = '';
    state.messageT = 0;
    state.cash = 150;
    state.player.ammo = 24;
    state.player.weapon = 'pistol';
    const waypoints = [
      { x: 480, y: 2080 },
      { x: 480, y: 1760 },
      { x: 480, y: 1440 },
      { x: 480, y: 1120 },
      { x: 480, y: 800 },
      { x: 480, y: 480 },
    ];
    let wp = 0;
    for (let i = 0; i < DRIVE_SECONDS / SAMPLE; i += 1) {
      wp = steerCarTo(state, input, waypoints, wp);
      if (world.step(SAMPLE, input) & EVENT_OVER) break;
      input.enter = false;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.cash };
  }

  if (name === 'chase') {
    // Mission 2 in progress: three stars, the whole force behind the player.
    state.missionIndex = 1;
    state.stepIndex = 1;
    state.stealBase = state.stats.stolen;
    state.cash = 1250;
    const car = world.giveCar('coupe', 1440, 800, Math.PI / 2);
    seatPlayer(world, car);
    state.player.ammo = 48;
    state.player.weapon = 'pistol';
    world.setWanted(3);
    world.spawnPolice();
    const waypoints = [
      { x: 1440, y: 1120 },
      { x: 1440, y: 1440 },
      { x: 1440, y: 1760 },
      { x: 1440, y: 2080 },
      { x: 1120, y: 2080 },
      { x: 800, y: 2080 },
      { x: 480, y: 2080 },
      { x: 480, y: 2400 },
      { x: 480, y: 2720 },
    ];
    let wp = 0;
    for (let i = 0; i < CHASE_SECONDS / SAMPLE; i += 1) {
      wp = steerCarTo(state, input, waypoints, wp);
      if (world.step(SAMPLE, input) & EVENT_OVER) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.cash };
  }

  // heist: the vault cash is grabbed, the alarm is up, cops are closing in.
  state.missionIndex = 3;
  state.stepIndex = 1;
  state.cash = 5200;
  state.player.ammo = 48;
  state.player.weapon = 'pistol';
  world.teleportPlayer(1280, 1370);
  world.setWanted(3);
  world.spawnPolice();
  for (let i = 0; i < HEIST_SECONDS / SAMPLE; i += 1) {
    // Run west along the bank's street, shooting at the nearest cop.
    walkTo(state, input, 800, 1440);
    let nearest = null;
    let nearestD = 380 * 380;
    for (const cop of state.cops) {
      const d = (cop.x - state.player.x) ** 2 + (cop.y - state.player.y) ** 2;
      if (d < nearestD) { nearestD = d; nearest = cop; }
    }
    if (nearest) {
      input.aimX = nearest.x;
      input.aimY = nearest.y;
      input.shoot = true;
    } else {
      input.shoot = false;
    }
    if (world.step(SAMPLE, input) & EVENT_OVER) break;
  }
  return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.cash };
}
