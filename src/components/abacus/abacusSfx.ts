// Tiny WebAudio helpers — no assets, no deps.
let ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
};

const tone = (freq: number, durMs: number, type: OscillatorType = "sine", vol = 0.08) => {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g).connect(c.destination);
  const t = c.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + durMs / 1000);
  o.start(t);
  o.stop(t + durMs / 1000);
};

export const sfxClick = () => tone(520, 70, "triangle", 0.06);
export const sfxSuccess = () => {
  tone(660, 120, "sine", 0.09);
  setTimeout(() => tone(880, 160, "sine", 0.09), 110);
  setTimeout(() => tone(1175, 220, "sine", 0.09), 240);
};
export const sfxError = () => tone(140, 220, "sawtooth", 0.07);
