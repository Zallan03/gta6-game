// Port Verano — saving. One slot in localStorage: mission, money, ammo,
// position and which stashes are found. Autosaves on mission complete;
// the pause menu saves on demand.

const KEY = 'portverano-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      missionIndex: state.mission ? state.mission.index : 0,
      money: state.player.money,
      ammo: state.player.ammo,
      health: state.player.health,
      x: state.player.x,
      y: state.player.y,
      stashesTaken: state.side.stashes.map((s) => (s.taken ? 1 : 0)),
      stats: state.stats,
      clock: state.clock,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
