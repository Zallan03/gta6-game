// Port Verano — keyboard and mouse state with edge detection, so a tap of
// E or F fires once instead of every frame it is held.

import { KEYS } from './config.js';

export function createInput(canvas) {
  const input = {
    down: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
  };

  function codeOf(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!input.down.has(e.code)) input.pressed.add(e.code);
    input.down.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.down.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.down.clear();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });

  input.isDown = function isDown(action) {
    const codes = KEYS[action] || [];
    return codes.some((c) => input.down.has(c));
  };

  input.wasPressed = function wasPressed(action) {
    const codes = KEYS[action] || [];
    return codes.some((c) => input.pressed.has(c));
  };

  input.axis = function axis(negAction, posAction) {
    return (input.isDown(posAction) ? 1 : 0) - (input.isDown(negAction) ? 1 : 0);
  };

  // Call at the end of each frame: edges live for exactly one frame.
  input.endFrame = function endFrame() {
    input.pressed.clear();
    input.mousePressed = false;
  };

  return input;
}
