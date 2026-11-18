// Solmara: the city itself. A seeded grid of blocks between roads, with
// buildings, parks, parking lots and named landmarks (bank, police HQ,
// hospital, safehouse, spray shop, gun store, garage). The layout never
// changes for a seed, so missions, screenshots and saves all agree on
// where things are.
import { ROAD, WORLD, PALETTE } from './config.js';
import { pick, range, intRange } from './random.js';

export const LANDMARKS = {
  safehouse: { name: 'Safehouse', x: 320, y: 320 },
  garage: { name: 'Garage', x: 2240, y: 320 },
  bank: { name: 'Solmara Bank', x: 1280, y: 1280 },
  policeHQ: { name: 'Police HQ', x: 640, y: 1920 },
  hospital: { name: 'Hospital', x: 2240, y: 1280 },
  spray: { name: 'Spray Shop', x: 2560, y: 1920 },
  gunstore: { name: 'Gun Store', x: 960, y: 2240 },
  hotel: { name: 'Hotel Miramar', x: 320, y: 2240 },
  mall: { name: 'Solmara Mall', x: 1920, y: 640 },
  gas: { name: 'Gas Station', x: 2560, y: 960 },
};

// The footprint of one landmark building, by landmark key.
const LANDMARK_SIZE = {
  safehouse: { w: 110, h: 80, roof: '#c08050', height: 1 },
  garage: { w: 150, h: 90, roof: '#5d6d7e', height: 1 },
  bank: { w: 170, h: 120, roof: '#d4c9a8', height: 3 },
  policeHQ: { w: 160, h: 110, roof: '#2c4a6b', height: 2 },
  hospital: { w: 180, h: 120, roof: '#e8e4da', height: 4 },
  spray: { w: 120, h: 80, roof: '#e74c3c', height: 1 },
  gunstore: { w: 110, h: 80, roof: '#7a5c7e', height: 1 },
  hotel: { w: 150, h: 110, roof: '#f5c542', height: 4 },
  mall: { w: 190, h: 130, roof: '#8a6d4b', height: 2 },
  gas: { w: 120, h: 80, roof: '#16a085', height: 1 },
};

// The square of land between four roads; `cx, cy` is its centre.
function blockBounds(i, j) {
  const x0 = ROAD.lines[i] + ROAD.half;
  const y0 = ROAD.lines[j] + ROAD.half;
  const x1 = ROAD.lines[i + 1] - ROAD.half;
  const y1 = ROAD.lines[j + 1] - ROAD.half;
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

function nearestRoadLine(v) {
  let best = ROAD.lines[0];
  for (const line of ROAD.lines) {
    if (Math.abs(line - v) < Math.abs(best - v)) best = line;
  }
  return best;
}

// The road point nearest to (x, y): used to drop cars and peds onto streets.
export function snapToRoad(x, y) {
  return { x: nearestRoadLine(x), y: nearestRoadLine(y) };
}

function landmarkBuilding(lm, block, key) {
  const s = LANDMARK_SIZE[key] ?? { w: 120, h: 90, roof: '#8a6d4b', height: 2 };
  return {
    kind: 'landmark', name: lm.name, key,
    x: block.cx - s.w / 2, y: block.cy - s.h / 2, w: s.w, h: s.h,
    roof: s.roof, height: s.height, windows: true,
  };
}

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const pickups = [];

  // Landmark blocks are placed by road intersection so missions can point at them.
  const landmarkAt = new Map();
  for (const [key, lm] of Object.entries(LANDMARKS)) {
    landmarkAt.set(`${lm.x},${lm.y}`, key);
  }

  for (let i = 0; i < ROAD.lines.length - 1; i += 1) {
    for (let j = 0; j < ROAD.lines.length - 1; j += 1) {
      const b = blockBounds(i, j);
      // The southern strip is beach, not blocks.
      if (b.y0 >= WORLD.beachY) continue;
      const centreKey = `${Math.round(b.cx)},${Math.round(b.cy)}`;
      const landmarkKey = landmarkAt.get(centreKey);
      if (landmarkKey) {
        buildings.push(landmarkBuilding(LANDMARKS[landmarkKey], b, landmarkKey));
        continue;
      }
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ ...b, kind: 'park' });
        const count = intRange(rng, 4, 8);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: range(rng, b.x0 + 20, b.x1 - 20), y: range(rng, b.y0 + 20, b.y1 - 20), r: range(rng, 10, 18), shade: rng() < 0.5 });
        }
      } else if (roll < 0.30) {
        lots.push({ ...b, kind: 'lot' });
        const count = intRange(rng, 3, 6);
        for (let t = 0; t < count; t += 1) {
          pickups.push({ kind: 'parkedCar', x: range(rng, b.x0 + 30, b.x1 - 30), y: range(rng, b.y0 + 30, b.y1 - 30), angle: rng() < 0.5 ? 0 : Math.PI / 2 });
        }
      } else {
        const count = intRange(rng, 1, 3);
        for (let k = 0; k < count; k += 1) {
          const w = range(rng, 70, 150);
          const h = range(rng, 70, 150);
          const x = range(rng, b.x0 + 14, b.x1 - 14 - w);
          const y = range(rng, b.y0 + 14, b.y1 - 14 - h);
          buildings.push({
            kind: 'building', name: null, x, y, w, h,
            roof: pick(rng, PALETTE.buildingRoof),
            height: intRange(rng, 1, 4),
            windows: rng() < 0.7,
          });
        }
        if (rng() < 0.5) {
          trees.push({ x: range(rng, b.x0 + 12, b.x1 - 12), y: range(rng, b.y0 + 12, b.y1 - 12), r: range(rng, 9, 14), shade: true });
        }
      }
    }
  }

  // Cash, health, armour and ammo pickups scattered on sidewalks and in parks.
  const kinds = ['cash', 'cash', 'cash', 'health', 'armor', 'ammo'];
  for (let k = 0; k < 26; k += 1) {
    const road = pick(rng, ROAD.lines);
    const along = range(rng, 200, WORLD.size - 200);
    const side = rng() < 0.5 ? -1 : 1;
    const vertical = rng() < 0.5;
    pickups.push({
      kind: pick(rng, kinds),
      x: vertical ? road + side * (ROAD.half + 12) : along,
      y: vertical ? along : road + side * (ROAD.half + 12),
      angle: 0,
    });
  }

  return { buildings, parks, lots, trees, pickups, landmarks: LANDMARKS };
}

// The building overlapping the circle at (x, y, r), or null.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// True when the point is on a road (drivable) rather than inside a block.
export function onRoad(x, y) {
  if (y >= WORLD.beachY) return true; // the beach road and sand are drivable
  for (const line of ROAD.lines) {
    if (Math.abs(x - line) <= ROAD.half + 6) return true;
    if (Math.abs(y - line) <= ROAD.half + 6) return true;
  }
  return false;
}

export function clampToWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(WORLD.size - margin, x)),
    y: Math.max(margin, Math.min(WORLD.size - margin, y)),
  };
}
