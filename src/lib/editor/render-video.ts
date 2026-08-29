import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * FINAL RENDER
 *
 * The source video is never rebuilt clip by clip and its picture is never
 * analysed: the untouched source stream is copied and the one continuous
 * generated audio track is placed underneath it.
 */

const CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

export type RenderMode = "copy" | "encode" | "capture";

export interface RenderedVideo {
  blob: Blob;
  type: string;
  extension: string;
  mode: RenderMode;
  duration: number;
  /** true when captions were burned into the picture */
  burnedSubtitles?: boolean;
}

let engine: FFmpeg | null = null;

async function loadEngine(onProgress: (message: string) => void): Promise<FFmpeg> {
  if (engine) return engine;
  onProgress("Loading the video engine (one time only)…");
  const instance = new FFmpeg();
  await instance.load({
    coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  engine = instance;
  return instance;
}

function extensionOf(name: string, fallback = "mp4"): string {
  const ext = name.split(".").pop();
  return ext && ext.length <= 5 ? ext.toLowerCase() : fallback;
}

/** Muxes source video + generated audio into one downloadable file. */
export async function renderFinalVideo(options: {
  videoFile: File | Blob;
  fileName: string;
  audioBlob: Blob;
  duration: number;
  /** SRT content to burn into the picture — omit for a clean render */
  subtitles?: string;
  /** same captions as cue objects, used by the recording fallback */
  captions?: { start: number; end: number; lines: string[] }[];
  onProgress?: (message: string) => void;
}): Promise<RenderedVideo> {
  const { videoFile, fileName, audioBlob, duration, subtitles } = options;
  const onProgress = options.onProgress ?? (() => {});
  const inputExt = extensionOf(fileName);
  const input = `source.${inputExt}`;

  try {
    const ff = await loadEngine(onProgress);
    onProgress("Preparing the source video…");
    await ff.writeFile(input, await fetchFile(videoFile));
    await ff.writeFile("voice.wav", await fetchFile(audioBlob));
    if (subtitles) await ff.writeFile("subs.srt", new TextEncoder().encode(subtitles));

    const run = async (args: string[]) => {
      const code = await ff.exec(args);
      if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
      const data = await ff.readFile("out.mp4");
      const bytes = data as Uint8Array;
      if (!bytes || bytes.length === 0) throw new Error("empty output");
      return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "video/mp4" });
    };

    try {
      if (subtitles) {
        // Captions are painted into the picture, so the download needs no
        // sidecar file. Burning always re-encodes the video stream.
        onProgress("Burning the subtitles into the picture…");
        const blob = await run([
          "-i", input,
          "-i", "voice.wav",
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-vf", "subtitles=subs.srt",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "23",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "192k",
          "-shortest",
          "out.mp4",
        ]);
        return {
          blob,
          type: "video/mp4",
          extension: "mp4",
          mode: "encode",
          duration,
          burnedSubtitles: true,
        };
      }
      onProgress("Placing the generated audio under the original video…");
      const blob = await run([
        "-i", input,
        "-i", "voice.wav",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "out.mp4",
      ]);
      return { blob, type: "video/mp4", extension: "mp4", mode: "copy", duration };
    } catch {
      // Exotic source container: the picture has to be re-encoded, and we say so.
      onProgress("This source needs re-encoding — rendering the final video…");
      const blob = await run([
        "-i", input,
        "-i", "voice.wav",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "out.mp4",
      ]);
      return { blob, type: "video/mp4", extension: "mp4", mode: "encode", duration };
    } finally {
      await ff.deleteFile(input).catch(() => {});
      await ff.deleteFile("voice.wav").catch(() => {});
      await ff.deleteFile("out.mp4").catch(() => {});
      await ff.deleteFile("subs.srt").catch(() => {});
    }
  } catch {
    onProgress("Falling back to an in-browser recording of the final video…");
    return captureRender(videoFile, audioBlob, duration, onProgress, options.captions);
  }
}

/**
 * Last-resort renderer for browsers where the muxing engine cannot load:
 * plays the untouched video with the generated track and records the result.
 */
async function captureRender(
  videoFile: File | Blob,
  audioBlob: Blob,
  duration: number,
  onProgress: (message: string) => void,
  captions?: { start: number; end: number; lines: string[] }[],
): Promise<RenderedVideo> {
  const videoUrl = URL.createObjectURL(videoFile);
  const audioUrl = URL.createObjectURL(audioBlob);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  const audio = new Audio(audioUrl);

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read the source video"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot render the final video");

    const stream = canvas.captureStream(30);
    const ctxAudio = new AudioContext();
    const destination = ctxAudio.createMediaStreamDestination();
    ctxAudio.createMediaElementSource(audio).connect(destination);
    for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });

    recorder.start();
    await Promise.all([video.play(), audio.play()]);

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (captions && captions.length > 0) {
        const cue = captions.find((c) => video.currentTime >= c.start && video.currentTime <= c.end);
        if (cue) {
          const size = Math.max(18, Math.round(canvas.height * 0.045));
          ctx.font = `600 ${size}px sans-serif`;
          ctx.textAlign = "center";
          ctx.lineWidth = Math.max(2, size * 0.14);
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.fillStyle = "#ffffff";
          cue.lines.forEach((line, index) => {
            const y = canvas.height - size * (cue.lines.length - index) - size * 0.6;
            ctx.strokeText(line, canvas.width / 2, y);
            ctx.fillText(line, canvas.width / 2, y);
          });
        }
      }
      onProgress(`Rendering final video — ${video.currentTime.toFixed(0)}s of ${duration.toFixed(0)}s`);
      raf = requestAnimationFrame(draw);
    };
    draw();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });
    cancelAnimationFrame(raf);
    recorder.stop();
    audio.pause();
    await ctxAudio.close();

    const blob = await finished;
    return {
      blob,
      type: "video/webm",
      extension: "webm",
      mode: "capture",
      duration,
      ...(captions && captions.length > 0 ? { burnedSubtitles: true } : {}),
    };
  } finally {
    URL.revokeObjectURL(videoUrl);
    URL.revokeObjectURL(audioUrl);
  }
}
