let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function noise(duration, gainVal, filterFreq) {
  const c = getCtx();
  const samples = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, samples, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;

  const gain = c.createGain();
  gain.gain.setValueAtTime(gainVal, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start();
  src.stop(c.currentTime + duration);
}

function tone(frequency, duration, gainVal, type = 'sine', startTime = 0) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, c.currentTime + startTime);
  gain.gain.setValueAtTime(gainVal, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration);
}

function safe(fn) {
  try { fn(); } catch { /* never let audio errors crash React */ }
}

export function playMove()        { safe(() => noise(0.06, 0.18, 1800)); }
export function playCapture()     { safe(() => { noise(0.12, 0.35, 900); tone(180, 0.12, 0.1, 'triangle'); }); }
export function playCheck()       { safe(() => { tone(660, 0.08, 0.25, 'sine'); tone(880, 0.12, 0.18, 'sine', 0.07); }); }
export function playDrawOffer() {
  safe(() => { tone(440, 0.1, 0.15, 'sine'); tone(528, 0.12, 0.12, 'sine', 0.1); });
}

export function playGameOver(won) {
  safe(() => {
    if (won === true) {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 0.15, 'sine', i * 0.13));
    } else {
      [523, 415, 349, 262].forEach((f, i) => tone(f, 0.28, 0.15, 'sine', i * 0.14));
    }
  });
}
