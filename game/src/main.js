// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Eight screens: title, plan, play, level done, caught,
// win, pause and game over.
//
// ?seed=N fixes the random stream. ?shot=play|plan|vault|escape (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CAUGHT, EVENT_CRACK, EVENT_DONE, EVENT_LOOT, EVENT_TOOL,
  EVENT_VAULT_OPEN, EVENT_WIN, createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput,
} from './input.js';
import {
  SCREEN_CAUGHT, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAN,
  SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function screenOf() {
    const phase = world.state.phase;
    if (phase === 'title') return SCREEN_TITLE;
    if (phase === 'plan') return SCREEN_PLAN;
    if (phase === 'done') return SCREEN_DONE;
    if (phase === 'caught') return SCREEN_CAUGHT;
    if (phase === 'win') return SCREEN_WIN;
    if (phase === 'over') return SCREEN_OVER;
    return world.state.paused ? SCREEN_PAUSED : SCREEN_PLAY;
  }

  function playEvents(events) {
    if (events & EVENT_LOOT) sound.pickup();
    if (events & EVENT_CRACK) sound.crack();
    if (events & EVENT_VAULT_OPEN) sound.vaultOpen();
    if (events & EVENT_TOOL) sound.tool();
    if (events & EVENT_CAUGHT) sound.caught();
    if (events & EVENT_DONE) sound.vaultOpen();
    if (events & EVENT_WIN) {
      sound.win();
      const finalScore = world.state.finalScore;
      if (finalScore > best) {
        best = finalScore;
        saveBest(best);
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const phase = world.state.phase;
    if (actions & ACTION_MUTE) sound.toggleMute();
    if (actions & ACTION_CONFIRM) sound.unlock();
    if (phase === 'title' && (actions & ACTION_CONFIRM)) {
      sound.unlock();
      world.startHeist();
      announce('Planning the heist. Pick an entry and a tool, then BEGIN.');
      return;
    }
    if (phase === 'done' && (actions & ACTION_CONFIRM)) {
      world.nextLevel();
      announce('Planning the next room.');
      return;
    }
    if (phase === 'caught' && (actions & ACTION_CONFIRM)) {
      world.retryLevel();
      announce('Planning the room again.');
      return;
    }
    if ((phase === 'win' || phase === 'over') && (actions & ACTION_CONFIRM)) {
      world.startHeist();
      announce('Planning a new heist.');
      return;
    }
    if (phase === 'play') {
      if (actions & ACTION_PAUSE) {
        world.state.paused = !world.state.paused;
        announce(world.state.paused ? 'Paused.' : 'Playing.');
      }
    }
  }

  function step() {
    const phase = world.state.phase;
    if (phase !== 'play' || world.state.paused) return;
    const controls = {
      move: input.move(),
      sneaking: input.sneaking(),
      interactHeld: input.interactHeld(),
      actions: input.takeActions(),
      clicks: input.takeClicks().map((c) => ({ ...c, w: canvas.clientWidth, h: canvas.clientHeight })),
    };
    const events = world.step(STEP, controls);
    playEvents(events);
    if (events & EVENT_CAUGHT) announce('Caught! The guards got you.');
    else if (events & EVENT_DONE) announce('Room cleared. On to the next one.');
    else if (events & EVENT_WIN) announce(`Heist complete. Final score ${world.state.finalScore}.`);
  }

  function planStep() {
    const controls = {
      move: { x: 0, y: 0 },
      sneaking: false,
      interactHeld: false,
      actions: input.takeActions(),
      clicks: input.takeClicks().map((c) => ({ ...c, w: canvas.clientWidth, h: canvas.clientHeight })),
    };
    world.step(STEP, controls);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    const phase = world.state.phase;
    if (phase === 'plan') {
      planStep();
    } else if (phase === 'play' && !world.state.paused) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (world.state.phase !== 'play' || world.state.paused) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screenOf(), best);
  }

  // Leaving the tab pauses a running game rather than letting the guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state.phase === 'play' && !world.state.paused) {
      world.state.paused = true;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Space or click to plan the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
