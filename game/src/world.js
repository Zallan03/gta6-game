// The simulation: the player, cars, traffic, pedestrians, police, the
// wanted level, combat, pickups and the mission chain. Pure logic — no DOM,
// no audio, no canvas — so it runs the same in the browser, in a screenshot
// scene and in a Node test. Everything random comes from the seeded RNG;
// every step is a fixed 1/60 s.
import { CAR, CAR_MODELS, PLAYER, ROAD, TRAFFIC, WANTED, WORLD } from './config.js';
import { MISSIONS } from './missions.js';
import { createCity, hitsBuilding, clampToWorld } from './city.js';
import { createRandom, pick, range, intRange, clamp, angleLerp, angleDiff, dist2 } from './random.js';

export const EVENT_OVER = 1;
export const EVENT_MISSION = 2;

let nextCarId = 1;
let nextPedId = 1;

// A car. `driver` is 'traffic' | 'parked' | 'police' | 'player' | null.
function spawnCar(rng, model, x, y, angle, driver) {
  const spec = CAR_MODELS[model];
  return {
    id: nextCarId++,
    model, x, y, angle, speed: 0,
    color: pick(rng, spec.colors),
    top: spec.top, accel: spec.accel,
    health: CAR.health, driver,
    owner: driver === 'police' ? 'police' : 'street',
    turnAt: null, turnDir: null, // traffic: the intersection it will turn at
    stuck: 0, smoke: 0, dead: false, ramT: 0, hitCooldown: 0,
    siren: driver === 'police',
  };
}

