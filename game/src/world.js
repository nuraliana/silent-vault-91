// The game's rules and state, with no drawing and no browser in it: the thief, the
// guards and their vision cones with raycast line-of-sight, the cameras, the alarm,
// vault cracking, loot, tools, lives, timer and scoring. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (and play
// sounds) without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import {
  ALARM, CAMERA, FIELD, GRAB_RANGE, GUARD, LEVEL_TIME, LIVES, LOOT_RANGE,
  PLAN_LAYOUT, ROOM, SCORE, STEP, THIEF, TOOLS, VAULT,
} from './config.js';
import { ENTRIES, EXIT, LEVELS } from './levels.js';

export const EVENT_LOOT = 1;
export const EVENT_VAULT_OPEN = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_DONE = 16;
export const EVENT_WIN = 32;
export const EVENT_OVER = 64;
export const EVENT_CRACK = 128;
export const EVENT_TOOL = 256;

export const PHASE_TITLE = 'title';
export const PHASE_PLAN = 'plan';
export const PHASE_PLAY = 'play';
export const PHASE_DONE = 'done';
export const PHASE_CAUGHT = 'caught';
export const PHASE_WIN = 'win';
export const PHASE_OVER = 'over';

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Smallest absolute angle between two headings, in radians. */
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return Math.abs(d);
}

/** Whether a point is inside a cone (range + half-angle around a heading). */
export function inCone(ox, oy, heading, halfAngle, range, tx, ty) {
  const d = dist(ox, oy, tx, ty);
  if (d > range) return false;
  if (d < 1e-6) return true;
  const want = Math.atan2(ty - oy, tx - ox);
  return angleDiff(want, heading) <= halfAngle;
}

/** Whether segment (x1,y1)-(x2,y2) hits the rectangle (rx,ry,rw,rh). */
function segmentHitsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const inside = (x, y) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Check each of the four edges for an intersection.
  const edges = [
    [rx, ry, rx + rw, ry],
    [rx + rw, ry, rx + rw, ry + rh],
    [rx + rw, ry + rh, rx, ry + rh],
    [rx, ry + rh, rx, ry],
  ];
  for (const [ex1, ey1, ex2, ey2] of edges) {
    const den = dx * (ey2 - ey1) - dy * (ex2 - ex1);
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ex1 - x1) * (ey2 - ey1) - (ey1 - y1) * (ex2 - ex1)) / den;
    const u = ((ex1 - x1) * dy - (ey1 - y1) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/** Whether segment (x1,y1)-(x2,y2) hits the circle (cx,cy,r). */
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return dist(x1, y1, cx, cy) <= r;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return dist(px, py, cx, cy) <= r;
}

/** Whether a sight line is blocked by a wall, case, vault or pillar of the level. */
export function lineBlocked(level, x1, y1, x2, y2) {
  for (const w of level.walls) if (segmentHitsRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return true;
  for (const c of level.cases) if (segmentHitsRect(x1, y1, x2, y2, c.x, c.y, c.w, c.h)) return true;
  if (level.statueCase) {
    const s = level.statueCase;
    if (segmentHitsRect(x1, y1, x2, y2, s.x, s.y, s.w, s.h)) return true;
  }
  if (level.vault) {
    const v = level.vault;
    if (segmentHitsRect(x1, y1, x2, y2, v.x, v.y, v.w, v.h)) return true;
  }
  for (const p of level.pillars) if (segmentHitsCircle(x1, y1, x2, y2, p.x, p.y, p.r)) return true;
  return false;
}

/** Whether the thief is hidden inside the smoke cloud. */
function inSmoke(state, x, y) {
  const s = state.smoke;
  return s !== null && s.timer > 0 && dist(x, y, s.x, s.y) <= TOOLS.smoke.radius;
}

export function guardSeesThief(level, guard, thief, smokeHidden) {
  if (smokeHidden) return false;
  if (guard.frozen > 0) return false;
  if (!inCone(guard.x, guard.y, guard.angle, GUARD.halfAngle, guard.range, thief.x, thief.y)) return false;
  return !lineBlocked(level, guard.x, guard.y, thief.x, thief.y);
}

export function cameraSeesThief(level, camera, thief, smokeHidden) {
  if (smokeHidden) return false;
  if (camera.disabled > 0) return false;
  if (!inCone(camera.x, camera.y, camera.angle, CAMERA.halfAngle, camera.range, thief.x, thief.y)) return false;
  return !lineBlocked(level, camera.x, camera.y, thief.x, thief.y);
}

/** Circle-vs-rectangle overlap (the thief against a solid box). */
function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  return dist(cx, cy, nx, ny) < r;
}

