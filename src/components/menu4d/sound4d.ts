import type { Effect4D } from "./effects";

/**
 * The "sound" in 4D: a soft sizzle for hot dishes, fizz for cold drinks and
 * a glint for everything else, made live with Web Audio (no files to load).
 * Off until the guest taps the sound button; a short buzz on phones that vibrate.
 */
let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function stopSound() { stopCurrent?.(); stopCurrent = null; }

export function playEffectSound(effect: Effect4D) {
  stopSound();
  const ac = audio();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(0.5, ac.currentTime + 0.4);
  master.connect(ac.destination);
  const timers: number[] = [];
  const nodes: AudioScheduledSourceNode[] = [];

  if (effect === "steam") {
    // Sizzle: band-passed noise with crackles
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac, 2); src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3800; bp.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = 0.18;
    src.connect(bp).connect(g).connect(master); src.start(); nodes.push(src);
    const crackle = () => {
      const t = ac.currentTime;
      const c = ac.createBufferSource(); c.buffer = noiseBuffer(ac, 0.03);
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2500;
      const cg = ac.createGain(); cg.gain.setValueAtTime(0.25 + Math.random() * 0.35, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      c.connect(hp).connect(cg).connect(master); c.start(t);
      timers.push(window.setTimeout(crackle, 40 + Math.random() * 160));
    };
    crackle();
    if ("vibrate" in navigator) try { navigator.vibrate([18, 60, 12]); } catch { /* not allowed */ }
  } else if (effect === "fizz") {
    // Fizz: quick high bubbles
    const pop = () => {
      const t = ac.currentTime;
      const o = ac.createOscillator(); o.type = "sine";
      const f = 1400 + Math.random() * 2600; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.05);
      const g = ac.createGain(); g.gain.setValueAtTime(0.05 + Math.random() * 0.08, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.07);
      timers.push(window.setTimeout(pop, 15 + Math.random() * 70));
    };
    pop();
  } else {
    // Glint / foil: a soft two-note chime
    [880, 1320].forEach((f, i) => {
      const t = ac.currentTime + i * 0.12;
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1); nodes.push(o);
    });
  }

  stopCurrent = () => {
    timers.forEach((t) => window.clearTimeout(t));
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.25);
    window.setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); master.disconnect(); }, 300);
  };
}

const KEY = "m4d-sound";
export const soundPreferred = () => { try { return localStorage.getItem(KEY) === "on"; } catch { return false; } };
export const setSoundPreferred = (on: boolean) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ } };
