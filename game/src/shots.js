// The screenshot scenes behind ?shot=play|plan|vault|escape (with &seed=N). Each
// one stages a plausible mid-heist state on room 3 with the real rules and the
// real renderer, so the frame is what a game really looks like and the same seed
// always gives the same frame. The guards are stepped forward a few seconds so
// they sit mid-patrol instead of on their spawn points.
import { STEP } from './config.js';
import { SCREEN_PLAN, SCREEN_PLAY } from './render.js';

const IDLE = { move: { x: 0, y: 0 }, sneaking: false, interactHeld: false, actions: 0, clicks: [] };

/** Step the world forward with no input, so the guards walk their patrols. */
function idleFor(world, seconds) {
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    world.step(STEP, IDLE);
  }
}

function room3(world) {
  world.setupLevel(2);
  world.state.phase = 'play';
  world.state.lives = 3;
}

/**
 * Set `world` to the named scene (play, plan, vault or escape; any other name is
 * play) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name === 'plan') {
    room3(world);
    world.state.phase = 'plan';
    world.state.entryId = 'skylight';
    world.state.toolId = 'smoke';
    return { screen: SCREEN_PLAN, best: 0 };
  }

  if (name === 'vault') {
    room3(world);
    idleFor(world, 4);
    world.state.thief.x = 1130;
    world.state.thief.y = 296;
    world.state.vaultProgress = 0.5;
    world.state.alarm = 42;
    world.state.timeLeft = 180;
    world.state.loot = 0;
    world.state.score = 0;
    world.state.toolId = 'lockpick';
    world.state.toolUsed = false;
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'escape') {
    room3(world);
    idleFor(world, 2);
    world.state.vaultOpen = true;
    world.state.targetTaken = true;
    world.state.exitOpen = true;
    world.state.loot = 25000;
    world.state.score = 25000;
    world.state.thief.x = 300;
    world.state.thief.y = 660;
    world.state.alarm = 75;
    world.state.timeLeft = 120;
    world.state.toolId = 'smoke';
    world.state.toolUsed = false;
    // Every guard hunts the thief: red cones and "!" markers.
    for (const g of world.state.guards) {
      g.mode = 'chase';
      g.chase = true;
      g.lastSeenX = world.state.thief.x;
      g.lastSeenY = world.state.thief.y;
      g.loseTimer = 0;
      g.angle = Math.atan2(world.state.thief.y - g.y, world.state.thief.x - g.x);
    }
    return { screen: SCREEN_PLAY, best: 25000 };
  }

  // play (the cover): the thief mid-room, closing on the vault.
  room3(world);
  idleFor(world, 5);
  world.state.thief.x = 850;
  world.state.thief.y = 430;
  world.state.alarm = 28;
  world.state.timeLeft = 200;
  world.state.loot = 0;
  world.state.score = 0;
  world.state.toolId = 'lockpick';
  world.state.toolUsed = false;
  return { screen: SCREEN_PLAY, best: 0 };
}
