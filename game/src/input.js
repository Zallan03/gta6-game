// Keyboard and mouse, translated into game terms. The world only ever sees
// this plain input object — and the screenshot autopilot writes the same
// shape, so a staged scene plays by the real rules.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'enter',
  KeyF: 'punch',
  Space: 'shoot',
};

export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    sprint: false, enter: false, punch: false, shoot: false,
    mouseDown: false, mouseX: 0, mouseY: 0,
    aimX: 0, aimY: 0,
    pressed: new Set(),
  };

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (action) {
      input[action] = true;
      input.pressed.add(action);
      if (action === 'shoot') event.preventDefault();
    }
    if (event.code === 'Enter') input.pressed.add(ACTION_CONFIRM);
    if (event.code === 'KeyP' || event.code === 'Escape') input.pressed.add(ACTION_PAUSE);
    if (event.code === 'KeyM') input.pressed.add(ACTION_MUTE);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  }

  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action) input[action] = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    input.mouseDown = true;
    input.shoot = true;
  }

  function onMouseUp() {
    input.mouseDown = false;
    input.shoot = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // True once for each press since the last frame; cleared by endFrame.
  input.wasPressed = (action) => input.pressed.has(action);
  input.endFrame = () => {
    input.pressed.clear();
    input.enter = false;
    input.punch = false;
  };
  return input;
}

// A scripted input for the screenshot scenes: the autopilot writes it.
export function createScriptedInput() {
  return {
    up: false, down: false, left: false, right: false,
    sprint: false, enter: false, punch: false, shoot: false,
    mouseDown: false, mouseX: 0, mouseY: 0, aimX: 0, aimY: 0,
    pressed: new Set(),
    wasPressed: () => false,
    endFrame: () => {},
  };
}
