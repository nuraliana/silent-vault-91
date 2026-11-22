// Midnight Vault — every tuning number and colour in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size. Room interior x 40-1240, y 76-684; the HUD
// bar sits on top (y 0-56) and a bottom strip names the tool and the keys.

export const FIELD = { width: 1280, height: 720 };
export const ROOM = { x0: 40, y0: 76, x1: 1240, y1: 684 };
export const HUD = { height: 56 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seconds of play per level, and the lives the thief starts with. */
export const LEVEL_TIME = 240;
export const LIVES = 3;

export const THIEF = {
  radius: 12,
  walkSpeed: 205,
  sneakSpeed: 105,
  /** Pixels of knockback when a patrolling guard bumps the thief. */
  knockback: 34,
  /** Seconds of grace (no further bump) after a patrolling guard bumps the thief. */
  grace: 1.0,
};

export const GUARD = {
  radius: 14,
  /** Seconds of continuous sight before a guard starts chasing. */
  reactTime: 0.6,
  /** Seconds of lost sight before a chasing guard gives up and searches. */
  loseTime: 2.5,
  /** Seconds a guard searches the last-seen spot before resuming patrol. */
  searchTime: 2.0,
  /** Chase speed multiplier over the guard's patrol speed. */
  chaseSpeed: 1.55,
  /** Vision cone: range in px and half-angle in radians. */
  range: 210,
  halfAngle: 0.61,
  /** Alarm added when a patrolling guard bumps the thief. */
  bumpAlarm: 40,
};

export const CAMERA = {
  /** Camera cone range in px and half-angle in radians. */
  range: 230,
  halfAngle: 0.55,
  /** Degrees per second the sweep moves (ping-pong). */
  sweepSpeed: 28,
};

export const ALARM = {
  /** Per second, while the thief is inside a guard cone. */
  guardWalk: 30,
  guardSneak: 15,
  /** Per second, while the thief is inside a camera cone. */
  cameraWalk: 18,
  cameraSneak: 9,
  /** Per second, while no cone sees the thief. */
  decay: 14,
  /** The meter reads ALERT from here up. */
  alertAt: 70,
  /** LOCKDOWN at 100: every guard hunts; it only decays when no guard chases. */
  lockdownAt: 100,
  lockdownDecay: 8,
  lockdownEndsBelow: 80,
  /** Alarm tripped by opening a vault, and by grabbing side loot without the Lockpick Kit. */
  vaultOpen: 20,
  sideLoot: 5,
  /** Alarm cost of firing the EMP Pulse. */
  empCost: 15,
  /** GHOST bonus needs the alarm never to pass this value. */
  ghostBelow: 50,
};

export const VAULT = {
  /** Crack seconds per room (room 2, room 3); the Lockpick Kit cracks twice as fast. */
  crackSeconds: { 2: 2.5, 3: 3.0 },
  /** How close the thief must stand to the vault front to crack it, in px. */
  crackRange: 64,
};

/** How close the thief must be to grab the main loot, in px. */
export const GRAB_RANGE = 50;
/** How close the thief must be to grab side loot, in px. */
export const LOOT_RANGE = 30;

export const TOOLS = {
  smoke: {
    id: 'smoke',
    name: 'Smoke Bomb',
    desc: 'A cloud no cone can see through',
    radius: 92,
    duration: 6,
  },
  emp: {
    id: 'emp',
    name: 'EMP Pulse',
    desc: 'Cameras off 8 s, guards frozen 2 s, +15 alarm',
    cameraOff: 8,
    freeze: 2,
  },
  lockpick: {
    id: 'lockpick',
    name: 'Lockpick Kit',
    desc: 'Crack twice as fast, silent side loot',
    crackFactor: 2,
  },
};

export const SCORE = {
  gold: 1500,
  painting: 2500,
  /** Time bonus per second left when a room is finished. */
  timePerSecond: 10,
  /** GHOST bonus: alarm never passed 50 during the whole heist. */
  ghost: 2000,
  /** CLEAN bonus: the tool was never used during the whole heist. */
  clean: 1000,
};

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#1a1d27',
  floorAlt: '#1e222e',
  wall: '#3a4152',
  wallTop: '#4a5266',
  case: '#2c3345',
  caseGlass: '#5a6b8a',
  vault: '#6b5a2e',
  vaultDoor: '#8a7434',
  exit: '#2e5d3a',
  exitOpen: '#3fae5a',
  thief: '#e8c34a',
  thiefSneak: '#b89a2e',
  guard: '#c94f4f',
  guardChase: '#ff3b30',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneChase: 'rgba(255, 59, 48, 0.28)',
  cameraCone: 'rgba(255, 80, 80, 0.18)',
  camera: '#d43d3d',
  smoke: 'rgba(180, 190, 200, 0.55)',
  lootGold: '#f2c94c',
  lootPainting: '#7fb3e8',
  target: '#7be0a3',
  panel: '#171a23',
  panelEdge: '#2c3345',
  text: '#eef1f5',
  muted: '#8b93a3',
  alarm: '#f2c94c',
  alarmAlert: '#ff8c42',
  alarmLock: '#ff3b30',
  danger: '#ff3b30',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';

/** Planning board layout (field coordinates): the floor plan on the left, the
 * entry and tool cards on the right, BEGIN at the bottom-right. Shared by the
 * world (click handling) and the renderer (drawing). */
export const PLAN_LAYOUT = {
  board: { x: 60, y: 96, w: 640, h: 520 },
  entryCards: [
    { id: 'skylight', x: 760, y: 96, w: 440, h: 96 },
    { id: 'service', x: 760, y: 208, w: 440, h: 96 },
  ],
  toolCards: [
    { id: 'smoke', x: 760, y: 336, w: 440, h: 72 },
    { id: 'emp', x: 760, y: 420, w: 440, h: 72 },
    { id: 'lockpick', x: 760, y: 504, w: 440, h: 72 },
  ],
  begin: { x: 940, y: 600, w: 260, h: 56 },
};
