// Port Verano — the story. Mara "Rook" Delgado, ex-getaway driver, comes
// home to Port Verano to clear her brother Leo, framed for a dock heist by
// the Harbor Kings. Sal Ortiz, who runs the Old Town garage, points her at
// the ledger that proves it. Six missions, each a step in that chase.

import { PLACES } from './city.js';
import { addHeat, starsOf } from './wanted.js';
import { makeCar } from './vehicles.js';

export const STORY = [
  {
    id: 'homecoming',
    title: '1 — HOMECOMING',
    brief: "Sal Ortiz runs a garage in Old Town. He has work — and news about Leo.",
    pay: 200,
    start: PLACES.playerStart,
    steps: [
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, r: 80, text: "Go to Sal's Garage in Old Town" },
      { type: 'talk', x: PLACES.garage.x, y: PLACES.garage.y, r: 70, text: 'Talk to Sal — press E' },
    ],
  },
  {
    id: 'pickup',
    title: '2 — THE PICKUP',
    brief: 'A package is waiting at Pier 9. Collect it and run it to the Marina.',
    pay: 350,
    start: PLACES.garage,
    steps: [
      { type: 'getin', text: 'Get in the car Sal lent you' },
      { type: 'goto', x: PLACES.docksPickup.x, y: PLACES.docksPickup.y, r: 70, text: 'Drive to Pier 9, The Docks' },
      { type: 'grab', x: PLACES.docksPickup.x, y: PLACES.docksPickup.y, r: 60, text: 'Grab the package — press E' },
      { type: 'deliver', x: PLACES.marinaDrop.x, y: PLACES.marinaDrop.y, r: 70, text: 'Deliver the package to Marina Slip 12' },
    ],
  },
  {
    id: 'hotwheels',
    title: '3 — HOT WHEELS',
    brief: 'The Kings park a Vortex GT in the Downtown Lot. Take it. Bring it home.',
    pay: 500,
    start: PLACES.garage,
    steps: [
      { type: 'goto', x: PLACES.downtownLot.x, y: PLACES.downtownLot.y, r: 90, text: 'Go to the Downtown Lot' },
      { type: 'steal', x: PLACES.downtownLot.x, y: PLACES.downtownLot.y, r: 60, text: 'Steal the orange Vortex GT' },
      { type: 'deliver', x: PLACES.garage.x, y: PLACES.garage.y, r: 80, text: "Bring the Vortex GT to Sal's Garage", needsVortex: true },
    ],
  },
  {
    id: 'heat',
    title: '4 — HEAT',
    brief: 'The Kings tipped off the VCPD. Three stars and closing in. Lose them.',
    pay: 400,
    start: PLACES.garage,
    heat: 68,
    steps: [
      { type: 'lose', text: 'Lose the wanted level — break line of sight' },
    ],
  },
  {
    id: 'exchange',
    title: '5 — THE EXCHANGE',
    brief: 'The Kings meet their buyer on the beach at sundown. Take the ledger.',
    pay: 700,
    start: PLACES.garage,
    steps: [
      { type: 'goto', x: PLACES.beachExchange.x, y: PLACES.beachExchange.y, r: 110, text: 'Go to the Beachfront meet' },
      { type: 'fight', x: PLACES.beachExchange.x, y: PLACES.beachExchange.y, count: 4, text: 'Deal with the Kings crew' },
      { type: 'grab', x: PLACES.beachExchange.x, y: PLACES.beachExchange.y, r: 60, text: 'Take the ledger — press E' },
    ],
  },
  {
    id: 'getaway',
    title: '6 — CLEAN GETAWAY',
    brief: 'Ledger in hand. The whole force is coming. Get it to Sal.',
    pay: 1000,
    start: PLACES.beachExchange,
    heat: 45,
    steps: [
      { type: 'deliver', x: PLACES.garage.x, y: PLACES.garage.y, r: 80, text: "Deliver the ledger to Sal's Garage" },
    ],
  },
];

export function startMission(state, index) {
  const m = STORY[index];
  if (!m) return;
  state.mission = {
    index,
    step: 0,
    phase: 'take',
    spawned: false,
    marker: null,
    done: false,
  };
  state.enemies = [];
  const p = state.player;
  p.x = m.start.x;
  p.y = m.start.y;
  p.angle = -Math.PI / 2;
  p.health = 100;
  if (p.car) {
    p.car.driver = 'parked';
    p.car = null;
    p.onFoot = true;
  }
  state.wanted.heat = m.heat || 0;
  state.wanted.stars = starsOf(state.wanted.heat);
  // Sal lends a car from mission 2 onward.
  if (index >= 1 && index <= 4) {
    const car = makeCar(m.start.x + 60, m.start.y + 30, 0, index === 2 ? 'sport' : 'sedan', 'parked');
    car.color = '#4a7fb5';
    state.cars.push(car);
  }
  // The Vortex GT waits in the Downtown Lot for mission 3.
  if (index === 2) {
    const vortex = makeCar(PLACES.downtownLot.x, PLACES.downtownLot.y, 0.4, 'sport', 'parked');
    vortex.color = '#e8722a';
    vortex.special = 'vortex';
    state.cars.push(vortex);
  }
  state.msg = { text: m.title, sub: m.brief, until: state.time + 5 };
  if (state.audio) state.audio.jingle();
}

export function currentStep(state) {
  if (!state.mission) return null;
  const m = STORY[state.mission.index];
  if (!m) return null;
  return m.steps[state.mission.step] || null;
}

