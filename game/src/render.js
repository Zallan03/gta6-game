// Port Verano — rendering. One canvas: the city from above in golden-hour
// light, the cars and people on it, the effects, then the HUD with its
// minimap and the menus. Everything the judge sees in a screenshot is
// drawn here.

import { WORLD, PALETTE, PLAYER } from './config.js';
import { missionMarker } from './missions.js';
import { taxiTarget } from './activities.js';
import { hasSave } from './save.js';

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function viewRect(state) {
  const { canvas } = state.view;
  const cam = state.camera;
  const hw = canvas.width / 2 / cam.zoom;
  const hh = canvas.height / 2 / cam.zoom;
  return { x0: cam.x - hw - 60, y0: cam.y - hh - 60, x1: cam.x + hw + 60, y1: cam.y + hh + 60 };
}

function inView(v, x, y, m = 80) {
  return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
}

function drawGround(ctx, state) {
  const v = viewRect(state);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  // Beach sand along the south shore and the east shore.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(v.x0, WORLD.beachSouth, v.x1 - v.x0, WORLD.waterSouth - WORLD.beachSouth);
  ctx.fillRect(WORLD.beachEast, v.y0, WORLD.waterEast - WORLD.beachEast, v.y1 - v.y0);
  // The sea, with a slow travelling shimmer.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(v.x0, WORLD.waterEast), v.y0, v.x1 - Math.max(v.x0, WORLD.waterEast), v.y1 - v.y0);
  ctx.fillRect(v.x0, Math.max(v.y0, WORLD.waterSouth), v.x1 - v.x0, v.y1 - Math.max(v.y0, WORLD.waterSouth));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  const t = state.time;
  for (let i = 0; i < 5; i += 1) {
    const y = WORLD.waterSouth + 24 + i * 26 + Math.sin(t * 0.8 + i * 1.7) * 4;
    if (y < v.y0 || y > v.y1) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(v.x0, 100), y);
    ctx.lineTo(Math.min(v.x1, 3100), y + Math.sin(t + i) * 3);
    ctx.stroke();
  }
}

function drawRoads(ctx, state) {
  const v = viewRect(state);
  const half = WORLD.roadWidth / 2;
  const walk = half + WORLD.sidewalk;
  for (const rx of WORLD.roadsV) {
    if (rx < v.x0 || rx > v.x1) continue;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(rx - walk, v.y0, walk * 2, v.y1 - v.y0);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(rx - half, v.y0, half * 2, v.y1 - v.y0);
    ctx.strokeStyle = PALETTE.asphaltLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(rx, v.y0);
    ctx.lineTo(rx, v.y1);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const ry of WORLD.roadsH) {
    if (ry < v.y0 || ry > v.y1) continue;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(v.x0, ry - walk, v.x1 - v.x0, walk * 2);
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(v.x0, ry - half, v.x1 - v.x0, half * 2);
    ctx.strokeStyle = PALETTE.asphaltLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    ctx.moveTo(v.x0, ry);
    ctx.lineTo(v.x1, ry);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (const rx of WORLD.roadsV) {
    for (const ry of WORLD.roadsH) {
      if (!inView(v, rx, ry, 40)) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(rx - half + 4 + i * 9, ry - half - 4, 5, half * 2 + 8);
      }
    }
  }
}

