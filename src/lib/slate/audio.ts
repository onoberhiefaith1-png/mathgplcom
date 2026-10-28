// Reward audio. Every cue is synthesised in the browser at play time, so the
// sounds are layered, tiny and perfectly synchronised with the visual events
// they belong to. No network, no assets, no loading delay.

export type SfxName =
  | "vault-activate"
  | "vault-unlock"
  | "vault-reveal"
  | "bomb-blast"
  | "bomb-debris"
  | "premium-blast"
  | "premium-impact"
  | "collector-charge"
  | "collector-attract"
  | "collector-hit"
  | "collector-burst"
  | "heart"
  | "time"
  | "seal";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

const MUTE_KEY = "slate.muted";

if (typeof window !== "undefined") {
  muted = window.localStorage.getItem(MUTE_KEY) === "1";
}

export const isMuted = () => muted;

export function setMuted(next: boolean) {
  muted = next;
  if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.02);
}

function engine() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  const length = c.sampleRate * 2;
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

interface ToneOptions {
  type?: OscillatorType;
  from: number;
  to?: number;
  at?: number;
  duration: number;
  gain?: number;
  attack?: number;
}

function tone(c: AudioContext, o: ToneOptions) {
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to && o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.duration);
  const peak = o.gain ?? 0.2;
  const attack = o.attack ?? 0.008;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
  osc.connect(amp).connect(master!);
  osc.start(t);
  osc.stop(t + o.duration + 0.05);
}

interface NoiseOptions {
  at?: number;
  duration: number;
  gain?: number;
  filter?: BiquadFilterType;
  from: number;
  to?: number;
  q?: number;
}

function hiss(c: AudioContext, o: NoiseOptions) {
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.filter ?? "bandpass";
  filter.frequency.setValueAtTime(o.from, t);
  if (o.to && o.to !== o.from) filter.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + o.duration);
  filter.Q.value = o.q ?? 1;
  const amp = c.createGain();
  const peak = o.gain ?? 0.2;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.duration);
  src.connect(filter).connect(amp).connect(master!);
  src.start(t);
  src.stop(t + o.duration + 0.05);
}

/** Play one layered cue. Safe to call from any animation callback. */
export function playSfx(name: SfxName) {
  if (muted) return;
  const c = engine();
  if (!c || !master) return;

  switch (name) {
    case "vault-activate":
      tone(c, { type: "triangle", from: 180, to: 520, duration: 0.5, gain: 0.12 });
      hiss(c, { from: 700, to: 2600, duration: 0.5, gain: 0.05, q: 2 });
      break;
    case "vault-unlock":
      tone(c, { type: "square", from: 320, to: 120, duration: 0.14, gain: 0.1 });
      tone(c, { type: "sine", from: 90, to: 60, duration: 0.3, gain: 0.18 });
      hiss(c, { from: 2200, to: 500, duration: 0.25, gain: 0.12, q: 0.8 });
      break;
    case "vault-reveal":
      [0, 0.06, 0.13].forEach((at, i) =>
        tone(c, { type: "sine", from: 880 * Math.pow(1.26, i), duration: 0.5, gain: 0.07, at }),
      );
      hiss(c, { from: 5200, to: 9000, duration: 0.6, gain: 0.035, q: 3, at: 0.05 });
      tone(c, { type: "triangle", from: 440, to: 660, duration: 0.6, gain: 0.06, at: 0.2 });
      break;
    case "bomb-blast":
      tone(c, { type: "sine", from: 160, to: 28, duration: 1.4, gain: 0.5, attack: 0.004 });
      hiss(c, { filter: "lowpass", from: 6000, to: 200, duration: 1.1, gain: 0.45 });
      hiss(c, { from: 2400, to: 900, duration: 0.35, gain: 0.2, q: 0.5 });
      break;
    case "bomb-debris":
      hiss(c, { filter: "highpass", from: 2400, to: 900, duration: 1.4, gain: 0.07 });
      [0.1, 0.32, 0.55, 0.84].forEach((at) =>
        tone(c, { type: "triangle", from: 200 + Math.random() * 300, to: 80, duration: 0.12, gain: 0.05, at }),
      );
      break;
    case "premium-blast":
      tone(c, { type: "sine", from: 210, to: 34, duration: 1.25, gain: 0.5, attack: 0.003 });
      tone(c, { type: "triangle", from: 960, to: 180, duration: 0.72, gain: 0.16, attack: 0.002 });
      hiss(c, { filter: "lowpass", from: 9000, to: 240, duration: 1.3, gain: 0.42 });
      break;
    case "premium-impact":
      tone(c, { type: "sine", from: 1180, to: 430, duration: 0.18, gain: 0.1, attack: 0.002 });
      hiss(c, { from: 6000, to: 1800, duration: 0.16, gain: 0.07, q: 2.8 });
      break;
    case "collector-charge":
      tone(c, { type: "sawtooth", from: 110, to: 440, duration: 0.45, gain: 0.08 });
      break;
    case "collector-attract":
      hiss(c, { from: 400, to: 3000, duration: 0.7, gain: 0.07, q: 1.6 });
      break;
    case "collector-hit":
      tone(c, { type: "square", from: 720, to: 1400, duration: 0.09, gain: 0.08 });
      hiss(c, { from: 3000, to: 1200, duration: 0.1, gain: 0.06 });
      break;
    case "collector-burst":
      tone(c, { type: "sine", from: 300, to: 90, duration: 0.5, gain: 0.22 });
      hiss(c, { filter: "lowpass", from: 4000, to: 400, duration: 0.45, gain: 0.16 });
      break;
    case "heart":
      tone(c, { type: "sine", from: 392, duration: 0.35, gain: 0.12 });
      tone(c, { type: "sine", from: 587, duration: 0.5, gain: 0.1, at: 0.12 });
      break;
    case "time":
      tone(c, { type: "triangle", from: 660, to: 1320, duration: 0.5, gain: 0.09 });
      hiss(c, { from: 6000, to: 3000, duration: 0.4, gain: 0.03, q: 4, at: 0.1 });
      break;
    case "seal":
      tone(c, { type: "sine", from: 520, to: 260, duration: 0.2, gain: 0.07 });
      break;
  }
}
