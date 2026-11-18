// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and game over. Progress (cash, mission, best haul) saves to
// localStorage.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|heist (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

// The longest frame the loop catches up on; a longer stall is dropped, not replayed.
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

function fitCanvas() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  canvas.style.width = `${Math.floor(1280 * scale)}px`;
  canvas.style.height = `${Math.floor(720 * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    return save;
  } catch {
    return null;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      missionIndex: world.state.missionIndex,
      best: Math.max(readBest(), world.state.cash),
    }));
  } catch {
    // As above.
  }
}

function applySave(save) {
  if (!save) return;
  if (Number.isFinite(save.cash)) world.state.cash = Math.max(0, Math.floor(save.cash));
  if (Number.isInteger(save.missionIndex) && save.missionIndex >= 0 && save.missionIndex < 4) {
    world.state.missionIndex = save.missionIndex;
    world.state.stepIndex = 0;
    world.state.stealBase = world.state.stats.stolen;
  }
  if (Number.isFinite(save.best)) world.state.best = Math.max(0, Math.floor(save.best));
}

function runShot(name) {
  const scene = stageShot(name, world);
  renderer.snapToPlayer(world.state);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  let lastSave = 0;
  applySave(readSave());

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    applySave(readSave());
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Get to the Garage.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    writeSave();
    announce(`${world.state.overReason}. Cash $${world.state.cash}. Best $${best}.`);
  }

  function togglePause() {
    if (screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;

    audio.unlock();
    if (input.wasPressed(ACTION_MUTE)) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (input.wasPressed(ACTION_PAUSE)) togglePause();
    if (input.wasPressed(ACTION_CONFIRM)) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_OVER) startGame();
    }

    if (screen === SCREEN_PLAY) {
      // Aim at the mouse in world coordinates.
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);
      const aim = renderer.screenToWorld(input.mouseX * scaleX, input.mouseY * scaleY);
      input.aimX = aim.x;
      input.aimY = aim.y;
      input.shoot = input.shoot || input.mouseDown;

      accumulator += elapsed;
      let guard = 0;
      while (accumulator >= STEP && guard < 8) {
        accumulator -= STEP;
        guard += 1;
        if (world.step(STEP, input) & EVENT_OVER) {
          endGame();
          break;
        }
        input.endFrame();
      }
      if (guard >= 8) accumulator = 0;
      // Drain this frame's sounds to the audio engine.
      const sfx = world.state.sfx.slice();
      world.state.sfx = [];
      audio.update(sfx);
      const p = world.state.player;
      audio.engine(p.inCar ? p.speed : 0, !!p.inCar);
      audio.siren(world.state.wanted > 0);
      if (world.state.cash > best) best = world.state.cash;
      if (now - lastSave > 5000) {
        lastSave = now;
        writeSave();
      }
    }

    renderer.draw(world.state, screen, best);
    if (screen === SCREEN_PLAY) input.endFrame();
  }

  announce('Solmara Heat. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
