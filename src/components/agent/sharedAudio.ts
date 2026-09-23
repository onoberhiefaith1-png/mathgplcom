// One audio device for Aura's voice, for the whole visit.
//
// Phones only let a page make sound after a real tap, and they charge a startup
// cost every time a new device is opened. Opening one device on the tap that
// starts a call — and keeping it — is what removes clipped first words and the
// silence that used to follow a screen lock.

export const SPEECH_SAMPLE_RATE = 24000;

let context: AudioContext | null = null;

type AudioContextCtor = new (options?: { sampleRate?: number }) => AudioContext;

function constructor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** The one output device, created on first use and reused from then on. */
export function sharedAudioContext(): AudioContext | null {
  if (context && context.state !== "closed") return context;
  const Ctor = constructor();
  if (!Ctor) return null;
  context = new Ctor({ sampleRate: SPEECH_SAMPLE_RATE });
  return context;
}

/**
 * Called from the tap that starts a call or a spoken reply: a device opened
 * during a real gesture is allowed to make sound afterwards.
 */
export async function unlockSharedAudio(): Promise<AudioContext | null> {
  const active = sharedAudioContext();
  if (!active) return null;
  if (active.state === "suspended") {
    try {
      await active.resume();
    } catch {
      /* a device that refuses to resume is reported by playback itself */
    }
  }
  return active;
}
