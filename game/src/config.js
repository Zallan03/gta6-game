// Port Verano — tuning, palette and world constants.
// Every number here was chosen for this game: a golden-hour coastal city
// that feels fast on the road and readable on foot.

export const WORLD = {
  width: 3200,
  height: 2400,
  roadWidth: 46,
  sidewalk: 14,
  // Vertical road centre lines, west to east.
  roadsV: [180, 460, 740, 1020, 1300, 1580, 1860, 2140, 2420, 2700],
  // Horizontal road centre lines, north to south.
  roadsH: [160, 440, 720, 1000, 1280, 1560, 1840, 2120],
  // Ocean on the south and east edges, beach in front of it.
  waterEast: 2920,
  waterSouth: 2260,
  beachSouth: 2180,
  beachEast: 2860,
};

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#6f9e54',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  asphalt: '#3c3f46',
  asphaltLine: '#e8c95a',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  park: '#5d9b4e',
  plaza: '#c9bfa8',
  // Roof colours by district flavour.
  roofDowntown: ['#5a6b7d', '#6d7f92', '#4e5d6e', '#7a6a58'],
  roofOldTown: ['#c96f4a', '#d99a55', '#b85c5c', '#d9b45b', '#8fae7e'],
  roofMarina: ['#e8e0cc', '#c9d6de', '#d9a06b'],
  roofDocks: ['#8a8f96', '#7a7f88', '#9aa0a8'],
  roofHills: ['#b8624f', '#c98a4a', '#7e9a6a'],
  buildingEdge: 'rgba(0,0,0,0.28)',
  shadow: 'rgba(20,16,8,0.30)',
  tree: '#3f7d3a',
  treeLight: '#57a04c',
};

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1020, h: 1000, flavour: 'oldtown' },
  { name: 'Downtown', x: 1020, y: 440, w: 1120, h: 1120, flavour: 'downtown' },
  { name: 'The Docks', x: 2420, y: 0, w: 500, h: 1000, flavour: 'docks' },
  { name: 'Marina', x: 1860, y: 1560, w: 1060, h: 700, flavour: 'marina' },
  { name: 'Beachfront', x: 0, y: 1840, w: 2920, h: 420, flavour: 'beach' },
  { name: 'The Hills', x: 0, y: 0, w: 3200, h: 160, flavour: 'hills' },
];

export const PLAYER = {
  walkSpeed: 175,
  sprintSpeed: 265,
  radius: 13,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 46,
  pistolDamage: 34,
  pistolRange: 430,
  fireInterval: 0.24,
  startMoney: 120,
};

export const CARS = {
  sedan: { accel: 330, maxSpeed: 430, grip: 7.5, length: 46, width: 22, health: 100 },
  sport: { accel: 430, maxSpeed: 580, grip: 8.5, length: 48, width: 22, health: 90 },
  taxi: { accel: 320, maxSpeed: 410, grip: 7.5, length: 46, width: 22, health: 100 },
  van: { accel: 250, maxSpeed: 350, grip: 6.5, length: 54, width: 24, health: 130 },
  truck: { accel: 210, maxSpeed: 310, grip: 6.0, length: 62, width: 26, health: 160 },
  police: { accel: 400, maxSpeed: 540, grip: 8.5, length: 48, width: 22, health: 120 },
};

export const CAR_COLORS = {
  sedan: ['#c94f42', '#4a7fb5', '#d9d9d9', '#3f5a46', '#b5892e', '#7a6a9e'],
  sport: ['#e8722a', '#f2c230', '#1fa37c', '#d93862', '#2a6fd4'],
  taxi: ['#f2c230'],
  van: ['#8a8f96', '#a86a4a', '#5a7d8a'],
  truck: ['#6b7280', '#9a7b4f'],
  police: ['#f2f2f2'],
};

export const WANTED = {
  // Heat added by each crime.
  stealCar: 22,
  hitPed: 30,
  hitPolice: 26,
  punchPed: 16,
  shootPed: 30,
  // Heat per second while unseen by any police.
  decayPerSecond: 2.2,
  // Police can spot the player this far away.
  sightRange: 560,
  // How many cruisers per star level.
  cruisersPerStar: [0, 2, 3, 4, 6, 8],
};

export const MISSIONS = {
  taxiFareMin: 40,
  taxiFareMax: 90,
  stashValue: 150,
  stashCount: 8,
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
};