export function createWorld(random) {
  const state = {
    phase: PHASE_TITLE,
    paused: false,
    levelIndex: 0,
    entryId: 'skylight',
    toolId: 'smoke',
    thief: { x: 300, y: 100, r: THIEF.radius, sneaking: false, moving: false, grace: 0 },
    guards: [],
    cameras: [],
    alarm: 0,
    lockdown: false,
    loot: 0,
    score: 0,
    lives: LIVES,
    timeLeft: LEVEL_TIME,
    timeBonus: 0,
    ghost: true,
    clean: true,
    toolUsed: false,
    vaultProgress: 0,
    vaultOpen: false,
    targetTaken: false,
    exitOpen: false,
    smoke: null,
    empTimer: 0,
    sideLoot: [],
    levelResults: [],
    finalScore: 0,
    ghostBonus: 0,
    cleanBonus: 0,
    crackTick: 0,
    message: '',
    messageTimer: 0,
  };

  function level() {
    return LEVELS[state.levelIndex];
  }

  function resetLevel() {
    const lv = level();
    state.thief.x = 0;
    state.thief.y = 0;
    state.thief.sneaking = false;
    state.thief.moving = false;
    state.thief.grace = 0;
    state.guards = lv.guards.map((g) => ({
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      waypoints: g.waypoints,
      wpIndex: 1 % g.waypoints.length,
      speed: g.speed,
      range: g.range,
      angle: Math.atan2(
        g.waypoints[1 % g.waypoints.length].y - g.waypoints[0].y,
        g.waypoints[1 % g.waypoints.length].x - g.waypoints[0].x,
      ),
      mode: 'patrol',
      modeTimer: 0,
      reactTimer: 0,
      loseTimer: 0,
      lastSeenX: 0,
      lastSeenY: 0,
      frozen: 0,
      chase: false,
    }));
    state.cameras = lv.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      range: c.range,
      angle: c.baseAngle,
      sweepDir: 1,
      disabled: 0,
    }));
    state.alarm = 0;
    state.lockdown = false;
    state.timeLeft = LEVEL_TIME;
    state.timeBonus = 0;
    state.vaultProgress = 0;
    state.vaultOpen = false;
    state.targetTaken = false;
    state.exitOpen = false;
    state.smoke = null;
    state.empTimer = 0;
    state.toolUsed = false;
    state.sideLoot = lv.sideLoot.map((l) => ({ ...l }));
    state.crackTick = 0;
    state.message = '';
    state.messageTimer = 0;
  }

  function reset() {
    state.phase = PHASE_TITLE;
    state.paused = false;
    state.levelIndex = 0;
    state.entryId = 'skylight';
    state.toolId = 'smoke';
    state.loot = 0;
    state.score = 0;
    state.lives = LIVES;
    state.ghost = true;
    state.clean = true;
    state.levelResults = [];
    state.finalScore = 0;
    state.ghostBonus = 0;
    state.cleanBonus = 0;
    resetLevel();
  }

  function startHeist() {
    state.loot = 0;
    state.score = 0;
    state.lives = LIVES;
    state.ghost = true;
    state.clean = true;
    state.levelIndex = 0;
    state.levelResults = [];
    state.finalScore = 0;
    state.ghostBonus = 0;
    state.cleanBonus = 0;
    state.entryId = 'skylight';
    state.toolId = 'smoke';
    resetLevel();
    state.phase = PHASE_PLAN;
  }

  function spawnThief() {
    const entry = ENTRIES.find((e) => e.id === state.entryId) ?? ENTRIES[0];
    state.thief.x = entry.x;
    state.thief.y = entry.y;
    state.thief.grace = 0.5;
  }

  function beginLevel() {
    resetLevel();
    spawnThief();
    state.phase = PHASE_PLAY;
  }

  /** Move a circle with axis-separated collision against the room's solids. */
  function moveCircle(body, dx, dy) {
    const lv = level();
    const solids = [];
    for (const w of lv.walls) solids.push(w);
    for (const c of lv.cases) solids.push(c);
    if (lv.statueCase) solids.push(lv.statueCase);
    if (lv.vault) solids.push(lv.vault);
    // X axis.
    let nx = body.x + dx;
    nx = clamp(nx, ROOM.x0 + body.r, ROOM.x1 - body.r);
    let blocked = false;
    for (const s of solids) if (circleHitsRect(nx, body.y, body.r, s.x, s.y, s.w, s.h)) { blocked = true; break; }
    if (!blocked) for (const p of lv.pillars) if (dist(nx, body.y, p.x, p.y) < body.r + p.r) { blocked = true; break; }
    if (!blocked) body.x = nx;
    // Y axis.
    let ny = body.y + dy;
    ny = clamp(ny, ROOM.y0 + body.r, ROOM.y1 - body.r);
    blocked = false;
    for (const s of solids) if (circleHitsRect(body.x, ny, body.r, s.x, s.y, s.w, s.h)) { blocked = true; break; }
    if (!blocked) for (const p of lv.pillars) if (dist(body.x, ny, p.x, p.y) < body.r + p.r) { blocked = true; break; }
    if (!blocked) body.y = ny;
  }

  function useTool() {
    if (state.toolUsed) return 0;
    if (state.toolId === 'smoke') {
      state.smoke = { x: state.thief.x, y: state.thief.y, timer: TOOLS.smoke.duration };
      state.toolUsed = true;
      state.clean = false;
      return EVENT_TOOL;
    }
    if (state.toolId === 'emp') {
      for (const c of state.cameras) c.disabled = TOOLS.emp.cameraOff;
      for (const g of state.guards) g.frozen = TOOLS.emp.freeze;
      state.empTimer = TOOLS.emp.cameraOff;
      state.alarm = Math.min(100, state.alarm + ALARM.empCost);
      state.toolUsed = true;
      state.clean = false;
      return EVENT_TOOL;
    }
    return 0;
  }

  function stepPlan(dt, controls) {
    let events = 0;
    for (const click of controls.clicks) {
      const px = (click.x / click.w) * FIELD.width;
      const py = (click.y / click.h) * FIELD.height;
      for (const card of PLAN_LAYOUT.entryCards) {
        if (px >= card.x && px <= card.x + card.w && py >= card.y && py <= card.y + card.h) {
          state.entryId = card.id;
        }
      }
      for (const card of PLAN_LAYOUT.toolCards) {
        if (px >= card.x && px <= card.x + card.w && py >= card.y && py <= card.y + card.h) {
          state.toolId = card.id;
        }
      }
      const b = PLAN_LAYOUT.begin;
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        beginLevel();
      }
    }
    return events;
  }

  function stepPlay(dt, controls) {
    const lv = level();
    let events = 0;
    const thief = state.thief;

    // Timer.
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      return caught();
    }

    // Tool.
    if (controls.actions & 8) events |= useTool();
    if (state.smoke !== null) {
      state.smoke.timer -= dt;
      if (state.smoke.timer <= 0) state.smoke = null;
    }
    if (state.empTimer > 0) state.empTimer -= dt;
    for (const c of state.cameras) if (c.disabled > 0) c.disabled -= dt;

    // Thief movement.
    const speed = controls.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
    let mx = controls.move.x;
    let my = controls.move.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
    thief.sneaking = controls.sneaking;
    thief.moving = len > 0;
    moveCircle(thief, mx * speed * dt, my * speed * dt);
    if (thief.grace > 0) thief.grace -= dt;

    // Cameras sweep.
    for (const c of state.cameras) {
      if (c.disabled > 0) continue;
      c.angle += c.sweepDir * CAMERA.sweepSpeed * (Math.PI / 180) * dt;
      if (c.angle > c.baseAngle + c.sweep) {
        c.angle = c.baseAngle + c.sweep;
        c.sweepDir = -1;
      } else if (c.angle < c.baseAngle - c.sweep) {
        c.angle = c.baseAngle - c.sweep;
        c.sweepDir = 1;
      }
    }

    // Visibility.
    const hidden = inSmoke(state, thief.x, thief.y);
    let seenByGuard = false;
    let seenByCamera = false;
    for (const c of state.cameras) {
      if (cameraSeesThief(lv, c, thief, hidden)) { seenByCamera = true; break; }
    }

    // Guards.
    let anyChasing = false;
    for (const g of state.guards) {
      if (g.frozen > 0) {
        g.frozen -= dt;
        continue;
      }
      const sees = guardSeesThief(lv, g, thief, hidden);
      if (sees) seenByGuard = true;

      if (g.mode === 'patrol') {
        if (sees) {
          g.reactTimer += dt;
          if (g.reactTimer >= GUARD.reactTime) {
            g.mode = 'chase';
            g.modeTimer = 0;
            g.loseTimer = 0;
            g.lastSeenX = thief.x;
            g.lastSeenY = thief.y;
            g.chase = true;
            events |= EVENT_SPOTTED;
          }
        } else {
          g.reactTimer = Math.max(0, g.reactTimer - dt);
        }
        // Walk the patrol loop.
        const target = g.waypoints[g.wpIndex];
        const d = dist(g.x, g.y, target.x, target.y);
        const stepLen = g.speed * dt;
        if (d <= Math.max(stepLen, 2)) {
          g.x = target.x;
          g.y = target.y;
          g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        } else {
          const nx = g.x + ((target.x - g.x) / d) * stepLen;
          const ny = g.y + ((target.y - g.y) / d) * stepLen;
          g.angle = Math.atan2(target.y - g.y, target.x - g.x);
          g.x = nx;
          g.y = ny;
        }
        // Bumped while patrolling: the guard alerts, alarm +40, knockback, grace.
        if (dist(g.x, g.y, thief.x, thief.y) < GUARD.radius + thief.r && thief.grace <= 0) {
          state.alarm = Math.min(100, state.alarm + GUARD.bumpAlarm);
          const away = Math.atan2(thief.y - g.y, thief.x - g.x);
          moveCircle(thief, Math.cos(away) * THIEF.knockback, Math.sin(away) * THIEF.knockback);
          thief.grace = THIEF.grace;
          g.mode = 'chase';
          g.modeTimer = 0;
          g.loseTimer = 0;
          g.lastSeenX = thief.x;
          g.lastSeenY = thief.y;
          g.chase = true;
          events |= EVENT_SPOTTED;
        }
      } else if (g.mode === 'chase') {
        anyChasing = true;
        if (sees) {
          g.lastSeenX = thief.x;
          g.lastSeenY = thief.y;
          g.loseTimer = 0;
        } else {
          g.loseTimer += dt;
          if (g.loseTimer >= GUARD.loseTime) {
            g.mode = 'search';
            g.modeTimer = 0;
            g.chase = false;
          }
        }
        // Chase the last-seen spot.
        const tx = sees ? thief.x : g.lastSeenX;
        const ty = sees ? thief.y : g.lastSeenY;
        const d = dist(g.x, g.y, tx, ty);
        const stepLen = g.speed * GUARD.chaseSpeed * dt;
        if (d > 1) {
          g.angle = Math.atan2(ty - g.y, tx - g.x);
          const move = Math.min(stepLen, d);
          g.x += ((tx - g.x) / d) * move;
          g.y += ((ty - g.y) / d) * move;
        }
        // Caught.
        if (dist(g.x, g.y, thief.x, thief.y) < GUARD.radius + thief.r) {
          return caught();
        }
      } else if (g.mode === 'search') {
        const d = dist(g.x, g.y, g.lastSeenX, g.lastSeenY);
        const stepLen = g.speed * dt;
        if (d > 4) {
          g.angle = Math.atan2(g.lastSeenY - g.y, g.lastSeenX - g.x);
          const move = Math.min(stepLen, d);
          g.x += ((g.lastSeenX - g.x) / d) * move;
          g.y += ((g.lastSeenY - g.y) / d) * move;
        } else {
          g.modeTimer += dt;
          if (g.modeTimer >= GUARD.searchTime) {
            g.mode = 'patrol';
            g.modeTimer = 0;
            g.reactTimer = 0;
            // Resume at the nearest waypoint.
            let best = 0;
            let bestD = Infinity;
            for (let i = 0; i < g.waypoints.length; i += 1) {
              const dd = dist(g.x, g.y, g.waypoints[i].x, g.waypoints[i].y);
              if (dd < bestD) { bestD = dd; best = i; }
            }
            g.wpIndex = best;
          }
        }
      }
    }

    // LOCKDOWN: every guard hunts the thief's position.
    if (state.lockdown) {
      for (const g of state.guards) {
        if (g.mode === 'patrol') {
          g.mode = 'chase';
          g.lastSeenX = thief.x;
          g.lastSeenY = thief.y;
          g.loseTimer = 0;
          g.chase = true;
        }
      }
    }

    // Alarm.
    if (seenByGuard) state.alarm += (thief.sneaking ? ALARM.guardSneak : ALARM.guardWalk) * dt;
    if (seenByCamera) state.alarm += (thief.sneaking ? ALARM.cameraSneak : ALARM.cameraWalk) * dt;
    if (!seenByGuard && !seenByCamera) {
      if (state.lockdown) {
        if (!anyChasing) state.alarm -= ALARM.lockdownDecay * dt;
      } else {
        state.alarm -= ALARM.decay * dt;
      }
    }
    state.alarm = clamp(state.alarm, 0, 100);
    if (state.alarm > ALARM.ghostBelow) state.ghost = false;
    if (state.alarm >= ALARM.lockdownAt) state.lockdown = true;
    if (state.lockdown && state.alarm < ALARM.lockdownEndsBelow) state.lockdown = false;

    // Vault cracking: hold E near the vault front.
    if (lv.vault && !state.vaultOpen) {
      const v = lv.vault;
      const frontX = v.x + v.w / 2;
      const frontY = v.y + v.h;
      const near = dist(thief.x, thief.y, frontX, frontY) <= VAULT.crackRange;
      if (near && controls.interactHeld) {
        const rate = state.toolId === 'lockpick' ? TOOLS.lockpick.crackFactor : 1;
        state.vaultProgress += (dt / v.crackSeconds) * rate;
        state.crackTick += dt;
        if (state.crackTick >= 0.25) {
          state.crackTick = 0;
          events |= EVENT_CRACK;
        }
        if (state.vaultProgress >= 1) {
          state.vaultProgress = 1;
          state.vaultOpen = true;
          state.alarm = Math.min(100, state.alarm + ALARM.vaultOpen);
          events |= EVENT_VAULT_OPEN;
        }
      }
    }

    // Main loot: within 50 px, after the vault opens (or directly in room 1).
    if (!state.targetTaken && (lv.vault === null || state.vaultOpen)) {
      if (dist(thief.x, thief.y, lv.target.x, lv.target.y) <= GRAB_RANGE) {
        state.targetTaken = true;
        state.exitOpen = true;
        state.loot += lv.target.value;
        state.score += lv.target.value;
        events |= EVENT_LOOT;
      }
    }

    // Side loot: instant grab on proximity.
    for (const item of state.sideLoot) {
      if (item.taken) continue;
      if (dist(thief.x, thief.y, item.x, item.y) <= LOOT_RANGE) {
        item.taken = true;
        state.loot += item.value;
        state.score += item.value;
        if (state.toolId !== 'lockpick') state.alarm = Math.min(100, state.alarm + ALARM.sideLoot);
        events |= EVENT_LOOT;
      }
    }

    // Exit: green once the main loot is taken; stepping in finishes the room.
    if (state.exitOpen) {
      if (
        thief.x > EXIT.x - EXIT.w / 2 && thief.x < EXIT.x + EXIT.w / 2 &&
        thief.y > EXIT.y - EXIT.h / 2 && thief.y < EXIT.y + EXIT.h / 2
      ) {
        state.timeBonus = Math.round(state.timeLeft) * SCORE.timePerSecond;
        state.score += state.timeBonus;
        state.levelResults.push({
          name: lv.name,
          loot: state.loot,
          timeBonus: state.timeBonus,
        });
        events |= EVENT_DONE;
        if (state.levelIndex >= LEVELS.length - 1) {
          state.ghostBonus = state.ghost ? SCORE.ghost : 0;
          state.cleanBonus = state.clean ? SCORE.clean : 0;
          state.finalScore = state.score + state.ghostBonus + state.cleanBonus;
          state.phase = PHASE_WIN;
          events |= EVENT_WIN;
        } else {
          state.phase = PHASE_DONE;
        }
        return events;
      }
    }

    if (state.messageTimer > 0) state.messageTimer -= dt;
    return events;
  }

  function caught() {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.phase = PHASE_OVER;
      return EVENT_CAUGHT | EVENT_OVER;
    }
    state.phase = PHASE_CAUGHT;
    return EVENT_CAUGHT;
  }

  /** After a level-done panel: on to the next room's plan, or the win screen. */
  function nextLevel() {
    state.levelIndex += 1;
    resetLevel();
    state.phase = PHASE_PLAN;
  }

  /** After a caught panel: retry the same room's plan (the level resets). */
  function retryLevel() {
    resetLevel();
    state.phase = PHASE_PLAN;
  }

  /** Jump to a room and reset it (used by the screenshot scenes). */
  function setupLevel(index) {
    state.levelIndex = index;
    resetLevel();
  }

  /**
   * One fixed step. `controls` carries move {x,y}, sneaking, interactHeld, actions
   * (bit flags) and clicks [{x,y,w,h} in canvas CSS pixels]. Returns event flags.
   */
  function step(dt, controls) {
    if (state.phase === PHASE_PLAN) return stepPlan(dt, controls);
    if (state.phase === PHASE_PLAY) return stepPlay(dt, controls);
    return 0;
  }

  reset();
  return {
    state,
    reset,
    step,
    startHeist,
    beginLevel,
    nextLevel,
    retryLevel,
    setupLevel,
    level,
  };
}
