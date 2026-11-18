// Port Verano — all sound is synthesized live with WebAudio. No audio
// files, no network: engine hum, sirens, gunshots, pickups and a small
// bass-driven street loop, built from oscillators and filtered noise.

export function createAudio() {
  const sys = {
    ctx: null,
    master: null,
    muted: false,
    musicOn: false,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    musicTimer: null,
    musicStep: 0,
  };

  sys.init = function init() {
    if (sys.ctx) {
      if (sys.ctx.state === 'suspended') sys.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    sys.ctx = new AC();
    sys.master = sys.ctx.createGain();
    sys.master.gain.value = sys.muted ? 0 : 0.5;
    sys.master.connect(sys.ctx.destination);
    // Engine: a sawtooth through a low-pass, pitch follows speed.
    sys.engineOsc = sys.ctx.createOscillator();
    sys.engineOsc.type = 'sawtooth';
    sys.engineOsc.frequency.value = 55;
    sys.engineFilter = sys.ctx.createBiquadFilter();
    sys.engineFilter.type = 'lowpass';
    sys.engineFilter.frequency.value = 420;
    sys.engineGain = sys.ctx.createGain();
    sys.engineGain.gain.value = 0;
    sys.engineOsc.connect(sys.engineFilter);
    sys.engineFilter.connect(sys.engineGain);
    sys.engineGain.connect(sys.master);
    sys.engineOsc.start();
    // Siren: a square wave whose pitch flips between two tones.
    sys.sirenOsc = sys.ctx.createOscillator();
    sys.sirenOsc.type = 'square';
    sys.sirenOsc.frequency.value = 720;
    sys.sirenGain = sys.ctx.createGain();
    sys.sirenGain.gain.value = 0;
    sys.sirenOsc.connect(sys.sirenGain);
    sys.sirenGain.connect(sys.master);
    sys.sirenOsc.start();
  };

  sys.setMuted = function setMuted(m) {
    sys.muted = m;
    if (sys.master) sys.master.gain.value = m ? 0 : 0.5;
  };

  sys.engine = function engine(speedRatio, on) {
    if (!sys.ctx) return;
    const target = on ? 0.05 + speedRatio * 0.075 : 0;
    sys.engineGain.gain.setTargetAtTime(target, sys.ctx.currentTime, 0.08);
    sys.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, sys.ctx.currentTime, 0.08);
    sys.engineFilter.frequency.setTargetAtTime(380 + speedRatio * 900, sys.ctx.currentTime, 0.1);
  };

  sys.siren = function siren(on) {
    if (!sys.ctx) return;
    if (on) {
      sys.sirenGain.gain.setTargetAtTime(0.035, sys.ctx.currentTime, 0.2);
      sys.sirenTimer += 1;
      const high = Math.floor(sys.sirenTimer / 22) % 2 === 0;
      sys.sirenOsc.frequency.setTargetAtTime(high ? 880 : 620, sys.ctx.currentTime, 0.05);
    } else {
      sys.sirenGain.gain.setTargetAtTime(0, sys.ctx.currentTime, 0.2);
    }
  };

  function noiseBurst(duration, filterFreq, gainValue) {
    if (!sys.ctx) return;
    const len = Math.floor(sys.ctx.sampleRate * duration);
    const buffer = sys.ctx.createBuffer(1, len, sys.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = sys.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = sys.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = sys.ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sys.master);
    src.start();
  }

  function tone(freq, duration, type, gainValue, when = 0) {
    if (!sys.ctx) return;
    const t0 = sys.ctx.currentTime + when;
    const osc = sys.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = sys.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(sys.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  sys.shot = function shot() {
    noiseBurst(0.14, 1800, 0.5);
    tone(140, 0.1, 'square', 0.25);
  };

  sys.punch = function punch() {
    noiseBurst(0.08, 900, 0.35);
  };

  sys.crash = function crash(hard) {
    noiseBurst(hard ? 0.3 : 0.15, 700, hard ? 0.5 : 0.3);
    tone(70, 0.18, 'sine', 0.4);
  };

  sys.pickup = function pickup() {
    tone(660, 0.12, 'sine', 0.3);
    tone(990, 0.18, 'sine', 0.3, 0.09);
  };

  sys.cash = function cash() {
    tone(880, 0.1, 'triangle', 0.3);
    tone(1174, 0.1, 'triangle', 0.3, 0.08);
    tone(1568, 0.22, 'triangle', 0.3, 0.16);
  };

  sys.jingle = function jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.32, i * 0.11));
  };

  sys.fail = function fail() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => tone(n, 0.3, 'sawtooth', 0.18, i * 0.16));
  };

  sys.door = function door() {
    tone(220, 0.06, 'square', 0.15);
    noiseBurst(0.05, 1200, 0.15);
  };

  // A short bass loop with a hat tick: the street music.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3, 55, 0, 55, 65.4, 73.4, 65.4, 58.3, 49];
  sys.startMusic = function startMusic() {
    if (!sys.ctx || sys.musicOn) return;
    sys.musicOn = true;
    sys.musicStep = 0;
    sys.musicTimer = setInterval(() => {
      if (!sys.ctx || sys.muted) return;
      const note = BASS[sys.musicStep % BASS.length];
      if (note > 0) tone(note, 0.24, 'sine', 0.22);
      if (sys.musicStep % 2 === 0) noiseBurst(0.03, 6000, 0.05);
      sys.musicStep += 1;
    }, 210);
  };

  sys.stopMusic = function stopMusic() {
    if (sys.musicTimer) clearInterval(sys.musicTimer);
    sys.musicTimer = null;
    sys.musicOn = false;
  };

  return sys;
}
