# Midnight Vault — The Meridian Heist

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/nuraliana/silent-vault-91/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/nuraliana/silent-vault-91/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down 2D stealth heist game in vanilla JS canvas. No libraries, no network.
Three rooms, 3 lives, 240 seconds a room. Plan the entry and the tool, sneak
past the patrols and the cameras, crack the vault, lift the loot and slip out
the service door.

## How to play

1. **Title** — press Space or click to plan the heist.
2. **Plan** — study the floor plan (patrol dotted lines, camera dots), pick one
   of two entries (Skylight or Service Door) and one of three tools (Smoke Bomb,
   EMP Pulse, Lockpick Kit), then click BEGIN.
3. **Play** — sneak, steal, escape:
   - **WASD / arrows** — move. **Shift** — sneak (slower, harder to spot).
   - **E** — hold to crack a vault. **Q** — use the tool. **P** — pause.
     **M** — mute.
   - Guards patrol waypoint loops with amber vision cones (red with a "!"
     when chasing). A guard that sees you for 0.6 s starts chasing; lose it
     for 2.5 s and it searches your last-seen spot, then resumes patrol.
   - Cameras sweep red cones. EMP disables them for 8 s.
   - The alarm rises while you are seen (+30/s in a guard cone, +18/s in a
     camera cone; half that while sneaking) and decays −14/s while unseen.
     At 70 it reads ALERT; at 100 it is LOCKDOWN and every guard hunts.
   - Open a vault (+20 alarm), grab the target inside, then the service door
     turns green — step into it with the loot to finish the room.
   - Side loot (gold $1,500, painting $2,500) is a quick grab, +5 alarm
     unless you hold the Lockpick Kit.

## The three rooms

- **Room 1 — The Gallery.** Target: The Jade Cat, $5,000 (direct grab from
  its display case). 2 guards, 1 camera.
- **Room 2 — The Vault Wing.** Target: The Sunken Gold, $12,000, in a vault
  (crack 2.5 s). 3 guards, 2 cameras.
- **Room 3 — The Meridian Vault.** Target: The Star of Meridian (diamond),
  $25,000, in a vault (crack 3 s). 4 guards, 3 cameras.

## Scoring

Loot plus a time bonus ($10 per second left) plus a GHOST bonus (+$2,000 if
the alarm never passes 50) and a CLEAN bonus (+$1,000 if the tool is never
used). The best score is kept in this browser.

## Running it

Serve `game/` locally with `node serve.ts`, then open http://localhost:8080.
The entry program (`node main.ts`) copies `game/` and `screenshots/` into the
output directory and writes `dossier.json`.