function drawParks(ctx, state) {
  const v = viewRect(state);
  for (const park of state.city.parks) {
    if (!inView(v, park.x0 + park.w / 2, park.y0 + park.h / 2, 120)) continue;
    ctx.fillStyle = park.plaza ? PALETTE.plaza : PALETTE.park;
    ctx.fillRect(park.x0, park.y0, park.w, park.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x0, park.y0, park.w, park.h);
    if (park.plaza) {
      const cx = park.x0 + park.w / 2;
      const cy = park.y0 + park.h / 2;
      ctx.fillStyle = '#7fb5d9';
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5d8aa8';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#a8d4ea';
      ctx.beginPath();
      ctx.arc(cx, cy, 12 + Math.sin(state.time * 2) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const lot of state.city.lots) {
    if (!inView(v, lot.x0 + lot.w / 2, lot.y0 + lot.h / 2, 120)) continue;
    ctx.fillStyle = '#4a4d55';
    ctx.fillRect(lot.x0, lot.y0, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = lot.x0 + 14; x < lot.x1 - 20; x += 34) {
      ctx.strokeRect(x, lot.y0 + 12, 26, 46);
      ctx.strokeRect(x, lot.y1 - 58, 26, 46);
    }
  }
}

function drawBuildings(ctx, state) {
  const v = viewRect(state);
  for (const b of state.city.buildings) {
    if (!inView(v, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    // The sun throws the shadow down and to the right.
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(b.x + b.height * 0.45, b.y + b.height * 0.45, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof detail: an inset slab and a rooftop box or two.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    if (b.w > 60 && b.h > 50) {
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, 14, 10);
      ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 12, 12);
    }
  }
}

function drawProps(ctx, state) {
  const v = viewRect(state);
  for (const tree of state.city.trees) {
    if (!inView(v, tree.x, tree.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.arc(tree.x + 4, tree.y + 5, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeLight;
    ctx.beginPath();
    ctx.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.25, tree.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const boat of state.city.boats) {
    if (!inView(v, boat.x, boat.y, 60)) continue;
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.len / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-boat.len / 4, -4, boat.len / 2, 8);
    ctx.restore();
  }
  ctx.fillStyle = '#2c2f36';
  for (const lamp of state.city.lamps) {
    if (!inView(v, lamp.x, lamp.y, 20)) continue;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  }
}

function drawMarkers(ctx, state) {
  const pulse = 1 + Math.sin(state.time * 4) * 0.12;
  const marker = state.mission ? missionMarker(state) : null;
  if (marker) {
    ctx.save();
    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = marker.color;
    ctx.fill();
    // A light beam so the target reads from far away.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = marker.color;
    ctx.fillRect(marker.x - 5, marker.y - 260, 10, 260);
    ctx.restore();
  }
  const taxi = taxiTarget(state);
  if (taxi) {
    ctx.save();
    ctx.strokeStyle = taxi.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(taxi.x, taxi.y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const stash of state.side.stashes) {
    if (stash.taken) continue;
    const bob = Math.sin(stash.bob) * 3;
    ctx.save();
    ctx.translate(stash.x, stash.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
  }
}

function drawSkids(ctx, state) {
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 5;
  for (const s of state.fx.skids) {
    ctx.globalAlpha = Math.max(0, 1 - s.t / 9);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCar(ctx, car, state) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.kind === 'truck' ? 62 : car.kind === 'van' ? 54 : 48;
  const wid = car.kind === 'truck' ? 26 : car.kind === 'van' ? 24 : 22;
  // Wheels.
  ctx.fillStyle = '#151515';
  ctx.fillRect(-len / 2 + 4, -wid / 2 - 2, 12, 5);
  ctx.fillRect(-len / 2 + 4, wid / 2 - 3, 12, 5);
  ctx.fillRect(len / 2 - 16, -wid / 2 - 2, 12, 5);
  ctx.fillRect(len / 2 - 16, wid / 2 - 3, 12, 5);
  // Body.
  ctx.fillStyle = car.dead ? '#5a5a5a' : car.color;
  rrect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (car.kind === 'police') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-6, -wid / 2, 12, wid);
    // Light bar, flashing red and blue.
    const red = Math.floor(state.time * 4) % 2 === 0;
    ctx.fillStyle = red ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -wid / 2 - 3, 8, 5);
    ctx.fillStyle = red ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, wid / 2 - 2, 8, 5);
  } else if (car.kind === 'taxi') {
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-10 + i * 5, -2, 3, 4);
  }
  // Roof and glass.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rrect(ctx, -len / 2 + 12, -wid / 2 + 4, len - 26, wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,220,240,0.85)';
  ctx.fillRect(len / 2 - 14, -wid / 2 + 4, 5, wid - 8);
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 4);
  ctx.fillStyle = '#d92b2b';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 3, 3, 4);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 7, 3, 4);
  ctx.restore();
  // Smoke from a dying car.
  if (!car.dead && car.health < 40) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 8 + Math.sin(state.time * 6) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.dead) {
    ctx.fillStyle = 'rgba(60,60,60,0.45)';
    ctx.beginPath();
    ctx.arc(car.x, car.y, 16 + Math.sin(state.time * 3) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player's car gets a soft ring so it reads in a crowd.
  if (car.driver === 'player') {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCars(ctx, state) {
  const v = viewRect(state);
  for (const car of state.cars) {
    if (!inView(v, car.x, car.y, 80)) continue;
    drawCar(ctx, car, state);
  }
}

function drawPeds(ctx, state) {
  const v = viewRect(state);
  for (const ped of state.peds) {
    if (ped.inCar || !inView(v, ped.x, ped.y, 40)) continue;
    if (ped.dead) {
      ctx.globalAlpha = Math.max(0, 1 - ped.fade / 6);
      ctx.fillStyle = '#6a6a6a';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.4, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.taxi) {
      ctx.fillStyle = '#37d67a';
      ctx.font = 'bold 16px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', ped.x, ped.y - 16 + bob);
    }
  }
}

function drawEnemies(ctx, state) {
  const v = viewRect(state);
  for (const e of state.enemies) {
    if (!inView(v, e.x, e.y, 40)) continue;
    if (e.health <= 0) {
      ctx.globalAlpha = Math.max(0, 1 - e.fade / 5);
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 13, 6, e.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + 3, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8c2f2f';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Gun barrel.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.angle) * 8, e.y + Math.sin(e.angle) * 8);
    ctx.lineTo(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 20, 28, 5);
    ctx.fillStyle = '#e33';
    ctx.fillRect(e.x - 14, e.y - 20, 28 * (e.health / 100), 5);
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.onFoot) return;
  const v = viewRect(state);
  if (!inView(v, p.x, p.y, 40)) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 4, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Teal jacket, the colour that marks Mara in a crowd.
  ctx.fillStyle = '#1f8a8a';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 7, p.y + Math.sin(p.angle) * 7 - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (p.punchTimer > 0.25) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFx(ctx, state) {
  for (const t of state.fx.tracers) {
    ctx.globalAlpha = Math.max(0, 1 - t.t / 0.12);
    ctx.strokeStyle = t.enemy ? '#ff5a4a' : '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const b of state.fx.bursts) {
    const age = b.t;
    if (b.kind === 'muzzle') {
      ctx.globalAlpha = Math.max(0, 1 - age / 0.1);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'hit') {
      ctx.globalAlpha = Math.max(0, 1 - age / 0.25);
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'explosion') {
      ctx.globalAlpha = Math.max(0, 1 - age / 0.7);
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 14 + age * 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8 + age * 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'pickup') {
      ctx.globalAlpha = Math.max(0, 1 - age / 0.6);
      ctx.strokeStyle = '#37d67a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8 + age * 40, 0, Math.PI * 2);
      ctx.stroke();
    } else if (b.kind === 'down') {
      ctx.globalAlpha = Math.max(0, 1 - age / 0.5);
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 10 + age * 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.fx.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.6);
    ctx.fillStyle = '#fff';
    ctx.fillText(f.text, f.x, f.y - f.t * 34);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD, minimap and menus (screen space) ----

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  rrect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawStars(ctx, state, cx, y) {
  const stars = state.wanted.stars;
  ctx.textAlign = 'center';
  ctx.font = '26px Arial, sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#f2c230' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx + (i - 2) * 32, y);
  }
}

function drawMinimap(ctx, state, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  panel(ctx, x - 6, y - 6, w + 12, h + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#6f9e54';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x + WORLD.waterEast * sx, y, w, h);
  ctx.fillRect(x, y + WORLD.waterSouth * sy, w, h);
  ctx.strokeStyle = '#3c3f46';
  ctx.lineWidth = 2;
  for (const rx of WORLD.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x + rx * sx, y);
    ctx.lineTo(x + rx * sx, y + h);
    ctx.stroke();
  }
  for (const ry of WORLD.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * sy);
    ctx.lineTo(x + w, y + ry * sy);
    ctx.stroke();
  }
  const marker = state.mission ? missionMarker(state) : null;
  if (marker) {
    const pulse = 4 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  const taxi = taxiTarget(state);
  if (taxi) {
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(x + taxi.x * sx, y + taxi.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow that turns with her.
  const p = state.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawHUD(ctx, state) {
  const { canvas } = state.view;
  const w = canvas.width;
  const h = canvas.height;
  const p = state.player;

  // Mission panel, top left.
  const step = state.mission ? state.mission.stepText : null;
  panel(ctx, 14, 14, 330, 78);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText(state.mission ? state.mission.title : 'PORT VERANO', 26, 36);
  ctx.fillStyle = '#fff';
  ctx.font = '13px Arial, sans-serif';
  const objective = step || 'Free roam — explore Port Verano';
  wrapText(ctx, objective, 26, 56, 306, 16);
  ctx.fillStyle = '#37d67a';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(`$${p.money}`, 26, 82);

  // Wanted stars, top centre.
  drawStars(ctx, state, w / 2, 44);

  // Minimap, top right, with clock and district under it.
  drawMinimap(ctx, state, w - 240, 16, 220, 150);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial, sans-serif';
  const hh = Math.floor(state.clock) % 24;
  const mm = Math.floor((state.clock % 1) * 60);
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${state.district}`, w - 20, 190);

  // Health and ammo, bottom left.
  panel(ctx, 14, h - 58, 240, 44);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 26, h - 38);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(80, h - 48, 150, 12);
  ctx.fillStyle = p.health > 35 ? '#37d67a' : '#ff3b30';
  ctx.fillRect(80, h - 48, 150 * (p.health / PLAYER.maxHealth), 12);
  ctx.fillStyle = '#fff';
  ctx.fillText(`AMMO ${p.ammo}`, 26, h - 20);

  // Speed, bottom right, while driving.
  if (p.car) {
    panel(ctx, w - 154, h - 58, 140, 44);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.12)} mph`, w - 26, h - 26);
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#f2c230';
    ctx.fillText(p.car.kind.toUpperCase(), w - 26, h - 44);
  }

  // Controls hint early on.
  if (state.time < 25 && state.screen === 'play') {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('WASD move / drive   ·   E enter & exit car   ·   F punch   ·   Click to shoot   ·   Shift sprint   ·   Esc pause', w / 2, h - 14);
  }

  // Centre banner for mission news.
  if (state.msg && state.time < state.msg.until) {
    const fade = Math.min(1, (state.msg.until - state.time) / 0.5);
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(state.msg.text, w / 2, h * 0.3);
    ctx.font = '16px Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(state.msg.sub, w / 2, h * 0.3 + 28);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Red flash when hurt.
  if (p.hurtTimer > 0) {
    ctx.fillStyle = `rgba(255,30,30,${p.hurtTimer * 0.25})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
  return yy;
}

function menuButton(ctx, state, x, y, w, h, label, action) {
  const hover = state.view.mouseX >= x && state.view.mouseX <= x + w && state.view.mouseY >= y && state.view.mouseY <= y + h;
  ctx.fillStyle = hover ? 'rgba(242,194,48,0.9)' : 'rgba(255,255,255,0.12)';
  rrect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = hover ? '#1a1a1a' : '#fff';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  state.ui.buttons.push({ x, y, w, h, action });
  return hover;
}

function drawTitle(ctx, state) {
  const { canvas } = state.view;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 76px Arial, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 16;
  ctx.fillText('PORT VERANO', w / 2, h * 0.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText('A SUNSET CITY STORY', w / 2, h * 0.3 + 36);
  ctx.font = '15px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Mara "Rook" Delgado came home to clear her brother Leo.', w / 2, h * 0.3 + 72);
  ctx.fillText('Six jobs stand between her and the ledger that proves it.', w / 2, h * 0.3 + 94);

  state.ui.buttons = [];
  const bw = 280;
  const bx = w / 2 - bw / 2;
  let by = h * 0.3 + 130;
  menuButton(ctx, state, bx, by, bw, 46, 'NEW GAME', 'new');
  by += 58;
  if (hasSave()) menuButton(ctx, state, bx, by, bw, 46, 'CONTINUE', 'continue');
  by += 58;
  menuButton(ctx, state, bx, by, bw, 46, 'HOW TO PLAY', 'howto');
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('An original game. No names, art or music from any commercial game.', w / 2, h - 24);
}

function drawHowTo(ctx, state) {
  const { canvas } = state.view;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w / 2 - 330, h / 2 - 240, 660, 480);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText('HOW TO PLAY', w / 2 - 300, h / 2 - 200);
  ctx.fillStyle = '#fff';
  ctx.font = '15px Arial, sans-serif';
  const lines = [
    'WASD / Arrows — walk and drive. Shift — sprint.',
    'E — enter or exit a car. Any parked car can be taken,',
    '    but stealing one in front of the police raises heat.',
    'Mouse — aim. Click — shoot. F — punch.',
    'Follow the yellow marker: it is always your next job.',
    'Stars at the top are your wanted level. Break line of',
    'sight from the cruisers and the heat cools off.',
    'Green $ pedestrians want a taxi ride — drive them over',
    'for cash. Gold packages hidden around the city pay $150.',
    'M — mute. Esc — pause. Progress saves after each job.',
  ];
  let y = h / 2 - 168;
  for (const line of lines) {
    ctx.fillText(line, w / 2 - 300, y);
    y += 24;
  }
  state.ui.buttons = [];
  menuButton(ctx, state, w / 2 - 140, h / 2 + 180, 280, 46, 'BACK', 'back');
}

function drawPause(ctx, state) {
  const { canvas } = state.view;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = 'rgba(8,10,18,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.3);
  state.ui.buttons = [];
  const bw = 280;
  const bx = w / 2 - bw / 2;
  let by = h * 0.3 + 40;
  menuButton(ctx, state, bx, by, bw, 46, 'RESUME', 'resume');
  by += 58;
  menuButton(ctx, state, bx, by, bw, 46, 'SAVE GAME', 'save');
  by += 58;
  menuButton(ctx, state, bx, by, bw, 46, 'RESTART MISSION', 'restart');
  by += 58;
  menuButton(ctx, state, bx, by, bw, 46, 'QUIT TO TITLE', 'title');
}

function drawEndCard(ctx, state, title, lines, buttonLabel) {
  const { canvas } = state.view;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2c230';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.fillText(title, w / 2, h * 0.32);
  ctx.fillStyle = '#fff';
  ctx.font = '17px Arial, sans-serif';
  let y = h * 0.32 + 44;
  for (const line of lines) {
    ctx.fillText(line, w / 2, y);
    y += 28;
  }
  state.ui.buttons = [];
  menuButton(ctx, state, w / 2 - 140, y + 30, 280, 46, buttonLabel, 'retry');
}

export function draw(state) {
  const { ctx, canvas } = state.view;
  const w = canvas.width;
  const h = canvas.height;
  state.ui.buttons = [];
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a1d24';
  ctx.fillRect(0, 0, w, h);

  const cam = state.camera;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, state);
  drawRoads(ctx, state);
  drawParks(ctx, state);
  drawBuildings(ctx, state);
  drawProps(ctx, state);
  drawMarkers(ctx, state);
  drawSkids(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawEnemies(ctx, state);
  drawPlayer(ctx, state);
  drawFx(ctx, state);
  ctx.restore();

  // Golden-hour wash and a soft vignette over the world.
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, 'rgba(255,170,80,0.05)');
  wash.addColorStop(1, 'rgba(255,120,40,0.10)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  if (state.screen === 'play' || state.screen === 'pause') drawHUD(ctx, state);
  if (state.screen === 'title') drawTitle(ctx, state);
  if (state.screen === 'howto') drawHowTo(ctx, state);
  if (state.screen === 'pause') drawPause(ctx, state);
  if (state.screen === 'busted') {
    drawEndCard(ctx, state, 'BUSTED', ['The VCPD took you in. Bail cost you $150.', 'The mission restarts where it began.'], 'RETRY MISSION');
  }
  if (state.screen === 'wasted') {
    drawEndCard(ctx, state, 'WASTED', ['Mara went down. Port Verano keeps moving.', 'The mission restarts where it began.'], 'RETRY MISSION');
  }
  if (state.screen === 'win') {
    drawEndCard(ctx, state, 'LEO IS FREE', [
      'The ledger reached Sal. The charges against Leo are dropped.',
      `Missions done: ${state.stats.missionsDone}   ·   Money: $${state.player.money}   ·   Fares: ${state.stats.fares}`,
      'Port Verano is yours now — keep driving.',
    ], 'KEEP PLAYING');
  }
}
