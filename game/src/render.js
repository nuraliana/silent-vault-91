// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Vision cones are raycast: each cone is a fan of rays
// that stops at the first wall, case, vault or pillar, so furniture really does
// block sight. Flat shapes and canvas text for the HUD, the planning board and
// the panels.
import { FIELD, FONT, PALETTE, PLAN_LAYOUT, ROOM, TOOLS } from './config.js';
import { ENTRIES, EXIT, LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAN = 'plan';
export const SCREEN_PLAY = 'play';
export const SCREEN_DONE = 'done';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const CONE_RAYS = 24;

/** Ray vs rectangle: the distance along the ray to the first hit, or Infinity. */
function rayRect(ox, oy, dx, dy, rx, ry, rw, rh) {
  let tMin = 0;
  let tMax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < rx || ox > rx + rw) return Infinity;
  } else {
    let t1 = (rx - ox) / dx;
    let t2 = (rx + rw - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < ry || oy > ry + rh) return Infinity;
  } else {
    let t1 = (ry - oy) / dy;
    let t2 = (ry + rh - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  return tMin >= 0 ? tMin : Infinity;
}

/** Ray vs circle: the distance along the ray to the first hit, or Infinity. */
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const ex = cx - ox;
  const ey = cy - oy;
  const proj = ex * dx + ey * dy;
  if (proj < 0) return Infinity;
  const perp2 = ex * ex + ey * ey - proj * proj;
  if (perp2 > r * r) return Infinity;
  const hit = proj - Math.sqrt(r * r - perp2);
  return hit >= 0 ? hit : Infinity;
}

/** The nearest solid hit along a ray, in px (Infinity when nothing is hit). */
function rayHit(level, ox, oy, dx, dy) {
  let best = Infinity;
  const solids = [];
  for (const w of level.walls) solids.push(w);
  for (const c of level.cases) solids.push(c);
  if (level.statueCase) solids.push(level.statueCase);
  if (level.vault) solids.push(level.vault);
  for (const s of solids) {
    const t = rayRect(ox, oy, dx, dy, s.x, s.y, s.w, s.h);
    if (t < best) best = t;
  }
  for (const p of level.pillars) {
    const t = rayCircle(ox, oy, dx, dy, p.x, p.y, p.r);
    if (t < best) best = t;
  }
  // The room bounds stop a ray too.
  const bounds = [
    { x: ROOM.x0, y: ROOM.y0, w: ROOM.x1 - ROOM.x0, h: 0 },
    { x: ROOM.x0, y: ROOM.y1, w: ROOM.x1 - ROOM.x0, h: 0 },
    { x: ROOM.x0, y: ROOM.y0, w: 0, h: ROOM.y1 - ROOM.y0 },
    { x: ROOM.x1, y: ROOM.y0, w: 0, h: ROOM.y1 - ROOM.y0 },
  ];
  for (const b of bounds) {
    const t = rayRect(ox, oy, dx, dy, b.x, b.y, Math.max(b.w, 0.01), Math.max(b.h, 0.01));
    if (t < best) best = t;
  }
  return best;
}