export function missionMarker(state) {
  const step = currentStep(state);
  if (!step) return null;
  if (step.type === 'steal' && state.mission.phase === 'bring') {
    return { x: PLACES.garage.x, y: PLACES.garage.y, color: '#f2c230', label: "Sal's Garage" };
  }
  if (step.type === 'lose') return null;
  if (step.type === 'getin') {
    const car = state.cars.find((c) => c.driver === 'parked' && !c.dead && Math.hypot(c.x - state.player.x, c.y - state.player.y) < 800);
    if (car) return { x: car.x, y: car.y, color: '#f2c230', label: 'Your car' };
    return null;
  }
  return { x: step.x, y: step.y, color: '#f2c230', label: step.text };
}

function advanceStep(state) {
  const m = STORY[state.mission.index];
  state.mission.step += 1;
  state.mission.phase = 'take';
  state.mission.spawned = false;
  if (state.mission.step >= m.steps.length) {
    completeMission(state);
  } else {
    if (state.audio) state.audio.pickup();
  }
}

function completeMission(state) {
  const m = STORY[state.mission.index];
  state.player.money += m.pay;
  state.stats.missionsDone += 1;
  state.mission.done = true;
  state.msg = { text: 'MISSION COMPLETE', sub: `+$${m.pay}  —  ${m.title}`, until: state.time + 4 };
  if (state.audio) state.audio.jingle();
  if (state.saveGame) state.saveGame();
  const next = state.mission.index + 1;
  if (next >= STORY.length) {
    state.events.push({ type: 'win' });
  } else {
    state.pendingMission = next;
    state.pendingTimer = 3.5;
  }
}

export function resetMission(state) {
  const index = state.mission.index;
  // Clear the mission's own cars and enemies, then restart it clean.
  state.cars = state.cars.filter((c) => c.driver === 'traffic' || c.driver === 'police' || (c.driver === 'parked' && !c.special));
  state.enemies = [];
  state.wanted.heat = 0;
  state.wanted.stars = 0;
  state.player.car = null;
  state.player.onFoot = true;
  startMission(state, index);
}

function spawnEnemies(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const r = state.rng.range(60, 160);
    state.enemies.push({
      x: x + Math.cos(a) * r,
      y: y + Math.sin(a) * r,
      angle: 0,
      health: 100,
      shootTimer: state.rng.range(0.5, 1.4),
      speed: 95,
      fade: 0,
      lastHit: -10,
    });
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.health <= 0) {
      e.fade += dt;
      continue;
    }
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const d = Math.hypot(px - e.x, py - e.y);
    e.angle = Math.atan2(py - e.y, px - e.x);
    if (d > 280) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (d < 150) {
      e.x -= Math.cos(e.angle) * e.speed * 0.6 * dt;
      e.y -= Math.sin(e.angle) * e.speed * 0.6 * dt;
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 520) {
      e.shootTimer = state.rng.range(1.0, 1.7);
      const hitChance = d < 200 ? 0.34 : d < 350 ? 0.2 : 0.1;
      const tx = px + state.rng.range(-30, 30);
      const ty = py + state.rng.range(-30, 30);
      state.fx.tracers.push({ x1: e.x, y1: e.y, x2: tx, y2: ty, t: 0, enemy: true });
      if (state.audio) state.audio.shot();
      if (state.rng.chance(hitChance)) {
        // Hits land on the player, or on the car she is driving.
        state.damagePlayer(state, state.rng.int(7, 13), p.car);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.health > 0 || e.fade < 5);
}

export function updateMissions(state, dt, input) {
  if (state.pendingMission !== null && state.pendingMission !== undefined) {
    state.pendingTimer -= dt;
    if (state.pendingTimer <= 0) {
      const next = state.pendingMission;
      state.pendingMission = null;
      startMission(state, next);
    }
    return;
  }
  const step = currentStep(state);
  if (!step) return;
  const p = state.player;
  const dist = (x, y) => Math.hypot(p.x - x, p.y - y);

  switch (step.type) {
    case 'goto':
      if (dist(step.x, step.y) < step.r) advanceStep(state);
      break;
    case 'getin':
      if (p.car) advanceStep(state);
      break;
    case 'deliver':
      if (step.needsVortex && (!p.car || p.car.special !== 'vortex')) break;
      if (dist(step.x, step.y) < step.r) advanceStep(state);
      break;
    case 'grab':
    case 'talk':
      if (dist(step.x, step.y) < step.r && input.wasPressed('enter')) {
        if (state.audio) state.audio.pickup();
        advanceStep(state);
      }
      break;
    case 'steal': {
      if (state.mission.phase === 'take') {
        if (p.car && p.car.special === 'vortex') {
          state.mission.phase = 'bring';
          state.msg = { text: 'VORTEX GT STOLEN', sub: "Now get it to Sal's Garage", until: state.time + 3 };
          addHeat(state, 22, 'stole the Vortex GT');
        }
      } else if (p.car && p.car.special === 'vortex' && dist(PLACES.garage.x, PLACES.garage.y) < 80) {
        advanceStep(state);
      }
      break;
    }
    case 'lose':
      if (state.wanted.stars === 0) advanceStep(state);
      break;
    case 'fight': {
      if (!state.mission.spawned) {
        state.mission.spawned = true;
        spawnEnemies(state, step.x, step.y, step.count);
        state.msg = { text: 'AMBUSH', sub: `${step.count} Kings crew — take them down`, until: state.time + 3 };
      }
      const alive = state.enemies.filter((e) => e.health > 0).length;
      if (alive === 0) advanceStep(state);
      break;
    }
    default:
      break;
  }
}
