// Port Verano — side work between missions: taxi fares and hidden stash
// packages. A waving pedestrian pays for a ride across town; a glowing
// package tucked behind a building pays on pickup. Both feed the same
// money the story pays in.

import { MISSIONS } from './config.js';
import { nearestPed, scarePeds } from './pedestrians.js';
import { nearestRoadPoint } from './city.js';

export function createActivities(state) {
  state.side = {
    taxi: null,
    stashes: [],
    stashFound: 0,
  };
  // Scatter the stash packages on sidewalks near buildings.
  for (let i = 0; i < MISSIONS.stashCount; i += 1) {
    const p = nearestRoadPoint(
      state.rng.range(200, 2800),
      state.rng.range(200, 2100),
    );
    state.side.stashes.push({
      x: p.x + state.rng.range(-90, 90),
      y: p.y + state.rng.range(-90, 90),
      taken: false,
      bob: state.rng.range(0, Math.PI * 2),
    });
  }
}

// Offer a fare: the nearest waving pedestrian becomes a customer.
export function offerTaxi(state) {
  if (state.side.taxi) return false;
  const p = state.player;
  if (!p.car) return false;
  const ped = nearestPed(state, p.x, p.y, 260);
  if (!ped) return false;
  ped.taxi = true;
  const dest = nearestRoadPoint(state.rng.range(200, 2800), state.rng.range(200, 2100));
  state.side.taxi = {
    ped,
    stage: 'pickup',
    destX: dest.x,
    destY: dest.y,
    fare: state.rng.int(MISSIONS.taxiFareMin, MISSIONS.taxiFareMax),
  };
  state.msg = { text: 'FARE OFFERED', sub: 'Pick up the waving passenger', until: state.time + 3 };
  return true;
}

export function updateActivities(state, dt) {
  const taxi = state.side.taxi;
  const p = state.player;
  if (taxi) {
    if (taxi.stage === 'pickup') {
      const d = Math.hypot(taxi.ped.x - p.x, taxi.ped.y - p.y);
      if (d < 70 && p.car) {
        taxi.ped.inCar = p.car;
        taxi.stage = 'dropoff';
        state.msg = { text: 'PASSENGER ABOARD', sub: 'Drive to the green marker', until: state.time + 3 };
        if (state.audio) state.audio.pickup();
      } else if (d > 900 || taxi.ped.dead) {
        taxi.ped.taxi = false;
        state.side.taxi = null;
        state.msg = { text: 'FARE LOST', sub: 'The passenger gave up waiting', until: state.time + 3 };
      }
    } else if (taxi.stage === 'dropoff') {
      const d = Math.hypot(taxi.destX - p.x, taxi.destY - p.y);
      if (d < 70) {
        p.money += taxi.fare;
        state.stats.fares += 1;
        taxi.ped.inCar = null;
        taxi.ped.taxi = false;
        state.side.taxi = null;
        state.msg = { text: `FARE PAID  $${taxi.fare}`, sub: 'Nice driving', until: state.time + 3 };
        if (state.audio) state.audio.cash();
      } else if (!p.car) {
        taxi.ped.inCar = null;
        taxi.ped.taxi = false;
        state.side.taxi = null;
        state.msg = { text: 'FARE LOST', sub: 'You left the cab', until: state.time + 3 };
      }
    }
  }

  // Stash pickups: walk or drive over the glow.
  for (const stash of state.side.stashes) {
    if (stash.taken) continue;
    stash.bob += dt * 3;
    const d = Math.hypot(stash.x - p.x, stash.y - p.y);
    if (d < 46) {
      stash.taken = true;
      state.side.stashFound += 1;
      p.money += MISSIONS.stashValue;
      state.stats.stashes += 1;
      state.msg = { text: `STASH FOUND  +$${MISSIONS.stashValue}`, sub: `${state.side.stashFound} of ${MISSIONS.stashCount} found`, until: state.time + 3 };
      state.fx.bursts.push({ x: stash.x, y: stash.y, t: 0, kind: 'pickup' });
      if (state.audio) state.audio.pickup();
    }
  }
}

// The current taxi destination, for the HUD and the minimap.
export function taxiTarget(state) {
  const taxi = state.side.taxi;
  if (!taxi) return null;
  if (taxi.stage === 'pickup') return { x: taxi.ped.x, y: taxi.ped.y, color: '#37d67a', label: 'Passenger' };
  return { x: taxi.destX, y: taxi.destY, color: '#37d67a', label: 'Drop-off' };
}