/** The cone's outline points, raycast so walls and furniture cut it short. */
function conePoints(level, ox, oy, heading, halfAngle, range) {
  const points = [{ x: ox, y: oy }];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle = heading - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const hit = rayHit(level, ox, oy, dx, dy);
    const len = Math.min(range, hit);
    points.push({ x: ox + dx * len, y: oy + dy * len });
  }
  return points;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function rect(x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function drawCone(level, ox, oy, heading, halfAngle, range, fill) {
    const points = conePoints(level, ox, oy, heading, halfAngle, range);
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.closePath();
    context.fill();
  }

  function drawRoom(state) {
    const lv = LEVELS[state.levelIndex];
    // Floor.
    rect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0, PALETTE.floor);
    context.fillStyle = PALETTE.floorAlt;
    for (let y = ROOM.y0; y < ROOM.y1; y += 64) {
      for (let x = ROOM.x0; x < ROOM.x1; x += 64) {
        if (((x + y) / 64) % 2 === 0) context.fillRect(x, y, 64, 64);
      }
    }
    // Room border.
    context.strokeStyle = PALETTE.wallTop;
    context.lineWidth = 4;
    context.strokeRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0);
    // Walls.
    for (const w of lv.walls) {
      rect(w.x, w.y, w.w, w.h, PALETTE.wall);
      rect(w.x, w.y, w.w, 4, PALETTE.wallTop);
    }
    // Display cases.
    for (const c of lv.cases) {
      rect(c.x, c.y, c.w, c.h, PALETTE.case);
      rect(c.x + 4, c.y + 4, c.w - 8, c.h - 8, PALETTE.caseGlass);
    }
    if (lv.statueCase) {
      const s = lv.statueCase;
      rect(s.x, s.y, s.w, s.h, PALETTE.case);
      rect(s.x + 4, s.y + 4, s.w - 8, s.h - 8, PALETTE.caseGlass);
    }
    // Pillars.
    for (const p of lv.pillars) {
      circle(p.x, p.y, p.r, PALETTE.wall);
      circle(p.x, p.y, p.r - 5, PALETTE.wallTop);
    }
    // Vault.
    if (lv.vault) {
      const v = lv.vault;
      rect(v.x, v.y, v.w, v.h, state.vaultOpen ? PALETTE.vaultDoor : PALETTE.vault);
      context.strokeStyle = PALETTE.vaultDoor;
      context.lineWidth = 3;
      context.strokeRect(v.x, v.y, v.w, v.h);
      if (state.vaultOpen) {
        text('OPEN', v.x + v.w / 2, v.y + v.h / 2 + 6, 16, PALETTE.text, 'center', 'middle');
      } else if (state.vaultProgress > 0) {
        const bw = v.w - 16;
        rect(v.x + 8, v.y + v.h - 14, bw, 8, PALETTE.panel);
        rect(v.x + 8, v.y + v.h - 14, bw * state.vaultProgress, 8, PALETTE.lootGold);
      }
    }
    // Exit (service door, bottom-left): green once the main loot is taken.
    const exitColor = state.exitOpen ? PALETTE.exitOpen : PALETTE.exit;
    rect(EXIT.x - EXIT.w / 2, EXIT.y - EXIT.h / 2, EXIT.w, EXIT.h, exitColor);
    text('EXIT', EXIT.x, EXIT.y + 5, 15, PALETTE.text, 'center', 'middle');
    // Side loot.
    for (const item of state.sideLoot) {
      if (item.taken) continue;
      if (item.kind === 'gold') {
        circle(item.x, item.y, 9, PALETTE.lootGold);
        circle(item.x, item.y, 5, '#fff2b0');
      } else {
        rect(item.x - 11, item.y - 8, 22, 16, PALETTE.lootPainting);
        rect(item.x - 7, item.y - 4, 14, 8, '#dfeefc');
      }
    }
    // Main target.
    if (!state.targetTaken && (lv.vault === null || state.vaultOpen)) {
      circle(lv.target.x, lv.target.y, 12, PALETTE.target);
      circle(lv.target.x, lv.target.y, 6, '#d8ffe9');
    }
    // Smoke cloud.
    if (state.smoke !== null && state.smoke.timer > 0) {
      circle(state.smoke.x, state.smoke.y, TOOLS.smoke.radius, PALETTE.smoke);
    }
    // Cameras and their cones.
    for (const c of state.cameras) {
      if (c.disabled <= 0) {
        drawCone(lv, c.x, c.y, c.angle, 0.55, 230, PALETTE.cameraCone);
      }
      circle(c.x, c.y, 8, c.disabled > 0 ? PALETTE.muted : PALETTE.camera);
      circle(c.x, c.y, 3, '#ffffff');
    }
    // Guards and their cones.
    for (const g of state.guards) {
      const chasing = g.mode === 'chase';
      drawCone(lv, g.x, g.y, g.angle, 0.61, g.range, chasing ? PALETTE.coneChase : PALETTE.cone);
      circle(g.x, g.y, 14, chasing ? PALETTE.guardChase : PALETTE.guard);
      circle(g.x, g.y, 5, '#ffffff');
      if (chasing) text('!', g.x, g.y - 22, 22, PALETTE.danger, 'center', 'middle');
    }
    // The thief.
    const t = state.thief;
    const blink = t.grace > 0 && Math.floor(t.grace * 10) % 2 === 0;
    if (!blink) {
      circle(t.x, t.y, t.r, t.sneaking ? PALETTE.thiefSneak : PALETTE.thief);
      circle(t.x, t.y, 4, '#1a1d27');
    }
  }

  function drawHud(state) {
    const lv = LEVELS[state.levelIndex];
    rect(0, 0, FIELD.width, 56, PALETTE.panel);
    rect(0, 56, FIELD.width, 2, PALETTE.panelEdge);
    text(`Room ${state.levelIndex + 1} — ${lv.name}`, 16, 20, 20, PALETTE.text, 'left', 'middle');
    text(state.targetTaken ? 'Escape!' : `Steal: ${lv.target.name}`, 16, 46, 13, PALETTE.muted, 'left', 'middle');
    // Alarm meter, centre.
    const alarmLabel = state.lockdown ? 'LOCKDOWN' : state.alarm >= 70 ? 'ALERT' : 'ALARM';
    const alarmColor = state.lockdown ? PALETTE.alarmLock : state.alarm >= 70 ? PALETTE.alarmAlert : PALETTE.alarm;
    text(alarmLabel, 640, 14, 14, alarmColor, 'center', 'top');
    rect(520, 32, 240, 12, PALETTE.backdrop);
    rect(520, 32, 240 * (state.alarm / 100), 12, alarmColor);
    // Loot, time, lives, right.
    const mm = Math.floor(state.timeLeft / 60);
    const ss = Math.floor(state.timeLeft % 60).toString().padStart(2, '0');
    text(`$${state.loot.toLocaleString('en-US')}`, 1010, 34, 20, PALETTE.lootGold, 'right', 'middle');
    text(`${mm}:${ss}`, 1120, 34, 20, PALETTE.text, 'right', 'middle');
    text(`♥`.repeat(state.lives), 1240, 34, 20, PALETTE.guardChase, 'right', 'middle');
    // Bottom strip: tool and keys.
    const toolName = state.toolId === 'smoke' ? 'Smoke Bomb' : state.toolId === 'emp' ? 'EMP Pulse' : 'Lockpick Kit';
    const toolState = state.toolUsed ? ' (used)' : ' (Q)';
    text(`Tool: ${toolName}${state.toolId === 'lockpick' ? '' : toolState}`, 16, 706, 15, PALETTE.muted, 'left', 'middle');
    text('WASD move · Shift sneak · E crack vault · Q tool · P pause · M mute', 1264, 706, 15, PALETTE.muted, 'right', 'middle');
  }

  function drawPlan(state) {
    const lv = LEVELS[state.levelIndex];
    const board = PLAN_LAYOUT.board;
    rect(0, 0, FIELD.width, FIELD.height, PALETTE.backdrop);
    text('PLAN THE HEIST', 60, 60, 34, PALETTE.text, 'left', 'middle');
    text(`Room ${state.levelIndex + 1} — ${lv.name} · Target: ${lv.target.name} ($${lv.target.value.toLocaleString('en-US')})`, 60, 84, 16, PALETTE.muted, 'left', 'middle');
    // Floor plan, scaled.
    const scale = Math.min(board.w / (ROOM.x1 - ROOM.x0), board.h / (ROOM.y1 - ROOM.y0));
    const ox = board.x + (board.w - (ROOM.x1 - ROOM.x0) * scale) / 2;
    const oy = board.y + (board.h - (ROOM.y1 - ROOM.y0) * scale) / 2;
    const px = (x) => ox + (x - ROOM.x0) * scale;
    const py = (y) => oy + (y - ROOM.y0) * scale;
    rect(board.x, board.y, board.w, board.h, PALETTE.floor);
    context.strokeStyle = PALETTE.wallTop;
    context.lineWidth = 2;
    context.strokeRect(board.x, board.y, board.w, board.h);
    for (const w of lv.walls) context.fillStyle = PALETTE.wall, context.fillRect(px(w.x), py(w.y), w.w * scale, w.h * scale);
    for (const c of lv.cases) context.fillStyle = PALETTE.case, context.fillRect(px(c.x), py(c.y), c.w * scale, c.h * scale);
    if (lv.statueCase) context.fillStyle = PALETTE.case, context.fillRect(px(lv.statueCase.x), py(lv.statueCase.y), lv.statueCase.w * scale, lv.statueCase.h * scale);
    if (lv.vault) context.fillStyle = PALETTE.vault, context.fillRect(px(lv.vault.x), py(lv.vault.y), lv.vault.w * scale, lv.vault.h * scale);
    for (const p of lv.pillars) {
      context.fillStyle = PALETTE.wall;
      context.beginPath();
      context.arc(px(p.x), py(p.y), p.r * scale, 0, Math.PI * 2);
      context.fill();
    }
    // Patrol dotted lines.
    context.strokeStyle = PALETTE.guard;
    context.lineWidth = 1.5;
    context.setLineDash([4, 5]);
    for (const g of lv.guards) {
      context.beginPath();
      g.waypoints.forEach((wp, i) => {
        if (i === 0) context.moveTo(px(wp.x), py(wp.y));
        else context.lineTo(px(wp.x), py(wp.y));
      });
      context.closePath();
      context.stroke();
    }
    context.setLineDash([]);
    // Camera dots.
    for (const c of lv.cameras) {
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(px(c.x), py(c.y), 5, 0, Math.PI * 2);
      context.fill();
    }
    // Target, exit, entries.
    context.fillStyle = PALETTE.target;
    context.beginPath();
    context.arc(px(lv.target.x), py(lv.target.y), 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.exitOpen;
    context.fillRect(px(EXIT.x) - 8, py(EXIT.y) - 6, 16, 12);
    for (const e of ENTRIES) {
      context.fillStyle = state.entryId === e.id ? PALETTE.thief : PALETTE.muted;
      context.beginPath();
      context.arc(px(e.x), py(e.y), 6, 0, Math.PI * 2);
      context.fill();
    }
    // Entry cards.
    for (const card of PLAN_LAYOUT.entryCards) {
      const entry = ENTRIES.find((e) => e.id === card.id);
      const picked = state.entryId === card.id;
      rect(card.x, card.y, card.w, card.h, picked ? '#2a2f3d' : PALETTE.panel);
      context.strokeStyle = picked ? PALETTE.thief : PALETTE.panelEdge;
      context.lineWidth = picked ? 3 : 1;
      context.strokeRect(card.x, card.y, card.w, card.h);
      text(entry.name, card.x + 20, card.y + 30, 22, PALETTE.text, 'left', 'middle');
      text(
        entry.id === 'skylight' ? 'Drop in from the roof, far from the door.' : 'Slip in by the exit, close to the getaway.',
        card.x + 20, card.y + 62, 15, PALETTE.muted, 'left', 'middle',
      );
      if (picked) text('PICKED', card.x + card.w - 20, card.y + 30, 16, PALETTE.thief, 'right', 'middle');
    }
    // Tool cards.
    const toolDescs = {
      smoke: ['Smoke Bomb', 'A cloud no cone can see through (6 s).'],
      emp: ['EMP Pulse', 'Cameras off 8 s, guards frozen 2 s, +15 alarm.'],
      lockpick: ['Lockpick Kit', 'Crack twice as fast, silent side loot.'],
    };
    for (const card of PLAN_LAYOUT.toolCards) {
      const picked = state.toolId === card.id;
      rect(card.x, card.y, card.w, card.h, picked ? '#2a2f3d' : PALETTE.panel);
      context.strokeStyle = picked ? PALETTE.thief : PALETTE.panelEdge;
      context.lineWidth = picked ? 3 : 1;
      context.strokeRect(card.x, card.y, card.w, card.h);
      text(toolDescs[card.id][0], card.x + 20, card.y + 24, 19, PALETTE.text, 'left', 'middle');
      text(toolDescs[card.id][1], card.x + 20, card.y + 50, 14, PALETTE.muted, 'left', 'middle');
      if (picked) text('PICKED', card.x + card.w - 20, card.y + 24, 15, PALETTE.thief, 'right', 'middle');
    }
    // BEGIN button.
    const b = PLAN_LAYOUT.begin;
    rect(b.x, b.y, b.w, b.h, PALETTE.thief);
    text('BEGIN →', b.x + b.w / 2, b.y + b.h / 2 + 1, 24, '#1a1d27', 'center', 'middle');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    rect(x, y, width, height, PALETTE.panel);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 74, 44, PALETTE.text, 'center', 'middle');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 132 + i * 34, 21, PALETTE.muted, 'center', 'middle');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.lootGold, 'center', 'middle');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (screen === SCREEN_PLAN) {
      drawPlan(state);
      return;
    }
    if (screen === SCREEN_TITLE) {
      drawRoom(state);
      drawHud(state);
      drawPanel(
        'MIDNIGHT VAULT',
        ['The Meridian Heist — three rooms, one diamond.', 'Sneak past the guards. Crack the vaults. Get out clean.', `Best score: $${best.toLocaleString('en-US')}`],
        'Press Space or click to plan the heist',
      );
      return;
    }
    drawRoom(state);
    drawHud(state);
    if (screen === SCREEN_DONE) {
      const lv = LEVELS[state.levelIndex];
      drawPanel(
        'ROOM CLEARED',
        [`${lv.name} — loot $${state.loot.toLocaleString('en-US')}.`, `Time bonus: +$${state.timeBonus.toLocaleString('en-US')}.`],
        'Press Space for the next room',
        PALETTE.target,
      );
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel(
        'CAUGHT!',
        [`The guards got you. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`, 'The room resets — the loot stays where it was.'],
        'Press Space to try the room again',
        PALETTE.danger,
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'THE MERIDIAN HEIST',
        [
          `Loot: $${state.score.toLocaleString('en-US')}.`,
          `Ghost bonus: +$${state.ghostBonus.toLocaleString('en-US')} · Clean bonus: +$${state.cleanBonus.toLocaleString('en-US')}.`,
          `Final score: $${state.finalScore.toLocaleString('en-US')}.`,
        ],
        'Press Space to run it again',
        PALETTE.target,
      );
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards wait for no one — except now.'], 'Press P to keep going');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'GAME OVER',
        [`Score: $${state.score.toLocaleString('en-US')}.`, 'The Meridian keeps its diamond. This time.'],
        'Press Space to plan a new heist',
        PALETTE.danger,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
