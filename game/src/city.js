// Port Verano — the city itself. buildCity turns one seed into the whole
// static map: roads, blocks, buildings, parks, beach, docks, trees, boats
// and the named places the story uses. Nothing here moves; the systems in
// vehicles.js, pedestrians.js and missions.js animate on top of it.

import { WORLD, PALETTE, DISTRICTS } from './config.js';
import { makeRng, clamp } from './rng.js';

const ROAD_HALF = WORLD.roadWidth / 2;
const WALK = WORLD.sidewalk;

// Blocks chosen by hand: two parks, one plaza, one open parking lot.
const PARK_BLOCKS = [
  { vi: 2, hi: 3, name: 'Civic Green' },
  { vi: 6, hi: 1, name: 'Harbor Park' },
];
const PLAZA_BLOCK = { vi: 1, hi: 1, name: 'Rook Plaza' };
const PARKING_BLOCK = { vi: 4, hi: 3, name: 'Downtown Lot' };

// Named places the story drives to, in world coordinates.
export const PLACES = {
  garage: { x: 600, y: 640, label: "Sal's Garage" },
  playerStart: { x: 600, y: 560, label: 'Old Town' },
  docksPickup: { x: 2760, y: 520, label: 'Pier 9, The Docks' },
  marinaDrop: { x: 2520, y: 1980, label: 'Marina Slip 12' },
  downtownLot: { x: 1440, y: 1140, label: 'Downtown Lot' },
  beachExchange: { x: 1250, y: 2215, label: 'Beachfront' },
  plaza: { x: 600, y: 580, label: 'Rook Plaza' },
  hillsHouse: { x: 900, y: 90, label: 'The Hills' },
};

function blockRect(vi, hi) {
  const x0 = WORLD.roadsV[vi] + ROAD_HALF + WALK;
  const x1 = WORLD.roadsV[vi + 1] - ROAD_HALF - WALK;
  const y0 = WORLD.roadsH[hi] + ROAD_HALF + WALK;
  const y1 = WORLD.roadsH[hi + 1] - ROAD_HALF - WALK;
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function flavourAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.flavour;
  }
  return 'oldtown';
}

function roofColor(rng, flavour) {
  switch (flavour) {
    case 'downtown': return rng.pick(PALETTE.roofDowntown);
    case 'docks': return rng.pick(PALETTE.roofDocks);
    case 'marina': return rng.pick(PALETTE.roofMarina);
    case 'hills': return rng.pick(PALETTE.roofHills);
    default: return rng.pick(PALETTE.roofOldTown);
  }
}

