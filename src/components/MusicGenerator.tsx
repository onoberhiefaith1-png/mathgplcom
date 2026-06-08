import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { Download, Loader2, Play, Square } from "lucide-react";

/**
 * Procedurally generates 4 seamless looping background tracks in-browser
 * using Tone.js + Tone.Offline, then encodes them to WAV for download.
 *
 * No external API or paid plan required.
 */

type TrackId = "main_menu_loop" | "gameplay_loop" | "thinking_loop" | "success_jingle";

type TrackDef = {
  id: TrackId;
  title: string;
  description: string;
  durationSec: number;
  bpm: number;
  render: (durationSec: number, bpm: number) => Promise<Tone.ToneAudioBuffer>;
};

// ------------- Music theory helpers -------------
const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};
const SEMI_TO_NOTE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const noteToFreq = (note: string) => {
  const m = note.match(/^([A-G]#?b?)(-?\d+)$/);
  if (!m) return 440;
  const semis = NOTE_TO_SEMITONE[m[1]];
  const oct = parseInt(m[2], 10);
  const midi = (oct + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const transpose = (note: string, semitones: number) => {
  const m = note.match(/^([A-G]#?b?)(-?\d+)$/);
  if (!m) return note;
  const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE_TO_SEMITONE[m[1]] + semitones;
  const oct = Math.floor(midi / 12) - 1;
  return `${SEMI_TO_NOTE[midi % 12]}${oct}`;
};

// ------------- Track renderers -------------

// 1. Main Menu Loop — calm, hopeful, ambient pad with a soft arpeggio.
const renderMainMenu = async (duration: number, bpm: number) => {
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm;

    const reverb = new Tone.Reverb({ decay: 6, wet: 0.45 }).toDestination();
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.3, wet: 0.25 }).connect(reverb);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 1.2, decay: 0.3, sustain: 0.8, release: 2.5 },
      volume: -14,
    }).connect(reverb);

    const bell = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 1.4 },
      volume: -16,
    }).connect(delay);

    // C major: C - Am - F - G  (each 2 bars => 8 bars total)
    const chords: string[][] = [
      ["C3", "E3", "G3", "B3"],
      ["A2", "C3", "E3", "G3"],
      ["F2", "A2", "C3", "E3"],
      ["G2", "B2", "D3", "F3"],
    ];
    const arp = ["C5", "E5", "G5", "B5", "A5", "G5", "E5", "C5"];

    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;
    const totalBars = Math.floor(duration / barSec);

    for (let bar = 0; bar < totalBars; bar++) {
      const chord = chords[Math.floor(bar / 2) % chords.length];
      const t = bar * barSec;
      pad.triggerAttackRelease(chord, barSec * 1.9, t);
      // Arpeggio every other bar
      if (bar % 2 === 1) {
        for (let i = 0; i < arp.length; i++) {
          bell.triggerAttackRelease(arp[i], "8n", t + i * (beatSec / 2));
        }
      }
    }

    transport.start();
  }, duration, 2);
};

// 2. Gameplay Loop — playful, light groove with a bouncy bass and pluck melody.
const renderGameplay = async (duration: number, bpm: number) => {
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm;

    const reverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).toDestination();
    const comp = new Tone.Compressor(-18, 3).connect(reverb);

    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 },
      filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.2, baseFrequency: 200, octaves: 2 },
      volume: -10,
    }).connect(comp);

    const pluck = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.7, volume: -8 }).connect(comp);

    const lead = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 },
      volume: -22,
    }).connect(comp);

    // Hat
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
      volume: -28,
    }).connect(comp);

    // Kick
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -6,
    }).connect(comp);

    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;
    const totalBars = Math.floor(duration / barSec);

    // Chord progression in C major: C - G - Am - F
    const roots = ["C2", "G2", "A2", "F2"];
    const melodyPattern = ["C5", "E5", "G5", "E5", "F5", "A5", "G5", "E5"];
    const pluckPattern = ["C4", "E4", "G4", "B4"];

    for (let bar = 0; bar < totalBars; bar++) {
      const t = bar * barSec;
      const root = roots[bar % roots.length];

      // Bass on each beat with octave bounce
      for (let b = 0; b < 4; b++) {
        const note = b % 2 === 0 ? root : transpose(root, 12);
        bass.triggerAttackRelease(note, "8n", t + b * beatSec);
      }
      // Kick on 1 & 3
      kick.triggerAttackRelease("C2", "8n", t);
      kick.triggerAttackRelease("C2", "8n", t + 2 * beatSec);
      // Hats on offbeats (8ths)
      for (let i = 0; i < 8; i++) {
        if (i % 2 === 1) hat.triggerAttackRelease("16n", t + i * (beatSec / 2));
      }
      // Pluck arpeggio
      for (let i = 0; i < 8; i++) {
        pluck.triggerAttackRelease(transpose(pluckPattern[i % pluckPattern.length], 0), t + i * (beatSec / 2));
      }
      // Lead melody every other bar
      if (bar % 2 === 0) {
        for (let i = 0; i < melodyPattern.length; i++) {
          lead.triggerAttackRelease(melodyPattern[i], "16n", t + i * (beatSec / 2));
        }
      }
    }

    transport.start();
  }, duration, 2);
};