function spawnPed(rng, x, y) {
  return {
    id: nextPedId++,
    x, y, angle: range(rng, 0, Math.PI * 2),
    speed: 0, targetSpeed: range(rng, 40, TRAFFIC.pedSpeed),
    road: pick(rng, ROAD.lines), axis: rng() < 0.5 ? 'h' : 'v',
    dir: rng() < 0.5 ? 1 : -1,
    state: 'walk', // walk | flee | down
    fleeX: 0, fleeY: 0, fleeT: 0,
    shirt: pick(rng, ['#e74c3c', '#2e86c1', '#f39c12', '#16a085', '#8e44ad', '#ecf0f1', '#f1c40f']),
    skin: pick(rng, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    dead: false,
  };
}

export function createWorld(rng) {
  const city = createCity(rng);
  const state = {
    rng, city,
    time: 0,
    clock: 16.5 * 3600, // golden hour: the sun-soaked look the game is known for
    over: false, overReason: '',
    storyComplete: false,
    cash: 0,
    best: 0,
    wanted: 0,
    wantedHiddenT: 0,
    lastCrimeT: -999,
    bustT: 0,
    missionIndex: 0,
    stepIndex: 0,
    stealBase: 0,
    missionCash: 0,
    passenger: false,
    message: '',
    messageT: 0,
    feed: [],
    sfx: [],
    particles: [],
    cars: [],
    peds: [],
    cops: [],
    pickups: [],
    player: null,
    stats: { stolen: 0, arrests: 0, missions: 0, shots: 0, hits: 0 },
    shotMode: false,
  };

  const world = {
    state,
    reset,
    step,
    addWanted,
    setWanted,
    spawnPolice,
    teleportPlayer,
    giveCar,
    debug: {},
  };

  function reset() {
    nextCarId = 1;
    nextPedId = 1;
    state.time = 0;
    state.clock = 16.5 * 3600;
    state.over = false;
    state.overReason = '';
    state.storyComplete = false;
    state.cash = 0;
    state.wanted = 0;
    state.wantedHiddenT = 0;
    state.lastCrimeT = -999;
    state.bustT = 0;
    state.missionIndex = 0;
    state.stepIndex = 0;
    state.stealBase = 0;
    state.missionCash = 0;
    state.passenger = false;
    state.message = '';
    state.messageT = 0;
    state.feed = [];
    state.sfx = [];
    state.particles = [];
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.stats = { stolen: 0, arrests: 0, missions: 0, shots: 0, hits: 0 };
    state.shotMode = false;

    // The player's starting coupe waits at the garage for mission 1, nose out
    // toward the road so it can pull away cleanly.
    const coupe = spawnCar(state.rng, 'coupe', 2240, 400, Math.PI / 2, 'parked');
    coupe.owner = 'mission';
    state.cars.push(coupe);

    // Parked cars from the city's lots.
    for (const p of city.pickups) {
      if (p.kind !== 'parkedCar') continue;
      const model = pick(state.rng, ['sedan', 'sedan', 'coupe', 'van', 'beach', 'truck']);
      state.cars.push(spawnCar(state.rng, model, p.x, p.y, p.angle, 'parked'));
    }
    // Traffic cars, spread over the road grid.
    for (let i = 0; i < TRAFFIC.cars; i += 1) {
      const road = pick(state.rng, ROAD.lines);
      const along = range(state.rng, 200, WORLD.size - 200);
      const horizontal = state.rng() < 0.5;
      const model = pick(state.rng, ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'truck', 'beach']);
      const angle = horizontal ? (state.rng() < 0.5 ? 0 : Math.PI) : (state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = spawnCar(state.rng, model, horizontal ? along : road, horizontal ? road : along, angle, 'traffic');
      car.speed = range(state.rng, 150, 230);
      car.road = road;
      state.cars.push(car);
    }
    // Pedestrians on the sidewalks.
    for (let i = 0; i < TRAFFIC.peds; i += 1) {
      const road = pick(state.rng, ROAD.lines);
      const along = range(state.rng, 200, WORLD.size - 200);
      const horizontal = state.rng() < 0.5;
      state.peds.push(spawnPed(state.rng, horizontal ? along : road + 46, horizontal ? road + 46 : along));
    }
    // Pickups (cash, health, armour, ammo) from the city.
    state.pickups = city.pickups
      .filter((p) => p.kind !== 'parkedCar')
      .map((p) => ({ ...p, taken: false, bob: range(state.rng, 0, Math.PI * 2) }));

    // The player starts on foot outside the safehouse.
    state.player = {
      x: 320, y: 430, angle: -Math.PI / 2, health: PLAYER.health, armor: PLAYER.armor,
      ammo: 24, weapon: 'fists', inCar: null, speed: 0,
      punchT: 0, shootT: 0, hurtT: 0, jackT: 0, sprinting: false,
    };
    announce('Welcome to Solmara. Rico left a coupe at the Garage — go get it.');
  }

  function announce(text) {
    state.message = text;
    state.messageT = 5;
    state.feed.push({ text, t: state.time });
    if (state.feed.length > 6) state.feed.shift();
  }

  function queueSfx(name) {
    state.sfx.push(name);
  }

  function addWanted(n) {
    if (state.wanted >= WANTED.max) return;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.lastCrimeT = state.time;
    state.wantedHiddenT = 0;
  }

  function setWanted(n) {
    state.wanted = clamp(n, 0, WANTED.max);
    state.lastCrimeT = state.time;
    state.wantedHiddenT = 0;
  }

  function spawnBurst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = state.rng() * Math.PI * 2;
      const v = range(state.rng, speed * 0.4, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: range(state.rng, 0.3, 0.8), max: 0.8, color, size: range(state.rng, 2, 5) });
    }
  }

  function closestCar(x, y, maxD, driver) {
    let best = null;
    let bestD = maxD * maxD;
    for (const car of state.cars) {
      if (car.dead) continue;
      if (driver && car.driver !== driver) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function closestWalker(x, y, maxD, includeCops) {
    let best = null;
    let bestD = maxD * maxD;
    for (const ped of state.peds) {
      if (ped.dead || ped.state === 'down') continue;
      const d = dist2(x, y, ped.x, ped.y);
      if (d < bestD) { bestD = d; best = ped; }
    }
    if (includeCops) {
      for (const cop of state.cops) {
        const d = dist2(x, y, cop.x, cop.y);
        if (d < bestD) { bestD = d; best = cop; }
      }
    }
    return best;
  }

  // Push a circle out of buildings: null when clear, else the building and
  // the push vector. A zero push means the circle only grazes a corner.
  function buildingPush(x, y, r) {
    const b = hitsBuilding(state.city, x, y, r);
    if (!b) return null;
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const push = r - d;
    if (push <= 0) return { building: b, nx: 0, ny: 0, push: 0 };
    return { building: b, nx: dx / d, ny: dy / d, push };
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (p.hurtT > 0) return;
    p.hurtT = 0.4;
    let left = amount;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, left * 0.6);
      p.armor -= absorbed;
      left -= absorbed;
    }
    p.health -= left;
    if (p.health <= 0) {
      p.health = 0;
      finishGame('WASTED');
    }
  }

  function finishGame(reason) {
    if (state.over) return;
    state.over = true;
    state.overReason = reason;
    if (reason === 'WASTED') queueSfx('wasted');
    else queueSfx('busted');
    state.best = Math.max(state.best, state.cash);
  }

  function spawnPolice() {
    const p = state.player;
    const wantCars = WANTED.chaseCars[state.wanted] ?? 0;
    const haveCars = state.cars.filter((c) => c.driver === 'police' && !c.dead).length;
    for (let i = haveCars; i < wantCars; i += 1) {
      const a = range(state.rng, 0, Math.PI * 2);
      const d = range(state.rng, 500, 800);
      let x = p.x + Math.cos(a) * d;
      let y = p.y + Math.sin(a) * d;
      const snapped = clampToWorld(x, y, 60);
      x = snapped.x; y = snapped.y;
      // Drop the unit onto the nearest road so it can drive in.
      const roadX = ROAD.lines.reduce((best, l) => (Math.abs(l - x) < Math.abs(best - x) ? l : best), ROAD.lines[0]);
      const roadY = ROAD.lines.reduce((best, l) => (Math.abs(l - y) < Math.abs(best - y) ? l : best), ROAD.lines[0]);
      const onVertical = Math.abs(roadX - x) < Math.abs(roadY - y);
      const car = spawnCar(state.rng, 'police', onVertical ? roadX : x, onVertical ? y : roadY, Math.atan2(p.y - y, p.x - x), 'police');
      car.speed = 300;
      state.cars.push(car);
      queueSfx('siren');
    }
    const wantCops = WANTED.footCops[state.wanted] ?? 0;
    for (let i = state.cops.length; i < wantCops; i += 1) {
      const a = range(state.rng, 0, Math.PI * 2);
      const d = range(state.rng, 220, 380);
      const snapped = clampToWorld(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 40);
      state.cops.push({ x: snapped.x, y: snapped.y, angle: 0, speed: 0, shootT: range(state.rng, 0.5, 1.5), bust: 0 });
    }
  }

  function teleportPlayer(x, y) {
    const p = state.player;
    p.x = x; p.y = y;
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car) { car.x = x; car.y = y; car.speed = 0; }
    }
  }

  function giveCar(model, x, y, angle) {
    const car = spawnCar(state.rng, model, x, y, angle, 'parked');
    car.owner = 'mission';
    state.cars.push(car);
    return car;
  }

  function enterCar(car) {
    const p = state.player;
    if (car.driver === 'traffic') {
      // Jacking a moving car: the driver bails and flees, and the law notices.
      const driver = state.peds.find((ped) => !ped.dead && dist2(ped.x, ped.y, car.x, car.y) < 90 * 90);
      if (driver) { driver.state = 'flee'; driver.fleeX = car.x; driver.fleeY = car.y; driver.fleeT = 2.5; }
      addWanted(1);
      state.stats.stolen += 1;
      announce('Car jacked! The cops are on their way.');
      queueSfx('jack');
    } else if (car.driver === 'parked' && car.owner !== 'mission') {
      addWanted(1);
      state.stats.stolen += 1;
      announce('Car stolen! Keep it out of sight of the cops.');
      queueSfx('jack');
    }
    car.driver = 'player';
    p.inCar = car.id;
    p.jackT = 0;
  }

  function exitCar() {
    const p = state.player;
    const car = state.cars.find((c) => c.id === p.inCar);
    if (!car) { p.inCar = null; return; }
    car.driver = 'parked';
    car.speed = 0;
    const a = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(a) * 34;
    p.y = car.y + Math.sin(a) * 34;
    p.angle = car.angle;
    p.inCar = null;
    const hit = buildingPush(p.x, p.y, PLAYER.radius);
    if (hit && hit.push > 0) { p.x -= hit.nx * (hit.push + 2); p.y -= hit.ny * (hit.push + 2); }
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (state.over) return;
    p.punchT = Math.max(0, p.punchT - dt);
    p.shootT = Math.max(0, p.shootT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.jackT = Math.max(0, p.jackT - dt);

    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (!car || car.dead) { p.inCar = null; return; }
      driveCar(car, dt, input);
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
      if (input.enter && p.jackT <= 0) { exitCar(); p.jackT = 0.5; }
      return;
    }

    // On foot.
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.sprinting = !!input.sprint && len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      const speed = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      p.angle = Math.atan2(my, mx);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    const snapped = clampToWorld(p.x, p.y, PLAYER.radius + 2);
    p.x = snapped.x; p.y = snapped.y;
    const hit = buildingPush(p.x, p.y, PLAYER.radius);
    if (hit && hit.push > 0) { p.x += hit.nx * (hit.push + 1); p.y += hit.ny * (hit.push + 1); }

    if (input.enter && p.jackT <= 0) {
      const car = closestCar(p.x, p.y, 64, null);
      if (car && car.driver !== 'police') { enterCar(car); p.jackT = 0.5; }
    }
    if (input.punch && p.punchT <= 0) {
      p.punchT = PLAYER.punchRate;
      queueSfx('punch');
      const target = closestWalker(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, PLAYER.punchRange + 14, true);
      if (target) {
        if (target.shootT !== undefined) {
          // A cop: punching one is a crime, and he does not forget it.
          addWanted(1);
          state.cops = state.cops.filter((c) => c !== target);
          spawnBurst(target.x, target.y, '#e74c3c', 8, 120);
          announce('You laid out a cop! That will cost you.');
        } else {
          target.state = 'down';
          target.fleeT = 6;
          spawnBurst(target.x, target.y, '#e74c3c', 6, 100);
          addWanted(1);
          announce('That pedestrian is down. Witnesses called the cops!');
        }
        queueSfx('hit');
      }
    }
    if (input.shoot && p.weapon === 'pistol' && p.shootT <= 0) {
      p.shootT = 0.28;
      if (p.ammo > 0) {
        p.ammo -= 1;
        state.stats.shots += 1;
        queueSfx('shot');
        const aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);
        p.angle = aim;
        fireShot(p.x, p.y, aim, 460, true);
      } else {
        queueSfx('click');
      }
    }
    // Slow health regen while the heat is off.
    if (state.wanted === 0 && p.health > 0 && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + 1.2 * dt);
    }
  }

  // A shot from (x, y) along `aim`: hits the nearest ped, cop or car in the cone.
  function fireShot(x, y, aim, rangeMax, byPlayer) {
    let best = null;
    let bestD = rangeMax;
    const consider = (tx, ty, obj, kind) => {
      const d = Math.hypot(tx - x, ty - y);
      if (d > rangeMax || d < 1) return;
      const a = Math.atan2(ty - y, tx - x);
      if (Math.abs(angleDiff(aim, a)) > 0.16) return;
      if (d < bestD) { bestD = d; best = { obj, kind, x: tx, y: ty }; }
    };
    for (const ped of state.peds) if (!ped.dead && ped.state !== 'down') consider(ped.x, ped.y, ped, 'ped');
    for (const cop of state.cops) consider(cop.x, cop.y, cop, 'cop');
    if (!byPlayer) consider(state.player.x, state.player.y, state.player, 'player');
    for (const car of state.cars) {
      if (car.dead) continue;
      if (byPlayer && state.player.inCar === car.id) continue;
      consider(car.x, car.y, car, 'car');
    }
    const endX = x + Math.cos(aim) * (best ? bestD : rangeMax);
    const endY = y + Math.sin(aim) * (best ? bestD : rangeMax);
    state.particles.push({ x, y, vx: 0, vy: 0, life: 0.07, max: 0.07, color: '#ffe9a8', size: 2, tracer: { x: endX, y: endY } });
    if (!best) return;
    spawnBurst(best.x, best.y, '#e74c3c', 8, 140);
    if (best.kind === 'player') {
      hurtPlayer(5);
      return;
    }
    if (best.kind === 'ped') {
      best.obj.state = 'down';
      best.obj.fleeT = 8;
      if (byPlayer) { addWanted(1); state.stats.hits += 1; }
    } else if (best.kind === 'cop') {
      state.cops = state.cops.filter((c) => c !== best.obj);
      if (byPlayer) { addWanted(2); state.stats.hits += 1; announce('Cop down! The whole force is coming.'); }
    } else if (best.kind === 'car') {
      best.obj.health -= 18;
      if (best.obj.health <= 0) explodeCar(best.obj);
      if (byPlayer) addWanted(1);
    }
  }

  function explodeCar(car) {
    if (car.dead) return;
    car.dead = true;
    car.speed = 0;
    spawnBurst(car.x, car.y, '#ff7b00', 26, 260);
    spawnBurst(car.x, car.y, '#3d3a38', 16, 120);
    queueSfx('explosion');
    const p = state.player;
    if (dist2(p.x, p.y, car.x, car.y) < 130 * 130) hurtPlayer(45);
    if (p.inCar === car.id) { p.inCar = null; p.x = car.x + 40; p.y = car.y; }
    addWanted(1);
  }

  // Move a car one step, sliding along building walls instead of sticking to them.
  function moveCar(car, dt, noisy) {
    const speedBefore = Math.abs(car.speed);
    car.hitCooldown = Math.max(0, (car.hitCooldown ?? 0) - dt);
    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    const nx = car.x + dx;
    const hitX = buildingPush(nx, car.y, 20);
    if (hitX && hitX.push > 0) {
      // Only the speed aimed into the wall hurts, and only once per impact:
      // a glancing scrape is cheap and grinding along a wall is free.
      const perp = Math.abs(Math.cos(car.angle)) * speedBefore;
      if (perp > 120 && car.hitCooldown <= 0) {
        car.health -= perp * 0.09;
        car.hitCooldown = 0.5;
        spawnBurst(car.x, car.y, '#f5c542', 8, 160);
        if (noisy) queueSfx('crash');
      }
      car.speed *= 0.55;
    } else {
      car.x = nx;
    }
    const ny = car.y + dy;
    const hitY = buildingPush(car.x, ny, 20);
    if (hitY && hitY.push > 0) {
      const perp = Math.abs(Math.sin(car.angle)) * speedBefore;
      if (perp > 120 && car.hitCooldown <= 0) {
        car.health -= perp * 0.09;
        car.hitCooldown = 0.5;
        spawnBurst(car.x, car.y, '#f5c542', 8, 160);
        if (noisy) queueSfx('crash');
      }
      car.speed *= 0.55;
    } else {
      car.y = ny;
    }
    const snapped = clampToWorld(car.x, car.y, 24);
    car.x = snapped.x; car.y = snapped.y;
    if (car.health <= 0 && !car.dead) explodeCar(car);
  }

  function driveCar(car, dt, input) {
    const spec = CAR_MODELS[car.model];
    const throttle = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
    const reversing = car.speed < -5;
    let accel = throttle * CAR.accel * car.accel;
    if (reversing && input.up) accel = CAR.brake;
    if (input.up && car.speed < 0) accel = CAR.brake;
    car.speed += accel * dt;
    // Drag and rolling resistance.
    car.speed -= car.speed * CAR.drag * dt;
    if (!input.up && !input.down) car.speed -= car.speed * 1.4 * dt;
    const top = spec.top;
    if (car.speed > top) car.speed = top;
    if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
    if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;

    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    // Turn rate grows with speed only up to a point, so the car stays drivable
    // flat out instead of fishtailing — but at cornering speed it turns tight
    // enough (~37 units) to make a 90-degree turn and stay on the road.
    const turnRate = 3.2 * clamp(Math.abs(car.speed) / 120, 0.35, 1);
    car.angle += steerInput * turnRate * dt * (input.sprint ? 0.8 : 1) * (car.speed < 0 ? -1 : 1);
    moveCar(car, dt, car.driver === 'player');
    car.smoke = car.health < 45 ? 1 : car.health < 70 ? 0.4 : 0;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'traffic' || car.dead) continue;
      // Desired direction: along its road; at an intersection it may turn.
      const ahead = nextIntersection(car);
      let desired = car.angle;
      if (ahead && ahead.dist < 46) {
        if (car.turnAt !== ahead.key) {
          car.turnAt = ahead.key;
          car.turnDir = pickTurn(state.rng, car);
        }
        if (car.turnDir !== null && ahead.dist < 26) {
          desired = car.turnDir;
          car.road = ahead.cross;
        }
      }
      // Red light: stop before the intersection.
      let targetSpeed = 190 + (car.id % 5) * 12;
      if (ahead && ahead.dist < 90 && ahead.dist > 24 && isRed(car, ahead)) targetSpeed = 0;
      // Car ahead: slow down.
      for (const other of state.cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < 78 && side < 26) { targetSpeed = Math.min(targetSpeed, other.speed * 0.7); break; }
      }
      // The player crossing in front: brake.
      const p = state.player;
      if (!p.inCar) {
        const dx = p.x - car.x;
        const dy = p.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < 64 && side < 24) targetSpeed = 0;
      }
      car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
      if (car.speed < 0) car.speed = 0;
      car.angle = angleLerp(car.angle, desired, clamp(3.2 * dt, 0, 1));
      moveCar(car, dt, false);
    }
  }

  // The next road crossing ahead of a traffic car, if it is on a road.
  function nextIntersection(car) {
    const dirX = Math.cos(car.angle);
    const dirY = Math.sin(car.angle);
    const horizontal = Math.abs(dirX) > 0.7;
    let cross = null;
    let dist = Infinity;
    for (const line of ROAD.lines) {
      const d = horizontal ? (line - car.x) * Math.sign(dirX) : (line - car.y) * Math.sign(dirY);
      if (d > 4 && d < dist) { dist = d; cross = line; }
    }
    if (cross === null) return null;
    const key = `${horizontal ? 'h' : 'v'}:${Math.round(cross)}`;
    return { dist, cross, key, horizontal };
  }

  function pickTurn(rng, car) {
    const roll = rng();
    if (roll < 0.62) return null; // straight on
    const left = car.angle - Math.PI / 2;
    const right = car.angle + Math.PI / 2;
    return roll < 0.81 ? left : right;
  }

  // True when the light is red for this car's axis at the crossing ahead.
  function isRed(car, ahead) {
    const cycle = Math.floor(state.time / 4);
    const greenH = (cycle % 2 === 0);
    return ahead.horizontal ? !greenH : greenH;
  }

  function stepPeds(dt) {
    const p = state.player;
    const playerCar = p.inCar ? state.cars.find((c) => c.id === p.inCar) : null;
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (ped.state === 'down') {
        ped.fleeT -= dt;
        if (ped.fleeT <= 0) { ped.state = 'walk'; }
        continue;
      }
      // Flee gunfire, fast cars and the player when he is violent.
      const threatX = playerCar ? playerCar.x : p.x;
      const threatY = playerCar ? playerCar.y : p.y;
      const threatSpeed = playerCar ? Math.abs(playerCar.speed) : p.speed;
      const d2 = dist2(ped.x, ped.y, threatX, threatY);
      const scared = state.sfx.includes('shot') || (d2 < 130 * 130 && threatSpeed > 260) || (d2 < 46 * 46 && state.wanted > 0);
      if (scared && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeX = threatX; ped.fleeY = threatY; ped.fleeT = 2.2;
      }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
        ped.angle = angleLerp(ped.angle, away, clamp(6 * dt, 0, 1));
        ped.speed = 190;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (ped.fleeT <= 0) ped.state = 'walk';
      } else {
        // Stroll along a sidewalk: down a road, turning at intersections.
        ped.speed = ped.targetSpeed;
        const onH = ped.axis === 'h';
        const pos = onH ? ped.x : ped.y;
        const line = ped.road;
        // Near the end of the road, pick a new road to walk.
        const atEnd = (ped.dir > 0 && pos > WORLD.size - 220) || (ped.dir < 0 && pos < 220);
        if (atEnd) {
          ped.road = pick(state.rng, ROAD.lines);
          ped.axis = ped.axis === 'h' ? 'v' : 'h';
          ped.dir = state.rng() < 0.5 ? 1 : -1;
        }
        const off = 46;
        const targetAngle = onH ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        ped.angle = angleLerp(ped.angle, targetAngle, clamp(4 * dt, 0, 1));
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        // Stay on the sidewalk line.
        if (onH) ped.y += (line + off - ped.y) * clamp(2 * dt, 0, 1);
        else ped.x += (line + off - ped.x) * clamp(2 * dt, 0, 1);
      }
      const snapped = clampToWorld(ped.x, ped.y, 16);
      ped.x = snapped.x; ped.y = snapped.y;
      // Run over by a car: a crime, and the ped goes down.
      for (const car of state.cars) {
        if (car.dead || car.speed < 60) continue;
        if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26) {
          ped.state = 'down';
          ped.fleeT = 8;
          spawnBurst(ped.x, ped.y, '#e74c3c', 8, 120);
          if (car.driver === 'player') {
            addWanted(1);
            announce('You ran someone over! Witnesses called the cops.');
            queueSfx('hit');
          }
          car.speed *= 0.82;
        }
      }
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    if (state.wanted > 0) spawnPolice();
    // Police cars chase and ram.
    for (const car of state.cars) {
      if (car.driver !== 'police' || car.dead) continue;
      const targetX = p.inCar ? p.x + Math.cos(p.angle) * 30 : p.x;
      const targetY = p.inCar ? p.y + Math.sin(p.angle) * 30 : p.y;
      const desired = Math.atan2(targetY - car.y, targetX - car.x);
      const diff = angleDiff(car.angle, desired);
      car.angle += clamp(diff, -1.9 * dt, 1.9 * dt);
      const wantSpeed = p.inCar ? 300 + state.wanted * 42 : 230 + state.wanted * 22;
      car.speed += clamp(wantSpeed - car.speed, -420 * dt, 300 * dt);
      moveCar(car, dt, false);
      // Ramming the player's car damages it; ramming the player hurts.
      car.ramT = Math.max(0, (car.ramT ?? 0) - dt);
      if (p.inCar) {
        const pc = state.cars.find((c) => c.id === p.inCar);
        if (pc && dist2(car.x, car.y, pc.x, pc.y) < 46 * 46 && car.ramT <= 0) {
          pc.health -= 10;
          car.ramT = 1.2;
          car.speed *= 0.7;
          if (state.rng() < 0.6) queueSfx('crash');
          if (pc.health <= 0) explodeCar(pc);
        }
      } else if (dist2(car.x, car.y, p.x, p.y) < 40 * 40 && car.speed > 80) {
        hurtPlayer(10);
        car.speed *= 0.5;
      }
      if (car.health <= 0) explodeCar(car);
    }
    // Foot cops run the player down, and shoot when he is far.
    for (const cop of state.cops) {
      const d = Math.hypot(p.x - cop.x, p.y - cop.y);
      cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
      if (p.inCar) {
        // Cops shoot at the car.
        cop.shootT -= dt;
        if (cop.shootT <= 0 && d < 340) {
          cop.shootT = 1.4;
          const pc = state.cars.find((c) => c.id === p.inCar);
          if (pc) {
            pc.health -= 4;
            state.particles.push({ x: cop.x, y: cop.y, vx: 0, vy: 0, life: 0.07, max: 0.07, color: '#ffe9a8', size: 2, tracer: { x: pc.x, y: pc.y } });
            queueSfx('shot');
            if (pc.health <= 0) explodeCar(pc);
          }
        }
        continue;
      }
      if (d < WANTED.bustRange) {
        cop.bust += dt;
        if (cop.bust >= WANTED.bustSeconds) {
          state.stats.arrests += 1;
          finishGame('BUSTED');
          announce('Busted! The Solmara PD has you.');
          return;
        }
      } else {
        cop.bust = 0;
      }
      if (d > 60) {
        cop.speed = 235;
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
      }
      cop.shootT -= dt;
      if (cop.shootT <= 0 && d < 260 && d > 70) {
        cop.shootT = 2.2;
        fireShot(cop.x, cop.y, cop.angle, 300, false);
        queueSfx('shot');
      }
    }
    // Wanted decay: stay hidden and the heat cools off.
    if (state.wanted > 0 && state.time - state.lastCrimeT > WANTED.decayDelay) {
      const nearestCop = Math.min(
        ...state.cops.map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
        ...state.cars.filter((c) => c.driver === 'police').map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
        Infinity,
      );
      if (nearestCop > 520) {
        state.wantedHiddenT += dt;
        if (state.wantedHiddenT >= WANTED.decayInterval) {
          state.wantedHiddenT = 0;
          state.wanted -= 1;
          announce(state.wanted === 0 ? 'You lost them. The heat is off.' : `Wanted level down — ${state.wanted} star${state.wanted === 1 ? '' : 's'} left.`);
        }
      } else {
        state.wantedHiddenT = 0;
      }
    }
  }

  function stepPickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      pk.bob += dt * 3;
      if (dist2(p.x, p.y, pk.x, pk.y) < 34 * 34) {
        pk.taken = true;
        if (pk.kind === 'cash') {
          const amount = intRange(state.rng, 25, 120);
          state.cash += amount;
          announce(`Picked up $${amount} in cash.`);
          queueSfx('pickup');
        } else if (pk.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + 40);
          announce('Health restored.');
          queueSfx('pickup');
        } else if (pk.kind === 'armor') {
          p.armor = Math.min(PLAYER.armor, p.armor + 50);
          announce('Body armour picked up.');
          queueSfx('pickup');
        } else if (pk.kind === 'ammo') {
          p.ammo += 30;
          p.weapon = 'pistol';
          announce('Pistol ammo +30.');
          queueSfx('pickup');
        }
      }
    }
  }

  function stepMissions(dt) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return;
    const stepDef = mission.steps[state.stepIndex];
    if (!stepDef) return;
    const p = state.player;
    const lm = stepDef.target ? state.city.landmarks[stepDef.target] : null;

    if (stepDef.steal) {
      // Only a fresh theft counts: being in the coupe from mission 1 does not.
      if (state.stats.stolen > (state.stealBase ?? 0)) advanceStep();
      return;
    }
    if (!lm) return;
    const d = Math.hypot(p.x - lm.x, p.y - lm.y);
    if (d > stepDef.radius) return;
    if (stepDef.needsCar && !p.inCar) return;
    if (stepDef.onFoot && p.inCar) return;
    if (stepDef.grab) {
      announce('Vault cash grabbed! Get out — the alarm is screaming.');
      queueSfx('alarm');
      addWanted(3);
      spawnPolice();
    }
    if (mission.id === 'm1' && stepDef.id === 'walk-garage') {
      announce('There is the coupe. Press E to get in, then drive it home.');
    }
    if (mission.id === 'm3' && stepDef.id === 'pickup-rico') {
      state.passenger = true;
      announce('Rico is in! "Nice wheels. Now take me to the bank."');
    }
    advanceStep();
  }

  function advanceStep() {
    const mission = MISSIONS[state.missionIndex];
    state.stepIndex += 1;
    if (state.stepIndex >= mission.steps.length) {
      state.cash += mission.payout;
      state.missionCash += mission.payout;
      state.stats.missions += 1;
      announce(`Mission passed: ${mission.title} — $${mission.payout}.`);
      queueSfx('mission');
      state.missionIndex += 1;
      state.stepIndex = 0;
      state.stealBase = state.stats.stolen;
      if (state.missionIndex >= MISSIONS.length) {
        state.storyComplete = true;
        announce('STORY COMPLETE — The Solmara Job is done. Solmara is yours now. Free roam!');
        queueSfx('fanfare');
      } else {
        announce(MISSIONS[state.missionIndex].intro);
      }
    }
  }

  function stepParticles(dt) {
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      if (pt.vx) { pt.vx *= 0.96; pt.vy *= 0.96; }
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    // Smoke from damaged cars.
    for (const car of state.cars) {
      if (car.dead || car.smoke <= 0) continue;
      if (state.rng() < dt * 14 * car.smoke) {
        state.particles.push({ x: car.x - Math.cos(car.angle) * 14, y: car.y - Math.sin(car.angle) * 14, vx: range(state.rng, -12, 12), vy: range(state.rng, -30, -12), life: range(state.rng, 0.5, 1.1), max: 1.1, color: '#555555', size: range(state.rng, 5, 9) });
      }
    }
  }

  // Cars are solid: the player's car cannot pass through traffic or parked cars.
  function resolveCarCollisions() {
    const p = state.player;
    if (!p.inCar) return;
    const pc = state.cars.find((c) => c.id === p.inCar);
    if (!pc || pc.dead) return;
    for (const other of state.cars) {
      if (other === pc || other.dead) continue;
      const dx = pc.x - other.x;
      const dy = pc.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d >= 42 || d < 0.01) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = 42 - d;
      pc.x += nx * overlap * 0.7;
      pc.y += ny * overlap * 0.7;
      other.x -= nx * overlap * 0.3;
      other.y -= ny * overlap * 0.3;
      const relSpeed = Math.abs(pc.speed - other.speed);
      if (relSpeed > 150 && pc.hitCooldown <= 0) {
        pc.health -= relSpeed * 0.05;
        pc.hitCooldown = 0.5;
        queueSfx('crash');
      }
      // No pushing through: the player falls in behind the car ahead.
      if (pc.speed > other.speed + 40) pc.speed = other.speed + 40;
      if (other.driver === 'traffic' && other.speed < pc.speed * 0.5) other.speed = pc.speed * 0.5;
    }
  }

  function step(dt, input) {
    if (state.over) return 0;
    state.time += dt;
    state.clock = (state.clock + dt * 30) % 86400;
    state.messageT = Math.max(0, state.messageT - dt);
    let events = 0;
    stepPlayer(dt, input);
    if (state.over) return EVENT_OVER;
    resolveCarCollisions();
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    if (state.over) return EVENT_OVER;
    stepPickups(dt);
    stepMissions(dt);
    stepParticles(dt);
    // Expire one-shot sounds so flee checks see only this step's gunfire.
    state.sfx = state.sfx.filter((s) => s !== 'shot');
    if (state.storyComplete && state.missionIndex >= MISSIONS.length) events |= EVENT_MISSION;
    return events;
  }

  reset();
  return world;
}