function buildingHeight(rng, flavour) {
  switch (flavour) {
    case 'downtown': return rng.range(24, 46);
    case 'docks': return rng.range(6, 10);
    case 'marina': return rng.range(8, 14);
    case 'hills': return rng.range(6, 10);
    default: return rng.range(8, 18);
  }
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const boats = [];
  const parks = [];
  const lots = [];

  const isPark = (vi, hi) => PARK_BLOCKS.some((p) => p.vi === vi && p.hi === hi);
  const isPlaza = (vi, hi) => PLAZA_BLOCK.vi === vi && PLAZA_BLOCK.hi === hi;
  const isParking = (vi, hi) => PARKING_BLOCK.vi === vi && PARKING_BLOCK.hi === hi;

  for (let vi = 0; vi < WORLD.roadsV.length - 1; vi += 1) {
    for (let hi = 0; hi < WORLD.roadsH.length - 1; hi += 1) {
      const b = blockRect(vi, hi);
      if (b.w <= 40 || b.h <= 40) continue;
      // Blocks past the shore are sand and sea, not streets.
      if (b.x0 >= WORLD.beachEast || b.y0 >= WORLD.beachSouth) continue;

      if (isPark(vi, hi)) {
        const park = PARK_BLOCKS.find((p) => p.vi === vi && p.hi === hi);
        parks.push({ ...b, name: park.name });
        for (let t = 0; t < 14; t += 1) {
          trees.push({
            x: rng.range(b.x0 + 14, b.x1 - 14),
            y: rng.range(b.y0 + 14, b.y1 - 14),
            r: rng.range(9, 15),
          });
        }
        continue;
      }
      if (isPlaza(vi, hi)) {
        parks.push({ ...b, name: PLAZA_BLOCK.name, plaza: true });
        for (let t = 0; t < 6; t += 1) {
          trees.push({
            x: rng.range(b.x0 + 16, b.x1 - 16),
            y: rng.range(b.y0 + 16, b.y1 - 16),
            r: rng.range(9, 13),
          });
        }
        continue;
      }
      if (isParking(vi, hi)) {
        lots.push({ ...b, name: PARKING_BLOCK.name });
        continue;
      }

      const flavour = flavourAt(b.x0 + b.w / 2, b.y0 + b.h / 2);
      const docks = flavour === 'docks';
      // Docks get one big warehouse; downtown gets a tower; elsewhere 1-3 shops.
      const count = docks ? 1 : flavour === 'downtown' ? 1 : rng.int(1, 3);
      if (count === 1) {
        const w = b.w * rng.range(0.55, 0.8);
        const h = b.h * rng.range(0.55, 0.8);
        buildings.push({
          x: b.x0 + (b.w - w) / 2,
          y: b.y0 + (b.h - h) / 2,
          w, h,
          height: buildingHeight(rng, flavour),
          color: roofColor(rng, flavour),
          flavour,
        });
      } else {
        // Split the block into a row of small buildings.
        const gap = 12;
        let x = b.x0;
        for (let i = 0; i < count; i += 1) {
          const w = (b.w - gap * (count - 1)) / count;
          const h = b.h * rng.range(0.55, 0.85);
          buildings.push({
            x,
            y: b.y0 + (b.h - h) / 2,
            w, h,
            height: buildingHeight(rng, flavour),
            color: roofColor(rng, flavour),
            flavour,
          });
          x += w + gap;
        }
      }
      // A couple of street trees on the block's edge.
      if (rng.chance(0.6)) {
        trees.push({ x: b.x0 + 8, y: b.y0 + 8, r: rng.range(8, 12) });
        trees.push({ x: b.x1 - 8, y: b.y1 - 8, r: rng.range(8, 12) });
      }
    }
  }

  // Houses along the northern hills strip.
  for (let x = 120; x < 3000; x += 150) {
    if (rng.chance(0.75)) {
      buildings.push({
        x: x + rng.range(-20, 20),
        y: rng.range(30, 90),
        w: rng.range(50, 80),
        h: rng.range(40, 55),
        height: rng.range(6, 10),
        color: rng.pick(PALETTE.roofHills),
        flavour: 'hills',
      });
    }
  }

  // Boats moored in the bay and off the beach.
  for (let i = 0; i < 9; i += 1) {
    boats.push({
      x: rng.range(2960, 3160),
      y: rng.range(200, 2100),
      angle: rng.range(-0.4, 0.4),
      len: rng.range(26, 44),
      color: rng.pick(['#f2f2f2', '#e8d29a', '#7fb5d9', '#d98a6b']),
    });
  }
  for (let i = 0; i < 5; i += 1) {
    boats.push({
      x: rng.range(300, 2600),
      y: rng.range(2310, 2370),
      angle: rng.range(-0.3, 0.3),
      len: rng.range(24, 40),
      color: rng.pick(['#f2f2f2', '#e8d29a', '#7fb5d9']),
    });
  }

  // Lamps at every intersection.
  const lamps = [];
  for (const x of WORLD.roadsV) {
    for (const y of WORLD.roadsH) {
      lamps.push({ x: x + ROAD_HALF + 6, y: y - ROAD_HALF - 6 });
    }
  }

  return {
    seed,
    buildings,
    trees,
    boats,
    parks,
    lots,
    lamps,
    roadsV: WORLD.roadsV,
    roadsH: WORLD.roadsH,
  };
}

// True when the point is on a road surface (not sidewalk or block).
export function onRoad(x, y) {
  for (const rx of WORLD.roadsV) {
    if (Math.abs(x - rx) <= ROAD_HALF) return true;
  }
  for (const ry of WORLD.roadsH) {
    if (Math.abs(y - ry) <= ROAD_HALF) return true;
  }
  return false;
}

// The building a circle of radius r at (x, y) overlaps, or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps. Returns true if moved.
export function resolveBuildingCollision(city, pos, r) {
  let moved = false;
  for (const b of city.buildings) {
    const cx = clamp(pos.x, b.x, b.x + b.w);
    const cy = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 0.001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.y = cy + (dy / d) * r;
    } else {
      // Centre inside the building: push out along the smallest overlap.
      const left = pos.x - b.x;
      const right = b.x + b.w - pos.x;
      const top = pos.y - b.y;
      const bottom = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - r;
      else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r;
      else pos.y = b.y + b.h + r;
    }
    moved = true;
  }
  return moved;
}

// Nearest point on the road network, with the road it sits on.
export function nearestRoadPoint(x, y) {
  let best = null;
  for (const rx of WORLD.roadsV) {
    const d = Math.abs(x - rx);
    if (!best || d < best.d) best = { d, x: rx, y, road: 'v', line: rx };
  }
  for (const ry of WORLD.roadsH) {
    const d = Math.abs(y - ry);
    if (!best || d < best.d) best = { d, x, y: ry, road: 'h', line: ry };
  }
  return best;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Port Verano';
}

// A random point on a road, for spawning traffic and pedestrians.
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(WORLD.roadsV);
    return { x: rx, y: rng.range(120, WORLD.waterSouth - 60), road: 'v', line: rx };
  }
  const ry = rng.pick(WORLD.roadsH);
  return { x: rng.range(120, WORLD.beachEast - 60), y: ry, road: 'h', line: ry };
}
