// Port Verano — the wiring. One state object, one fixed-step world update,
// one render, and the menus that hold it together. The game runs on the
// canvas in index.html and needs nothing else.

import { WORLD } from './config.js';
import { buildCity, districtAt } from './city.js';
import { makeRng, clamp } from './rng.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayer, hurtPlayer } from './player.js';
import { spawnTraffic, spawnParked, updateCars, damageCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { createActivities, updateActivities } from './activities.js';
import { updateWanted } from './wanted.js';
import { STORY, startMission, updateMissions, updateEnemies, resetMission, currentStep } from './missions.js';
import { saveGame, loadGame } from './save.js';
import { draw } from './render.js';
import { stageShot, shotInput, shotMouse } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const errBox = document.getElementById('err');
const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot');

const audio = createAudio();
const input = createInput(canvas);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('error', (e) => {
  errBox.textContent = `ERROR: ${e.message} (${e.filename}:${e.lineno})`;
  errBox.style.display = 'block';
});

// Damage from an enemy bullet lands on the driver or on the car.
function damagePlayer(state, amount, car) {
  if (car) damageCar(state, car, amount);
  else hurtPlayer(state, amount);
}

function createGame(seed) {
  const state = {
    seed,
    rng: makeRng(seed + 101),
    city: buildCity(seed),
    time: 0,
    clock: 17.35,
    screen: 'title',
    view: { canvas, ctx, mouseX: 0, mouseY: 0 },
    camera: { x: 1450, y: 1100, zoom: 0.9 },
    player: null,
    cars: [],
    peds: [],
    enemies: [],
    wanted: { heat: 0, stars: 0, lastCrime: '' },
    mission: null,
    pendingMission: null,
    pendingTimer: 0,
    side: null,
    fx: { tracers: [], bursts: [], skids: [], floaters: [] },
    msg: null,
    events: [],
    stats: { missionsDone: 0, fares: 0, stashes: 0, kills: 0, carsStolen: 0, pedsHit: 0 },
    district: 'Old Town',
    audio,
    saveGame: null,
    damagePlayer,
    ui: { buttons: [] },
    shot: null,
    shotReady: false,
  };
  state.saveGame = () => saveGame(state);
  state.player = createPlayer(state);
  createActivities(state);
  spawnTraffic(state, 24);
  spawnParked(state, 12);
  spawnPeds(state, 30);
  startMission(state, 0);
  return state;
}

function screenToWorld(state, sx, sy) {
  const cam = state.camera;
  return {
    x: cam.x + (sx - canvas.width / 2) / cam.zoom,
    y: cam.y + (sy - canvas.height / 2) / cam.zoom,
  };
}

function stepWorld(state, dt, inp, mouseWorld) {
  state.time += dt;
  state.clock = (17.35 + state.time * 0.004) % 24;
  const step = currentStep(state);
  if (state.mission) {
    state.mission.title = STORY[state.mission.index].title;
    state.mission.stepText = step ? step.text : '';
  }
  updatePlayer(state, dt, inp, mouseWorld);
  updateCars(state, dt, inp);
  updatePeds(state, dt);
  updateEnemies(state, dt);
  updateMissions(state, dt, inp);
  updateActivities(state, dt);
  updateWanted(state, dt);

  // Age the effects.
  for (const t of state.fx.tracers) t.t += dt;
  state.fx.tracers = state.fx.tracers.filter((t) => t.t < 0.12);
  for (const b of state.fx.bursts) b.t += dt;
  state.fx.bursts = state.fx.bursts.filter((b) => b.t < 0.8);
  for (const s of state.fx.skids) s.t += dt;
  state.fx.skids = state.fx.skids.filter((s) => s.t < 9);
  for (const f of state.fx.floaters) f.t += dt;
  state.fx.floaters = state.fx.floaters.filter((f) => f.t < 1.6);

  // Camera follows the player, wider when driving.
  const p = state.player;
  const targetZoom = p.car ? 0.85 : 1.0;
  const k = 1 - Math.exp(-4 * dt);
  state.camera.x += (p.x - state.camera.x) * k;
  state.camera.y += (p.y - state.camera.y) * k;
  state.camera.zoom += (targetZoom - state.camera.zoom) * k;
  state.camera.x = clamp(state.camera.x, 0, WORLD.width);
  state.camera.y = clamp(state.camera.y, 0, WORLD.height);
  state.district = districtAt(p.x, p.y);

  // Engine note follows the car.
  if (audio) {
    const ratio = p.car ? clamp(Math.abs(p.car.speed) / 580, 0, 1) : 0;
    audio.engine(ratio, !!p.car && state.screen === 'play');
  }

  handleEvents(state);
}

function stepAmbient(state, dt) {
  state.time += dt;
  state.clock = (17.35 + state.time * 0.004) % 24;
  const dummy = { axis: () => 0, isDown: () => false, wasPressed: () => false, mousePressed: false, mouseDown: false };
  updateCars(state, dt, dummy);
  updatePeds(state, dt);
  for (const t of state.fx.tracers) t.t += dt;
  state.fx.tracers = state.fx.tracers.filter((t) => t.t < 0.12);
}

function handleEvents(state) {
  if (!state.events.length) return;
  for (const ev of state.events) {
    if (ev.type === 'busted') {
      state.player.money = Math.max(0, state.player.money - 150);
      state.screen = 'busted';
      if (audio) audio.fail();
    } else if (ev.type === 'wasted') {
      state.screen = 'wasted';
      if (audio) audio.fail();
    } else if (ev.type === 'win') {
      state.mission = null;
      state.screen = 'win';
      if (audio) audio.jingle();
    }
  }
  state.events = [];
}

function newGame() {
  const fresh = createGame(SEED);
  fresh.screen = 'play';
  audio.init();
  audio.startMusic();
  return fresh;
}

function continueGame() {
  const data = loadGame();
  if (!data) return null;
  const fresh = createGame(SEED);
  startMission(fresh, data.missionIndex);
  const p = fresh.player;
  p.x = data.x;
  p.y = data.y;
  p.money = data.money;
  p.ammo = data.ammo;
  p.health = data.health;
  fresh.side.stashes.forEach((s, i) => {
    s.taken = !!data.stashesTaken[i];
  });
  fresh.stats = data.stats;
  fresh.clock = data.clock;
  fresh.screen = 'play';
  audio.init();
  audio.startMusic();
  return fresh;
}

function clickAction(state, action) {
  switch (action) {
    case 'new':
      return newGame();
    case 'continue': {
      const cont = continueGame();
      return cont || state;
    }
    case 'howto':
      state.screen = 'howto';
      return state;
    case 'back':
      state.screen = 'title';
      return state;
    case 'resume':
      state.screen = 'play';
      return state;
    case 'save':
      saveGame(state);
      state.msg = { text: 'SAVED', sub: 'Progress stored on this machine', until: state.time + 2 };
      return state;
    case 'restart':
      resetMission(state);
      state.screen = 'play';
      return state;
    case 'title':
      state.screen = 'title';
      return state;
    case 'retry':
      if (state.screen === 'win') {
        state.screen = 'play';
      } else {
        resetMission(state);
        state.screen = 'play';
      }
      return state;
    default:
      return state;
  }
}

let state = createGame(SEED);

// Screenshot mode: stage the scene once, then keep it alive on autopilot.
if (SHOT) {
  try {
    stageShot(SHOT, state, stepWorld);
  } catch (e) {
    errBox.textContent = `SHOT ERROR: ${e.message}`;
    errBox.style.display = 'block';
  }
}

function handleMenuKeys() {
  if (input.wasPressed('mute')) audio.setMuted(!audio.muted);
  if (state.screen === 'title' && (input.pressed.has('Enter') || input.pressed.has('NumpadEnter'))) {
    state = newGame();
  } else if (state.screen === 'howto' && (input.wasPressed('pause') || input.pressed.has('Enter'))) {
    state.screen = 'title';
  } else if (state.screen === 'play' && input.wasPressed('pause')) {
    state.screen = 'pause';
  } else if (state.screen === 'pause') {
    if (input.wasPressed('pause')) state.screen = 'play';
    else if (input.pressed.has('KeyS')) {
      saveGame(state);
      state.msg = { text: 'SAVED', sub: 'Progress stored on this machine', until: state.time + 2 };
    } else if (input.pressed.has('KeyR')) {
      resetMission(state);
      state.screen = 'play';
    } else if (input.pressed.has('KeyQ')) state.screen = 'title';
  } else if ((state.screen === 'busted' || state.screen === 'wasted' || state.screen === 'win') && input.pressed.has('Enter')) {
    state = clickAction(state, 'retry');
  }
}

let last = performance.now();
let firstFrame = true;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.view.mouseX = input.mouseX;
  state.view.mouseY = input.mouseY;
  handleMenuKeys();

  if (state.screen === 'play') {
    if (state.shot) {
      const si = shotInput(state);
      const sm = shotMouse(state);
      si.mouseDown = !!sm.fire;
      si.mousePressed = false;
      const mw = { x: sm.x, y: sm.y };
      stepWorld(state, dt, si, mw);
    } else {
      const mw = screenToWorld(state, input.mouseX, input.mouseY);
      stepWorld(state, dt, input, mw);
    }
  } else if (state.screen === 'title') {
    state.camera.x = 1450 + Math.sin(state.time * 0.05) * 320;
    state.camera.y = 1100 + Math.cos(state.time * 0.04) * 220;
    state.camera.zoom = 0.9;
    stepAmbient(state, dt);
  }

  draw(state);
  if (firstFrame) {
    firstFrame = false;
    if (state.shot) window.__shotReady = true;
  }
  if (input.mousePressed) {
    const mx = input.mouseX;
    const my = input.mouseY;
    for (const b of state.ui.buttons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        audio.init();
        state = clickAction(state, b.action);
        break;
      }
    }
  }
  input.endFrame();
  requestAnimationFrame(frame);
}

window.__game = { get state() { return state; } };
requestAnimationFrame(frame);