// 3. Thinking Loop — sparse, contemplative, slow pulse with soft ticks.
const renderThinking = async (duration: number, bpm: number) => {
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm;

    const reverb = new Tone.Reverb({ decay: 8, wet: 0.55 }).toDestination();
    const filter = new Tone.Filter(900, "lowpass").connect(reverb);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 0.5, sustain: 0.7, release: 4 },
      volume: -18,
    }).connect(filter);

    const tick = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.15, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 4000,
      octaves: 0.5,
      volume: -34,
    }).connect(reverb);

    // Dm – Am  (minor, contemplative). 8 bars of slow pad.
    const chords: string[][] = [
      ["D3", "F3", "A3"],
      ["A2", "C3", "E3"],
    ];

    const beatSec = 60 / bpm;
    const barSec = beatSec * 4;
    const totalBars = Math.floor(duration / barSec);

    for (let bar = 0; bar < totalBars; bar++) {
      const t = bar * barSec;
      pad.triggerAttackRelease(chords[bar % chords.length], barSec * 1.95, t);
      // Sparse tick on beat 2 and 4
      tick.triggerAttackRelease("16n", t + beatSec);
      tick.triggerAttackRelease("16n", t + 3 * beatSec);
    }

    transport.start();
  }, duration, 2);
};

// 4. Success Jingle — short triumphant fanfare (non-looping).
const renderSuccess = async (duration: number, bpm: number) => {
  return Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm;

    const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination();
    const horns = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 },
      volume: -12,
    }).connect(reverb);

    const bell = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.6, sustain: 0.1, release: 1.5 },
      volume: -10,
    }).connect(reverb);

    const beatSec = 60 / bpm;

    // Rising fanfare in C major: G – C – E – G – C(high)
    const fanfare: { note: string | string[]; t: number; dur: string }[] = [
      { note: ["G3", "C4"], t: 0, dur: "8n" },
      { note: ["C4", "E4"], t: beatSec * 0.5, dur: "8n" },
      { note: ["E4", "G4"], t: beatSec * 1, dur: "8n" },
      { note: ["G4", "C5"], t: beatSec * 1.5, dur: "4n" },
      { note: ["C4", "E4", "G4", "C5"], t: beatSec * 2.5, dur: "2n" },
    ];
    fanfare.forEach((n) => horns.triggerAttackRelease(n.note as any, n.dur, n.t));

    // Sparkle
    ["C6", "E6", "G6", "C7"].forEach((n, i) =>
      bell.triggerAttackRelease(n, "16n", beatSec * 2.5 + i * 0.08)
    );
  }, duration, 2);
};

const TRACKS: TrackDef[] = [
  {
    id: "main_menu_loop",
    title: "Main Menu Loop",
    description: "Calm, hopeful pad with a soft sparkle arpeggio.",
    durationSec: 16,
    bpm: 80,
    render: renderMainMenu,
  },
  {
    id: "gameplay_loop",
    title: "Gameplay Loop",
    description: "Light, playful groove with bouncy bass and pluck melody.",
    durationSec: 16,
    bpm: 110,
    render: renderGameplay,
  },
  {
    id: "thinking_loop",
    title: "Thinking Loop",
    description: "Sparse contemplative pad in D minor with soft ticks.",
    durationSec: 16,
    bpm: 60,
    render: renderThinking,
  },
  {
    id: "success_jingle",
    title: "Success Jingle",
    description: "Short triumphant rising fanfare with bell sparkle.",
    durationSec: 4,
    bpm: 120,
    render: renderSuccess,
  },
];

