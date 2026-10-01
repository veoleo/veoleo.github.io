// Motor de sonido cinematográfico sintetizado con Web Audio (sin ficheros).
// Todos los efectos se generan al vuelo: whoosh, braam, ticks, chime...

let ctx = null, master = null, reverb = null, noiseBuf = null;
let enabled = readPref('tvd.sound', 'on') === 'on';
let volume = Number(readPref('tvd.volume', '0.45'));
let lastHover = 0;

function readPref(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function writePref(k, v) { try { localStorage.setItem(k, v); } catch { /* sin storage */ } }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    reverb.connect(wet); wet.connect(master);
    noiseBuf = makeNoise();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function impulse(sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
function makeNoise() {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function out(node, wetAmount = 0.3) {
  node.connect(master);
  if (wetAmount > 0) {
    const s = ctx.createGain(); s.gain.value = wetAmount; node.connect(s); s.connect(reverb);
  }
}
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function play(fn) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  try { fn(c, c.currentTime + 0.01); } catch (e) { console.warn('[Veoleo] sfx', e); }
}

export const sfx = {
  // Apertura: barrido ascendente + golpe grave muy suave (modales, fichas).
  open() {
    play((c, t) => {
      const src = c.createBufferSource(); src.buffer = noiseBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.32);
      const g = c.createGain(); env(g, t, 0.12, 0.16, 0.26);
      src.connect(bp); bp.connect(g); out(g, 0.45); src.start(t); src.stop(t + 0.5);
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(90, t + 0.05); o.frequency.exponentialRampToValueAtTime(42, t + 0.5);
      const og = c.createGain(); env(og, t + 0.05, 0.01, 0.22, 0.5);
      o.connect(og); out(og, 0.3); o.start(t + 0.05); o.stop(t + 0.7);
    });
  },
  close() {
    play((c, t) => {
      const src = c.createBufferSource(); src.buffer = noiseBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(3000, t); bp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
      const g = c.createGain(); env(g, t, 0.05, 0.1, 0.22);
      src.connect(bp); bp.connect(g); out(g, 0.2); src.start(t); src.stop(t + 0.4);
    });
  },
  // Barrido de aire filtrado: transiciones de página y modales.
  whoosh(dir = 1) {
    play((c, t) => {
      const src = c.createBufferSource(); src.buffer = noiseBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      const [f0, f1] = dir > 0 ? [260, 3200] : [3000, 220];
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + 0.42);
      const g = c.createGain(); env(g, t, 0.14, 0.26, 0.32);
      src.connect(bp); bp.connect(g); out(g, 0.35);
      src.start(t); src.stop(t + 0.7);
    });
  },
  // "BRAAAM" de tráiler: guardar, logros, intro.
  braam(intensity = 0.55) {
    play((c, t) => {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
      lp.frequency.setValueAtTime(90, t);
      lp.frequency.exponentialRampToValueAtTime(1100 * intensity, t + 0.35);
      lp.frequency.exponentialRampToValueAtTime(140, t + 2.4);
      const g = c.createGain(); env(g, t, 0.04, 0.5 * intensity, 2.6);
      lp.connect(g); out(g, 0.6);
      for (const [f, det] of [[43.65, 0], [43.65, 9], [65.41, -7], [87.31, 5], [130.81, -4]]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + 3);
      }
      const n = c.createBufferSource(); n.buffer = noiseBuf;
      const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500;
      const ng = c.createGain(); env(ng, t, 0.005, 0.5 * intensity, 0.45);
      n.connect(nf); nf.connect(ng); out(ng, 0.4); n.start(t); n.stop(t + 0.6);
    });
  },
  // Subida tensa antes de un impacto.
  riser(sec = 1.2) {
    play((c, t) => {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + sec);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(4000, t + sec);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + sec * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + sec + 0.05);
      o.connect(lp); lp.connect(g); out(g, 0.5); o.start(t); o.stop(t + sec + 0.1);
      const n = c.createBufferSource(); n.buffer = noiseBuf;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(400, t); hp.frequency.exponentialRampToValueAtTime(6000, t + sec);
      const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.18, t + sec); ng.gain.exponentialRampToValueAtTime(0.0001, t + sec + 0.05);
      n.connect(hp); hp.connect(ng); out(ng, 0.3); n.start(t); n.stop(t + sec + 0.1);
    });
  },
  // Tick metálico para estrellas (sube de tono por paso).
  tick(step = 0) {
    play((c, t) => {
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.value = 660 * Math.pow(2, step / 6);
      const g = c.createGain(); env(g, t, 0.004, 0.22, 0.12);
      o.connect(g); out(g, 0.25); o.start(t); o.stop(t + 0.2);
    });
  },
  hover() {
    const now = performance.now(); if (now - lastHover < 70) return; lastHover = now;
    play((c, t) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 2200;
      const g = c.createGain(); env(g, t, 0.002, 0.03, 0.04);
      o.connect(g); out(g, 0); o.start(t); o.stop(t + 0.08);
    });
  },
  click() {
    play((c, t) => {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = c.createGain(); env(g, t, 0.002, 0.12, 0.07);
      o.connect(lp); lp.connect(g); out(g, 0.1); o.start(t); o.stop(t + 0.1);
    });
  },
  // Arpegio brillante: reto completado, logros.
  chime() {
    play((c, t) => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = c.createGain(); env(g, t + i * 0.085, 0.01, 0.16, 1.1);
        o.connect(g); out(g, 0.6); o.start(t + i * 0.085); o.stop(t + i * 0.085 + 1.3);
      });
    });
  },
  pop() {
    play((c, t) => {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(980, t + 0.09);
      const g = c.createGain(); env(g, t, 0.005, 0.25, 0.16);
      o.connect(g); out(g, 0.3); o.start(t); o.stop(t + 0.25);
    });
  },
  error() {
    play((c, t) => {
      [220, 185].forEach((f, i) => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const g = c.createGain(); env(g, t + i * 0.12, 0.01, 0.12, 0.18);
        o.connect(lp); lp.connect(g); out(g, 0.2); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.3);
      });
    });
  },
};

export function isSoundOn() { return enabled; }
export function setSound(on) {
  enabled = !!on; writePref('tvd.sound', enabled ? 'on' : 'off');
  if (enabled) sfx.pop();
}
export function getVolume() { return volume; }
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, Number(v)));
  writePref('tvd.volume', String(volume));
  if (master) master.gain.value = volume;
}
// Desbloquea el AudioContext en el primer gesto del usuario.
export function unlockAudio() {
  const h = () => { if (enabled) ac(); window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  window.addEventListener('pointerdown', h); window.addEventListener('keydown', h);
}
