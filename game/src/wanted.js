// Port Verano — the wanted system. Crimes add heat; heat is stars; stars
// are cruisers. The heat only cools when no cruiser can see Mara, so the
// player escapes by breaking line of sight and staying out of it.

import { WANTED } from './config.js';
import { spawnPoliceCar } from './vehicles.js';

export function addHeat(state, amount, reason) {
  state.wanted.heat = Math.min(100, state.wanted.heat + amount);
  state.wanted.lastCrime = reason;
}

export function starsOf(heat) {
  if (heat < 12) return 0;
  if (heat < 32) return 1;
  if (heat < 52) return 2;
  if (heat < 72) return 3;
  if (heat < 90) return 4;
  return 5;
}

export function policeCanSee(state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const d = Math.hypot(car.x - px, car.y - py);
    if (d < WANTED.sightRange) return true;
  }
  return false;
}

export function updateWanted(state, dt) {
  const w = state.wanted;
  const stars = starsOf(w.heat);
  const changed = stars !== w.stars;
  w.stars = stars;

  if (stars > 0 && !policeCanSee(state)) {
    w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * dt);
  }
  if (stars === 0) w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * 2 * dt);

  // Match the cruisers on the street to the stars.
  const want = WANTED.cruisersPerStar[stars];
  const police = state.cars.filter((c) => c.driver === 'police' && !c.dead);
  if (police.length < want) {
    spawnPoliceCar(state);
  } else if (police.length > want) {
    // Retire the farthest cruiser first.
    const p = state.player;
    let far = null;
    let farD = -1;
    for (const car of police) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d > farD) {
        farD = d;
        far = car;
      }
    }
    if (far) far.driver = 'parked';
  }

  // Sirens rise with the chase.
  if (state.audio) {
    const near = police.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
    state.audio.siren(stars > 0 && near);
  }

  if (changed && stars > 0) {
    state.msg = { text: `WANTED LEVEL ${stars}`, sub: 'Lose the cops', until: state.time + 2.5 };
  }
  return changed;
}
