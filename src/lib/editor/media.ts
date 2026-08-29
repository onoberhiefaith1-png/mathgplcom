export interface Thumbnail {
  time: number;
  url: string;
}

/** Grab evenly spaced frames from the source file, drawn in the browser. */
export async function generateThumbnails(
  file: File,
  duration: number,
  count = 16,
): Promise<Thumbnail[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  const thumbs: Thumbnail[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("thumbnail source failed to load"));
    });

    const canvas = document.createElement("canvas");
    const height = 96;
    const ratio = (video.videoWidth || 16) / (video.videoHeight || 9);
    canvas.height = height;
    canvas.width = Math.max(1, Math.round(height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return thumbs;

    for (let i = 0; i < count; i++) {
      const time = (duration * (i + 0.5)) / count;
      await new Promise<void>((resolve) => {
        const done = () => {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        video.currentTime = Math.min(time, Math.max(0, duration - 0.05));
        setTimeout(done, 2000);
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      thumbs.push({ time, url: canvas.toDataURL("image/jpeg", 0.6) });
    }
  } catch {
    // A codec the browser can't decode for stills — the editor still works.
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
  return thumbs;
}

/** Downsampled peaks (0..1) of the source audio track, for the waveform lane. */
export async function extractWaveform(file: File, buckets = 1600): Promise<number[]> {
  const AudioCtor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return [];
  const ctx = new AudioCtor();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let peak = 0;
      const start = i * step;
      for (let j = start; j < start + step && j < data.length; j += 8) {
        const v = Math.abs(data[j] ?? 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
    }
    const max = Math.max(...peaks, 0.0001);
    return peaks.map((p) => p / max);
  } catch {
    return [];
  } finally {
    void ctx.close();
  }
}

export function peakAt(peaks: number[], sourceTime: number, sourceDuration: number): number {
  if (peaks.length === 0 || sourceDuration <= 0) return 0;
  const idx = Math.min(
    peaks.length - 1,
    Math.max(0, Math.floor((sourceTime / sourceDuration) * peaks.length)),
  );
  return peaks[idx] ?? 0;
}