// ------------- WAV encoder (16-bit PCM) -------------
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChan * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);
  const writeStr = (offs: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offs + i, s.charCodeAt(i));
  };

  let offset = 0;
  writeStr(offset, "RIFF"); offset += 4;
  view.setUint32(offset, length - 8, true); offset += 4;
  writeStr(offset, "WAVE"); offset += 4;
  writeStr(offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChan, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numChan * 2, true); offset += 4;
  view.setUint16(offset, numChan * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeStr(offset, "data"); offset += 4;
  view.setUint32(offset, buffer.length * numChan * 2, true); offset += 4;

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChan; c++) channels.push(buffer.getChannelData(c));

  let pos = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChan; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      pos += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ------------- UI -------------
type GenState = {
  loading: boolean;
  url: string | null;
  blob: Blob | null;
};

const MusicGenerator = () => {
  const [state, setState] = useState<Record<TrackId, GenState>>(() =>
    TRACKS.reduce((acc, t) => {
      acc[t.id] = { loading: false, url: null, blob: null };
      return acc;
    }, {} as Record<TrackId, GenState>)
  );
  const [batchLoading, setBatchLoading] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => () => {
    Object.values(state).forEach((s) => s.url && URL.revokeObjectURL(s.url));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (track: TrackDef) => {
    setState((s) => ({ ...s, [track.id]: { ...s[track.id], loading: true } }));
    try {
      const buf = await track.render(track.durationSec, track.bpm);
      const wav = audioBufferToWav(buf.get() as AudioBuffer);
      const url = URL.createObjectURL(wav);
      setState((s) => {
        if (s[track.id].url) URL.revokeObjectURL(s[track.id].url!);
        return { ...s, [track.id]: { loading: false, url, blob: wav } };
      });
    } catch (e) {
      console.error(`Failed to generate ${track.id}`, e);
      setState((s) => ({ ...s, [track.id]: { ...s[track.id], loading: false } }));
    }
  };

  const generateAll = async () => {
    setBatchLoading(true);
    for (const t of TRACKS) await generate(t);
    setBatchLoading(false);
  };

  const downloadOne = (track: TrackDef) => {
    const s = state[track.id];
    if (s.blob) downloadBlob(s.blob, `${track.id}.wav`);
  };

  const downloadAll = () => {
    TRACKS.forEach((t) => {
      const s = state[t.id];
      if (s.blob) downloadBlob(s.blob, `${t.id}.wav`);
    });
  };

  const allReady = TRACKS.every((t) => state[t.id].blob);

  return (
    <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
      <div className="rounded-2xl border border-border/40 bg-background/70 p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Procedural Music Generator</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generated entirely in-browser with Tone.js — no API key, no paid plan.
              Click <em>Generate</em> on any track, then preview and download as WAV.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateAll}
              disabled={batchLoading}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {batchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {batchLoading ? "Generating…" : "Generate All"}
            </button>
            <button
              onClick={downloadAll}
              disabled={!allReady}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-sm font-medium transition hover:bg-background disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Download All
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {TRACKS.map((t) => {
            const s = state[t.id];
            return (
              <div
                key={t.id}
                className="rounded-xl border border-border/40 bg-background/50 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.description} • {t.durationSec}s • {t.bpm} BPM
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => generate(t)}
                      disabled={s.loading}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      {s.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : s.url ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {s.loading ? "Rendering…" : s.url ? "Regenerate" : "Generate"}
                    </button>
                    <button
                      onClick={() => downloadOne(t)}
                      disabled={!s.blob}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium transition hover:bg-background disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      WAV
                    </button>
                  </div>
                </div>

                {s.url && (
                  <audio
                    ref={(el) => (audioRefs.current[t.id] = el)}
                    src={s.url}
                    controls
                    loop={t.id !== "success_jingle"}
                    className="mt-3 w-full"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MusicGenerator;
