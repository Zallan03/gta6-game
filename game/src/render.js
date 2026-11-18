// The renderer: everything the player sees. Top-down golden-hour Solmara —
// roads and sidewalks, rooftops with long sunset shadows, the beach and the
// ocean, cars, pedestrians, cops, particles — plus the HUD (health, armour,
// cash, wanted stars, weapon, mission objective, speed and clock) and the
// minimap. No game logic here.
import { CAR, FONT, FONT_DISPLAY, PALETTE, ROAD, WORLD } from './config.js';
import { MISSIONS, currentObjective } from './missions.js';
import { clamp, lerp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0 };
  let titlePan = 0;

  function followCamera(state, screen) {
    const p = state.player;
    if (screen === SCREEN_TITLE) {
      titlePan += 0.0004;
      const cx = 1280 + Math.cos(titlePan) * 500;
      const cy = 1280 + Math.sin(titlePan * 0.7) * 500;
      cam.x = clamp(cx - VIEW_W / 2, 0, WORLD.size - VIEW_W);
      cam.y = clamp(cy - VIEW_H / 2, 0, WORLD.size - VIEW_H);
      return;
    }
    const tx = clamp(p.x - VIEW_W / 2, 0, WORLD.size - VIEW_W);
    const ty = clamp(p.y - VIEW_H / 2, 0, WORLD.size - VIEW_H);
    cam.x = lerp(cam.x, tx, 0.12);
    cam.y = lerp(cam.y, ty, 0.12);
  }

  function paintGround() {
    // Grass base, dry in the sun.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.grassDry;
    for (let gx = 0; gx < 8; gx += 1) {
      for (let gy = 0; gy < 8; gy += 1) {
        if ((gx * 7 + gy * 3) % 5 === 0) ctx.fillRect(gx * 384 - cam.x, gy * 384 - cam.y, 180, 120);
      }
    }
    // Beach and ocean along the south edge.
    const beachY = WORLD.beachY - cam.y;
    const waterY = WORLD.waterY - cam.y;
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, beachY, VIEW_W, VIEW_H - beachY);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, waterY, VIEW_W, VIEW_H - waterY);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 10; i += 1) {
      const wy = waterY + 14 + i * 12;
      ctx.fillRect(0, wy, VIEW_W, 3);
    }
    // Boardwalk line on the sand.
    ctx.fillStyle = '#c9b183';
    ctx.fillRect(0, beachY + 8, VIEW_W, 6);
  }

  function paintRoads() {
    for (const line of ROAD.lines) {
      // Vertical road.
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(line - ROAD.half - cam.x, -cam.y, ROAD.half * 2, WORLD.size);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(line - ROAD.half - 10 - cam.x, -cam.y, 10, WORLD.size);
      ctx.fillRect(line + ROAD.half - cam.x, -cam.y, 10, WORLD.size);
      // Horizontal road.
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(-cam.x, line - ROAD.half - cam.y, WORLD.size, ROAD.half * 2);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(-cam.x, line - ROAD.half - 10 - cam.y, WORLD.size, 10);
      ctx.fillRect(-cam.x, line + ROAD.half - cam.y, WORLD.size, 10);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const line of ROAD.lines) {
      for (let d = 0; d < WORLD.size; d += 64) {
        ctx.fillRect(line - 2 - cam.x, d - cam.y, 4, 28);
        ctx.fillRect(d - cam.x, line - 2 - cam.y, 28, 4);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const lx of ROAD.lines) {
      for (const ly of ROAD.lines) {
        for (let s = -3; s <= 3; s += 1) {
          ctx.fillRect(lx + s * 9 - 3 - cam.x, ly - ROAD.half - 2 - cam.y, 6, 10);
          ctx.fillRect(lx + s * 9 - 3 - cam.x, ly + ROAD.half - 8 - cam.y, 6, 10);
          ctx.fillRect(lx - ROAD.half - 2 - cam.x, ly + s * 9 - 3 - cam.y, 10, 6);
          ctx.fillRect(lx + ROAD.half - 8 - cam.x, ly + s * 9 - 3 - cam.y, 10, 6);
        }
      }
    }
  }

  function paintCity(state) {
    const { city } = state;
    for (const park of city.parks) {
      ctx.fillStyle = '#6da34f';
      ctx.fillRect(park.x0 - cam.x, park.y0 - cam.y, park.w, park.h);
      ctx.fillStyle = '#5a8f43';
      ctx.fillRect(park.x0 + 14 - cam.x, park.y0 + 14 - cam.y, park.w - 28, park.h - 28);
    }
    for (const lot of city.lots) {
      ctx.fillStyle = '#4a4642';
      ctx.fillRect(lot.x0 - cam.x, lot.y0 - cam.y, lot.w, lot.h);
      ctx.strokeStyle = '#d8d2c4';
      ctx.lineWidth = 2;
      for (let x = lot.x0 + 30; x < lot.x1 - 20; x += 44) {
        ctx.strokeRect(x - cam.x, lot.y0 + 16 - cam.y, 30, 18);
      }
    }
    for (const b of city.buildings) {
      // Long sunset shadow to the east.
      ctx.fillStyle = 'rgba(40, 20, 10, 0.28)';
      ctx.fillRect(b.x + 8 + b.height * 5 - cam.x, b.y + 8 + b.height * 4 - cam.y, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(b.x + 3 - cam.x, b.y + 3 - cam.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 4 - cam.x, b.y + 4 - cam.y, b.w - 8, b.h - 8);
      if (b.windows) {
        ctx.fillStyle = 'rgba(255, 240, 200, 0.75)';
        const cols = Math.max(1, Math.floor(b.w / 26));
        const rows = Math.max(1, Math.floor(b.h / 26));
        for (let i = 0; i < cols; i += 1) {
          for (let j = 0; j < rows; j += 1) {
            if ((i * 3 + j * 7 + b.height) % 4 === 0) continue;
            ctx.fillRect(b.x + 10 + i * 26 - cam.x, b.y + 10 + j * 26 - cam.y, 12, 9);
          }
        }
      }
      if (b.kind === 'landmark') {
        ctx.fillStyle = '#1c2733';
        ctx.font = `bold 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2 - cam.x, b.y + b.h / 2 + 5 - cam.y);
        ctx.textAlign = 'left';
      }
    }
    for (const t of city.trees) {
      ctx.fillStyle = 'rgba(40, 20, 10, 0.25)';
      ctx.beginPath();
      ctx.arc(t.x + 8 - cam.x, t.y + 8 - cam.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.shade ? PALETTE.parkTree : PALETTE.parkTree2;
      ctx.beginPath();
      ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - 4 - cam.x, t.y - 4 - cam.y, t.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintPickup(pk) {
    const x = pk.x - cam.x;
    const y = pk.y - cam.y + Math.sin(pk.bob) * 3;
    const colors = { cash: '#2ecc71', health: '#ffffff', armor: '#3498db', ammo: '#f39c12' };
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, pk.y - cam.y + 10, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors[pk.kind] ?? '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1c2733';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '»', x, y + 5);
    ctx.textAlign = 'left';
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function paintCar(car) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width);
    // Body.
    ctx.fillStyle = car.color;
    roundedRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    // Roof and windows.
    ctx.fillStyle = 'rgba(20, 30, 40, 0.85)';
    roundedRect(-CAR.length / 2 + 12, -CAR.width / 2 + 4, CAR.length - 26, CAR.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.5)';
    roundedRect(-CAR.length / 2 + 15, -CAR.width / 2 + 6, 10, CAR.width - 12, 3);
    ctx.fill();
    // Headlights and taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 2, 3, 5);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 7, 3, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 2, 3, 5);
    ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 7, 3, 5);
    if (car.driver === 'police') {
      // Light bar, flashing with the clock.
      const on = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = on ? '#ff2d2d' : '#2d7dff';
      ctx.fillRect(-6, -CAR.width / 2 - 2, 12, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      ctx.textAlign = 'left';
    }
    if (car.driver === 'player') {
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      roundedRect(-CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4, 8);
      ctx.stroke();
    }
    ctx.restore();
    if (car.smoke > 0) {
      ctx.fillStyle = 'rgba(80,80,80,0.5)';
      ctx.beginPath();
      ctx.arc(x - Math.cos(car.angle) * 16, y - Math.sin(car.angle) * 16, 8 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintPerson(x, y, angle, shirt, skin, isCop) {
    const sx = x - cam.x;
    const sy = y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx + 3, sy + 4, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = PALETTE.copHat;
      ctx.beginPath();
      ctx.arc(5, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5c542';
      ctx.fillRect(2, -6, 6, 2);
    }
    ctx.restore();
  }

  function paintPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    // A gold ring marks the player on foot, so he reads at a glance.
    ctx.strokeStyle = '#f5c542';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, 17, 0, Math.PI * 2);
    ctx.stroke();
    paintPerson(p.x, p.y, p.angle, PALETTE.playerJacket, '#f1c27d', false);
    // Gun in hand when armed.
    if (p.weapon === 'pistol') {
      const gx = p.x - cam.x + Math.cos(p.angle) * 14;
      const gy = p.y - cam.y + Math.sin(p.angle) * 14;
      ctx.strokeStyle = '#1c2733';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - cam.x + Math.cos(p.angle) * 8, p.y - cam.y + Math.sin(p.angle) * 8);
      ctx.lineTo(gx, gy);
      ctx.stroke();
    }
    if (p.hurtT > 0) {
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function paintParticles(state) {
    for (const pt of state.particles) {
      if (pt.tracer) {
        ctx.strokeStyle = 'rgba(255, 233, 168, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pt.x - cam.x, pt.y - cam.y);
        ctx.lineTo(pt.tracer.x - cam.x, pt.tracer.y - cam.y);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = clamp(pt.life / (pt.max || 0.8), 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintMissionMarker(state) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return;
    const stepDef = mission.steps[state.stepIndex];
    if (!stepDef || !stepDef.target) return;
    const lm = state.city.landmarks[stepDef.target];
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    const x = lm.x - cam.x;
    const y = lm.y - cam.y;
    ctx.save();
    ctx.translate(x, y - 46 * pulse);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-11, -8);
    ctx.lineTo(11, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // A guiding line from the player to the marker, faint.
    const p = state.player;
    ctx.strokeStyle = 'rgba(245, 197, 66, 0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(p.x - cam.x, p.y - cam.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function paintLighting(state) {
    // Golden hour: warm wash, deepening as the clock runs toward evening.
    const hour = (state.clock / 3600) % 24;
    const evening = hour > 17 ? clamp((hour - 17) / 2, 0, 1) : 0;
    ctx.fillStyle = PALETTE.sunset;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (evening > 0) {
      ctx.fillStyle = `rgba(20, 30, 80, ${0.16 * evening})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Vignette.
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function hudPanel(x, y, w, h) {
    ctx.fillStyle = PALETTE.hudPanel;
    roundedRect(x, y, w, h, 8);
    ctx.fill();
  }

  function hudBar(x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundedRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = color;
    if (frac > 0) {
      roundedRect(x + 1, y + 1, (w - 2) * clamp(frac, 0, 1), h - 2, 3);
      ctx.fill();
    }
  }

  function paintHud(state) {
    const p = state.player;
    ctx.font = `14px ${FONT}`;
    // Top-left: health, armour, cash.
    hudPanel(14, 14, 250, 84);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText('HEALTH', 26, 34);
    hudBar(92, 24, 156, 12, p.health / 100, '#2ecc71');
    ctx.fillText('ARMOUR', 26, 56);
    hudBar(92, 46, 156, 12, p.armor / 50, '#3498db');
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 26, 86);
    ctx.font = `14px ${FONT}`;
    // Top-right: wanted stars.
    hudPanel(VIEW_W - 214, 14, 200, 44);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText('WANTED', VIEW_W - 202, 34);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.hudGold : 'rgba(255,255,255,0.25)';
      ctx.font = '20px sans-serif';
      ctx.fillText('★', VIEW_W - 128 + i * 24, 36);
    }
    ctx.font = `14px ${FONT}`;
    // Mission objective, top centre.
    const objective = currentObjective(state.missionIndex, state.stepIndex);
    ctx.font = `bold 15px ${FONT}`;
    const ow = ctx.measureText(objective).width + 28;
    hudPanel((VIEW_W - ow) / 2, 14, ow, 34);
    ctx.fillStyle = PALETTE.hudGold;
    ctx.textAlign = 'center';
    ctx.fillText(objective, VIEW_W / 2, 36);
    ctx.textAlign = 'left';
    ctx.font = `14px ${FONT}`;
    // Bottom-right: weapon and ammo, speed when driving.
    hudPanel(VIEW_W - 214, VIEW_H - 64, 200, 50);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(p.weapon === 'pistol' ? 'PISTOL' : 'FISTS', VIEW_W - 202, VIEW_H - 42);
    ctx.fillStyle = PALETTE.hudGold;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(p.weapon === 'pistol' ? `AMMO ${p.ammo}` : '—', VIEW_W - 202, VIEW_H - 22);
    ctx.font = `14px ${FONT}`;
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car) {
        hudPanel(VIEW_W - 214, VIEW_H - 122, 200, 50);
        ctx.fillStyle = PALETTE.hudText;
        ctx.fillText(car.model.toUpperCase(), VIEW_W - 202, VIEW_H - 100);
        hudBar(VIEW_W - 202, VIEW_H - 92, 176, 10, car.health / 100, '#e74c3c');
        ctx.fillStyle = PALETTE.hudGold;
        ctx.font = `bold 17px ${FONT}`;
        ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.24)} km/h`, VIEW_W - 202, VIEW_H - 66);
        ctx.font = `14px ${FONT}`;
      }
    }
    // Clock.
    const hour = Math.floor((state.clock / 3600) % 24);
    const min = Math.floor((state.clock / 60) % 60);
    hudPanel(14, VIEW_H - 50, 110, 36);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, 26, VIEW_H - 26);
    // Message toast.
    if (state.messageT > 0 && state.message) {
      ctx.font = `bold 17px ${FONT}`;
      const mw = ctx.measureText(state.message).width + 32;
      hudPanel((VIEW_W - mw) / 2, 60, mw, 36);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW_W / 2, 84);
      ctx.textAlign = 'left';
      ctx.font = `14px ${FONT}`;
    }
    // Controls hint, bottom-left.
    ctx.fillStyle = 'rgba(245, 239, 228, 0.75)';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('WASD move / drive · E enter car · F punch · Mouse aim + click shoot · Shift sprint · P pause · M mute', 14, VIEW_H - 58);
  }

  function paintMinimap(state) {
    const size = 190;
    const x0 = VIEW_W - size - 14;
    const y0 = 68;
    const scale = size / WORLD.size;
    hudPanel(x0 - 6, y0 - 6, size + 12, size + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = PALETTE.minimapWater;
    ctx.fillRect(x0, y0 + WORLD.beachY * scale, size, size - WORLD.beachY * scale);
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 2;
    for (const line of ROAD.lines) {
      ctx.beginPath();
      ctx.moveTo(x0 + line * scale, y0);
      ctx.lineTo(x0 + line * scale, y0 + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, y0 + line * scale);
      ctx.lineTo(x0 + size, y0 + line * scale);
      ctx.stroke();
    }
    // Landmarks.
    ctx.fillStyle = '#f5c542';
    for (const lm of Object.values(state.city.landmarks)) {
      ctx.fillRect(x0 + lm.x * scale - 2, y0 + lm.y * scale - 2, 4, 4);
    }
    // Mission marker.
    const mission = MISSIONS[state.missionIndex];
    if (mission) {
      const stepDef = mission.steps[state.stepIndex];
      if (stepDef && stepDef.target) {
        const lm = state.city.landmarks[stepDef.target];
        ctx.fillStyle = '#ffdf3d';
        ctx.beginPath();
        ctx.arc(x0 + lm.x * scale, y0 + lm.y * scale, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1c2733';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // Police.
    ctx.fillStyle = '#ff2d2d';
    for (const car of state.cars) {
      if (car.driver === 'police' && !car.dead) {
        ctx.beginPath();
        ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const cop of state.cops) {
      ctx.beginPath();
      ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('SOLMARA', x0, y0 + size + 24);
  }

  function paintTitle(state, best) {
    ctx.fillStyle = 'rgba(10, 6, 4, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5c542';
    ctx.font = `72px ${FONT_DISPLAY}`;
    ctx.fillText('SOLMARA HEAT', VIEW_W / 2, 210);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText('An open-world crime game in the spirit of GTA 6', VIEW_W / 2, 252);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = '#f5efe4';
    ctx.fillText('Steal cars. Outrun the Solmara PD. Pull off the biggest job the city has ever seen.', VIEW_W / 2, 286);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#f5c542';
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText('— PRESS ENTER TO PLAY —', VIEW_W / 2, 350);
    }
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = '#e8e4da';
    const lines = [
      'WASD / Arrows — move and drive      E — enter / exit a car      F — punch',
      'Mouse — aim      Click / Space — shoot      Shift — sprint / handbrake',
      'Missions: Fresh Wheels · Hot Wheels · The Pickup · The Solmara Job',
      'P pause      M mute      Progress saves automatically',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 420 + i * 26));
    if (best > 0) {
      ctx.fillStyle = '#f5c542';
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText(`Best haul so far: $${best.toLocaleString('en-US')}`, VIEW_W / 2, 560);
    }
    ctx.textAlign = 'left';
  }

  function paintPaused() {
    ctx.fillStyle = 'rgba(10, 6, 4, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `48px ${FONT_DISPLAY}`;
    ctx.fillText('PAUSED', VIEW_W / 2, 330);
    ctx.font = `18px ${FONT}`;
    ctx.fillText('Press P to keep playing', VIEW_W / 2, 372);
    ctx.textAlign = 'left';
  }

  function paintOver(state, best) {
    ctx.fillStyle = 'rgba(10, 6, 4, 0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = state.overReason === 'WASTED' ? '#e74c3c' : '#f5c542';
    ctx.font = `64px ${FONT_DISPLAY}`;
    ctx.fillText(state.overReason, VIEW_W / 2, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = `20px ${FONT}`;
    ctx.fillText(state.overReason === 'WASTED' ? 'Solmara got the better of you.' : 'The Solmara PD has you. The job will have to wait.', VIEW_W / 2, 344);
    ctx.fillText(`Cash kept: $${state.cash.toLocaleString('en-US')}    Best: $${Math.max(best, state.cash).toLocaleString('en-US')}`, VIEW_W / 2, 380);
    ctx.fillStyle = '#f5c542';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('PRESS ENTER TO TRY AGAIN', VIEW_W / 2, 440);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, best) {
    followCamera(state, screen);
    paintGround();
    paintRoads();
    paintCity(state);
    for (const pk of state.pickups) if (!pk.taken) paintPickup(pk);
    for (const car of state.cars) if (!car.dead) paintCar(car);
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (ped.state === 'down') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ped.x - cam.x, ped.y - cam.y, 12, 5, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      paintPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.skin, false);
    }
    for (const cop of state.cops) paintPerson(cop.x, cop.y, cop.angle, '#1c2733', '#e0ac69', true);
    paintPlayer(state);
    paintMissionMarker(state);
    paintParticles(state);
    paintLighting(state);
    if (screen === SCREEN_TITLE) {
      paintTitle(state, best);
      return;
    }
    paintHud(state);
    paintMinimap(state);
    if (screen === SCREEN_PAUSED) paintPaused();
    if (screen === SCREEN_OVER) paintOver(state, best);
  }

  return {
    draw,
    // Jump the camera straight to the player (screenshot scenes paint twice only).
    snapToPlayer(state) {
      const p = state.player;
      cam.x = clamp(p.x - VIEW_W / 2, 0, WORLD.size - VIEW_W);
      cam.y = clamp(p.y - VIEW_H / 2, 0, WORLD.size - VIEW_H);
    },
    screenToWorld(sx, sy) {
      return { x: sx + cam.x, y: sy + cam.y };
    },
    camera() {
      return { x: cam.x, y: cam.y };
    },
  };
}
