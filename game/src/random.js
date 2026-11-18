// A small seeded generator (mulberry32): the same seed gives the same city,
// traffic and missions, which makes the game and its screenshot scenes
// repeatable. No simulation code ever uses Math.random.
export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function intRange(rng, low, high) {
  return low + Math.floor(rng() * (high - low + 1));
}

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}
