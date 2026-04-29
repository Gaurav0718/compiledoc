let ctx = null;

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// MacBook-style click — soft, dampened, tactile feel
// Modelled after the MacBook trackpad: a very short, low-mid thud with smooth decay
function macClick(vol = 0.22) {
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;

    // Primary body: very short sine burst at ~120Hz (the "thud" of plastic/metal)
    const osc1 = c.createOscillator();
    const g1   = c.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(130, t);
    osc1.frequency.exponentialRampToValueAtTime(60, t + 0.028);
    g1.gain.setValueAtTime(vol, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc1.connect(g1); g1.connect(c.destination);
    osc1.start(t); osc1.stop(t + 0.05);

    // Soft high transient: very faint click attack (~2kHz, very short)
    const osc2 = c.createOscillator();
    const g2   = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1800;
    g2.gain.setValueAtTime(vol * 0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    osc2.connect(g2); g2.connect(c.destination);
    osc2.start(t); osc2.stop(t + 0.015);

    // Light noise layer — adds texture without harshness
    const buf  = c.createBuffer(1, Math.floor(c.sampleRate * 0.018), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    // Low-pass to remove high-frequency harshness
    const lpf = c.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 900;
    const ng = c.createGain();
    ng.gain.value = vol * 0.3;
    src.connect(lpf); lpf.connect(ng); ng.connect(c.destination);
    src.start(t);
  } catch {}
}

function playTone({ freq = 440, type = 'sine', duration = 0.1, gain = 0.1, endFreq }) {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + duration);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(); osc.stop(c.currentTime + duration + 0.02);
  } catch {}
}

export const sounds = {
  tap:     () => macClick(0.22),
  success: () => {
    macClick(0.16);
    setTimeout(() => playTone({ freq: 523, type: 'sine', duration: 0.10, gain: 0.08 }), 60);
    setTimeout(() => playTone({ freq: 659, type: 'sine', duration: 0.10, gain: 0.08 }), 130);
    setTimeout(() => playTone({ freq: 784, type: 'sine', duration: 0.15, gain: 0.09 }), 200);
  },
  error:   () => {
    playTone({ freq: 280, type: 'sine', duration: 0.12, gain: 0.10 });
    setTimeout(() => playTone({ freq: 220, type: 'sine', duration: 0.14, gain: 0.08 }), 80);
  },
  delete:  () => { macClick(0.18); setTimeout(() => playTone({ freq: 300, type: 'sine', duration: 0.10, gain: 0.07 }), 25); },
  nav:     () => macClick(0.20),
  pop:     () => macClick(0.18),
};

// Splash intro — gentle ascending arpeggio, not too loud
export function playSplashMusic() {
  const c = getCtx();
  if (!c) return;
  const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 783.9];
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone({ freq, type: 'sine', duration: 0.28, gain: 0.07 });
      playTone({ freq: freq * 2, type: 'sine', duration: 0.18, gain: 0.025 });
    }, i * 190);
  });
  // Final sustain chord
  setTimeout(() => {
    [523.3, 659.3, 783.9].forEach(f => playTone({ freq: f, type: 'sine', duration: 0.55, gain: 0.055 }));
  }, notes.length * 190 + 40);
}

export function initSounds() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, [data-sound], .filter-chip, .mode-card, .cat-btn, .member-item');
    if (el) macClick(0.22);
  }, { passive: true });
}

