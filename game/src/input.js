// Keyboard and pointer input. Held keys give a movement vector and a sneak flag;
// one-shot presses (interact, tool, pause, mute, confirm) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. Mouse clicks are queued with their canvas coordinates.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_TOOL = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const TOOL = new Set(['KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let clicks = [];

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (SNEAK.has(event.code)) {
      held.add(event.code);
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (TOOL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_TOOL;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    clicks.push({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    actions |= ACTION_CONFIRM;
  });

  function axis(neg, pos) {
    let value = 0;
    for (const code of neg) if (held.has(code)) value -= 1;
    for (const code of pos) if (held.has(code)) value += 1;
    return value;
  }

  return {
    /** Movement vector {x, y}, each -1, 0 or 1, normalised by the caller. */
    move() {
      return { x: axis(LEFT, RIGHT), y: axis(UP, DOWN) };
    },
    /** True while either Shift key is held. */
    sneaking() {
      for (const code of SNEAK) if (held.has(code)) return true;
      return false;
    },
    /** True while E is held (vault cracking). */
    interactHeld() {
      for (const code of INTERACT) if (held.has(code)) return true;
      return false;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pointer clicks since the last call, in canvas CSS pixels. */
    takeClicks() {
      const taken = clicks;
      clicks = [];
      return taken;
    },
  };
}
