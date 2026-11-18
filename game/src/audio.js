// Sound, all synthesized with WebAudio: no audio files, no network. An
// engine hum, sirens, gunshots, pickups and a low-key bassline that plays
// while you drive. Nothing here is needed for the simulation; it only
// listens to the world's sound effects.
export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenPhase: 0,
    muted: false, started: false, nextNote: 0, step: 0,
  };

  function ensure() {
    if (audio.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 50;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      audio.started = true;
      audio.nextNote = audio.ctx.currentTime + 0.1;
    } catch {
      audio.started = false;
    }
  }

  function blip(freq, dur, type, gain, slideTo) {
    if (!audio.started || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, gain, lowpass) {
    if (!audio.started || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = audio.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
  }

  // A lazy bassline in A minor: root notes with a syncopated walk, plus a hat tick.
  const BASS = [55, 55, 65.41, 55, 49, 55, 82.41, 73.42];
  function musicTick() {
    if (!audio.started || audio.muted) return;
    const stepDur = 0.23;
    while (audio.nextNote < audio.ctx.currentTime + 0.3) {
      const note = BASS[audio.step % BASS.length];
      const t = audio.nextNote;
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
      osc.connect(g);
      g.connect(audio.musicGain);
      osc.start(t);
      osc.stop(t + stepDur);
      if (audio.step % 2 === 1) {
        const hat = audio.ctx.createOscillator();
        const hg = audio.ctx.createGain();
        hat.type = 'square';
        hat.frequency.value = 6000;
        hg.gain.setValueAtTime(0.05, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        hat.connect(hg);
        hg.connect(audio.musicGain);
        hat.start(t);
        hat.stop(t + 0.04);
      }
      audio.step += 1;
      audio.nextNote += stepDur;
    }
  }

  function playNamed(name) {
    if (name === 'shot') noise(0.12, 0.5, 2400);
    else if (name === 'explosion') { noise(0.7, 0.9, 500); blip(90, 0.6, 'sine', 0.7, 30); }
    else if (name === 'pickup') { blip(660, 0.09, 'sine', 0.4); blip(990, 0.14, 'sine', 0.4); }
    else if (name === 'mission') [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.4), i * 110));
    else if (name === 'fanfare') [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.45), i * 130));
    else if (name === 'jack') blip(220, 0.12, 'square', 0.25, 330);
    else if (name === 'crash') noise(0.25, 0.6, 900);
    else if (name === 'hit') noise(0.1, 0.4, 1200);
    else if (name === 'punch') noise(0.08, 0.3, 800);
    else if (name === 'click') blip(1200, 0.03, 'square', 0.15);
    else if (name === 'alarm') { blip(880, 0.18, 'square', 0.3, 660); blip(660, 0.18, 'square', 0.3, 880); }
    else if (name === 'wasted' || name === 'busted') [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sawtooth', 0.3), i * 260));
  }

  audio.unlock = ensure;
  audio.setMuted = (muted) => {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };
  audio.engine = (speed, inCar) => {
    if (!audio.started || audio.muted) return;
    const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) / 4200) : 0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 0.16, audio.ctx.currentTime, 0.08);
  };
  audio.update = (sfxList) => {
    if (!audio.started) return;
    for (const name of sfxList) playNamed(name);
    musicTick();
  };
  audio.siren = (on) => {
    if (!audio.started) return;
    if (!audio.sirenOsc) {
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.sirenPhase = 0;
    }
    audio.sirenGain.gain.setTargetAtTime(on && !audio.muted ? 0.05 : 0, audio.ctx.currentTime, 0.2);
    if (on) {
      audio.sirenPhase = (audio.sirenPhase + 1) % 120;
      audio.sirenOsc.frequency.value = audio.sirenPhase < 60 ? 700 : 950;
    }
  };
  return audio;
}
