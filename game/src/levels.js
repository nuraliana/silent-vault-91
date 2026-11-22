// The three hand-built rooms: names, targets, vaults, exits, entries, walls, cases,
// pillars, guard patrols, cameras and side loot. Coordinates are in the 1280x720
// playfield; the room interior is x 40-1240, y 76-684.
//
// Design rules baked in here:
// - Both entries are out of every guard cone and every camera sweep at spawn.
// - Guard patrols are inset from the room edges; the top, left and bottom strips
//   are the quiet lanes. No patrol line passes through a vault front.
// - Every patrol waypoint clears walls, cases, the vault and pillars by at least
//   the guard's radius (14 px).

export const ENTRIES = [
  { id: 'skylight', name: 'Skylight', x: 300, y: 100 },
  { id: 'service', name: 'Service Door', x: 200, y: 660 },
];

export const EXIT = { x: 200, y: 660, w: 64, h: 44 };

function guard(waypoints, speed, range) {
  return { waypoints, speed, range };
}

function camera(x, y, baseAngle, sweep, range) {
  return { x, y, baseAngle, sweep, range };
}

function loot(kind, x, y, value) {
  return { kind, x, y, value, taken: false };
}

export const LEVELS = [
  {
    name: 'The Gallery',
    room: 1,
    target: { name: 'The Jade Cat', value: 5000, x: 1110, y: 380 },
    vault: null,
    // The statue sits in its display case; the thief grabs it from just below the case.
    statueCase: { x: 1060, y: 352, w: 100, h: 56 },
    guards: [
      guard(
        [{ x: 250, y: 280 }, { x: 900, y: 280 }, { x: 900, y: 550 }, { x: 250, y: 550 }],
        70, 210,
      ),
      guard(
        [{ x: 930, y: 300 }, { x: 1180, y: 300 }, { x: 1180, y: 560 }, { x: 930, y: 560 }],
        76, 200,
      ),
    ],
    cameras: [camera(640, 76, Math.PI / 2, 0.87, 230)],
    walls: [
      { x: 480, y: 120, w: 20, h: 100 },
      { x: 750, y: 600, w: 300, h: 20 },
    ],
    cases: [
      { x: 300, y: 180, w: 100, h: 56 },
      { x: 550, y: 180, w: 100, h: 56 },
      { x: 800, y: 180, w: 100, h: 56 },
      { x: 300, y: 480, w: 100, h: 56 },
      { x: 550, y: 480, w: 100, h: 56 },
      { x: 800, y: 480, w: 100, h: 56 },
    ],
    pillars: [],
    sideLoot: [
      loot('gold', 120, 140, 1500),
      loot('painting', 1180, 620, 2500),
    ],
  },
  {
    name: 'The Vault Wing',
    room: 2,
    target: { name: 'The Sunken Gold', value: 12000, x: 1110, y: 240 },
    vault: { x: 1040, y: 120, w: 140, h: 90, crackSeconds: 2.5 },
    guards: [
      guard(
        [{ x: 250, y: 280 }, { x: 900, y: 280 }, { x: 900, y: 550 }, { x: 250, y: 550 }],
        74, 210,
      ),
      guard(
        [{ x: 930, y: 300 }, { x: 1180, y: 300 }, { x: 1180, y: 520 }, { x: 930, y: 520 }],
        80, 200,
      ),
      guard(
        [{ x: 1080, y: 300 }, { x: 1080, y: 600 }],
        84, 205,
      ),
    ],
    cameras: [
      camera(640, 76, Math.PI / 2, 0.87, 230),
      camera(1180, 240, Math.PI, 0.7, 230),
    ],
    walls: [],
    cases: [
      { x: 300, y: 180, w: 100, h: 56 },
      { x: 550, y: 180, w: 100, h: 56 },
      { x: 300, y: 480, w: 100, h: 56 },
      { x: 550, y: 480, w: 100, h: 56 },
    ],
    pillars: [
      { x: 180, y: 380, r: 16 },
      { x: 1120, y: 560, r: 16 },
    ],
    sideLoot: [
      loot('gold', 120, 140, 1500),
      loot('painting', 1180, 620, 2500),
      loot('gold', 640, 400, 1500),
    ],
  },
  {
    name: 'The Meridian Vault',
    room: 3,
    target: { name: 'The Star of Meridian', value: 25000, x: 1130, y: 300 },
    vault: { x: 1060, y: 180, w: 140, h: 90, crackSeconds: 3.0 },
    guards: [
      guard(
        [{ x: 200, y: 280 }, { x: 840, y: 280 }, { x: 840, y: 570 }, { x: 200, y: 570 }],
        78, 220,
      ),
      guard(
        [{ x: 1010, y: 360 }, { x: 1200, y: 360 }, { x: 1200, y: 600 }, { x: 1010, y: 600 }],
        84, 215,
      ),
      guard(
        [{ x: 500, y: 340 }, { x: 850, y: 340 }, { x: 850, y: 570 }, { x: 500, y: 570 }],
        82, 210,
      ),
      guard(
        [{ x: 1010, y: 300 }, { x: 1010, y: 620 }],
        88, 205,
      ),
    ],
    cameras: [
      camera(640, 76, Math.PI / 2, 0.87, 230),
      camera(1200, 300, Math.PI, 0.7, 230),
      camera(76, 380, 0, 0.7, 230),
    ],
    walls: [],
    cases: [
      { x: 280, y: 180, w: 100, h: 56 },
      { x: 560, y: 180, w: 100, h: 56 },
      { x: 880, y: 180, w: 100, h: 56 },
      { x: 280, y: 480, w: 100, h: 56 },
      { x: 560, y: 480, w: 100, h: 56 },
      { x: 880, y: 480, w: 100, h: 56 },
    ],
    pillars: [
      { x: 140, y: 380, r: 16 },
      { x: 1220, y: 130, r: 16 },
    ],
    sideLoot: [
      loot('gold', 120, 140, 1500),
      loot('painting', 1180, 620, 2500),
      loot('gold', 640, 400, 1500),
      loot('painting', 140, 620, 2500),
    ],
  },
];
