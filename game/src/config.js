// Solmara Heat — every tuning number and colour in one place.
//
// The city is a fixed 3072x3072 world and the renderer shows a 1280x720
// window of it, so no rule here depends on the screen size.
export const WORLD = { size: 3072, beachY: 2848, waterY: 2976 };
export const ROAD = { pitch: 320, half: 34, lines: [160, 480, 800, 1120, 1440, 1760, 2080, 2400, 2720] };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  armor: 50,
  punchDamage: 12,
  punchRange: 34,
  punchRate: 0.38,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 430,
  brake: 700,
  reverseMax: 210,
  drag: 0.55,
  grip: 6.5,
  steerMax: 0.55,
  health: 100,
  jackTime: 0.9,
};

// kind -> { top speed, accel factor, colours the model spawns in }
export const CAR_MODELS = {
  sedan: { top: 470, accel: 1.0, colors: ['#c0392b', '#2e86c1', '#7d8a96', '#d4ac0d'] },
  coupe: { top: 560, accel: 1.15, colors: ['#e74c3c', '#f39c12', '#8e44ad', '#16a085'] },
  taxi: { top: 460, accel: 0.95, colors: ['#f1c40f'] },
  truck: { top: 380, accel: 0.8, colors: ['#5d6d7e', '#935116', '#1e8449'] },
  police: { top: 590, accel: 1.25, colors: ['#1c2733'] },
  van: { top: 420, accel: 0.9, colors: ['#aab7b8', '#2c3e50'] },
  beach: { top: 440, accel: 0.9, colors: ['#ff8fb3', '#7fe3d0'] },
};

export const TRAFFIC = { cars: 26, peds: 42, pedSpeed: 55 };

export const WANTED = {
  max: 5,
  decayDelay: 14, // seconds hidden before stars start falling
  decayInterval: 9, // seconds per star lost while hidden
  // police cars chasing per star level (index = stars)
  chaseCars: [0, 1, 2, 3, 4, 5],
  // foot cops near the player per star level
  footCops: [0, 1, 2, 3, 4, 6],
  bustSeconds: 2.2, // a cop this close on foot for this long busts the player
  bustRange: 46,
};

export const MISSION_CASH = { m1: 250, m2: 400, m3: 600, m4: 5000 };
export const SAVE_KEY = 'solmara-heat.save.v1';
export const BEST_KEY = 'solmara-heat.best.v1';

export const PALETTE = {
  grass: '#7fae5a',
  grassDry: '#a8b060',
  sand: '#e8d29a',
  water: '#2e86ab',
  waterDeep: '#1d5f7d',
  road: '#3d3a38',
  roadEdge: '#2c2927',
  lane: '#e8d44d',
  sidewalk: '#9a938a',
  crosswalk: '#e8e4da',
  buildingRoof: ['#b5673f', '#8a6d4b', '#6e7f80', '#a0522d', '#7a5c7e', '#4a6b8a', '#c08050'],
  buildingWall: '#5c4a3a',
  parkTree: '#3f7d3a',
  parkTree2: '#5a9a42',
  player: '#f2f2f2',
  playerJacket: '#e74c3c',
  cop: '#1c2733',
  copHat: '#101820',
  hudPanel: 'rgba(12, 10, 8, 0.72)',
  hudText: '#f5efe4',
  hudGold: '#f5c542',
  minimapWater: '#2e86ab',
  sunset: 'rgba(255, 150, 60, 0.10)',
  night: 'rgba(20, 30, 80, 0.14)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Trebuchet MS", sans-serif';
