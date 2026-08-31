// Solid-colour background removal for video assets.
//
// The video is decoded at its own resolution and frame rate, each frame is
// chroma-keyed in a WebGL shader (chroma-distance keying with a soft edge band
// plus spill suppression), and the result is re-encoded as VP9-with-alpha WebM
// at a high bitrate so the subject keeps its original detail. Audio is kept.
//
// Only flat backgrounds are cut. When detection says the background is busy the
// caller gets a NotKeyableError and should store the original video untouched.

import { detectMediaBackground, isLowSaturation, type KeyColor } from "./removeBackground";

export type EdgeSoftness = "tight" | "normal" | "soft";

export class NotKeyableError extends Error {
  constructor() {
    super("This video's background is not a flat colour, so it cannot be cut safely.");
    this.name = "NotKeyableError";
  }
}

export interface CutOptions {
  softness?: EdgeSoftness;
  signal?: AbortSignal;
  /** 0..1 */
  onProgress?: (fraction: number) => void;
  /** Skip detection and use this colour instead. */
  keyColor?: KeyColor;
}

/** Soft-edge band (in normalised chroma distance) per softness setting. */
const BANDS: Record<EdgeSoftness, [number, number]> = {
  tight: [0.06, 0.13],
  normal: [0.08, 0.2],
  soft: [0.1, 0.3],
};

/**
 * White, grey and black keys carry almost no chroma, so the band has to be a
 * little wider for the luma fallback to catch the whole backdrop.
 */
const bandFor = (softness: EdgeSoftness, key: KeyColor): [number, number] => {
  const [a, b] = BANDS[softness];
  return isLowSaturation(key) ? [a * 1.35, b * 1.35] : [a, b];
};

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2((aPos.x + 1.0) * 0.5, 1.0 - (aPos.y + 1.0) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec3 uKey;
uniform float uEdge0;
uniform float uEdge1;

vec2 chroma(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  return vec2(c.b - y, c.r - y);
}

void main() {
  vec4 src = texture2D(uTex, vUv);
  vec2 kc = chroma(uKey);
  vec2 pc = chroma(src.rgb);
  float d = distance(pc, kc);

  // Luma-only keys (black / white / grey backgrounds) have no chroma signal,
  // so fall back to luma distance for those.
  float keyChromaMag = length(kc);
  if (keyChromaMag < 0.02) {
    float ky = dot(uKey, vec3(0.299, 0.587, 0.114));
    float py = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    d = abs(py - ky) * 0.5 + length(pc) * 0.5;
  }

  float alpha = smoothstep(uEdge0, uEdge1, d);

  // Spill suppression: pull the key hue out of semi-transparent edge pixels.
  vec3 rgb = src.rgb;
  if (alpha > 0.0 && alpha < 1.0 && keyChromaMag >= 0.02) {
    vec3 kn = normalize(uKey + 0.0001);
    float spill = max(dot(rgb, kn) - dot(rgb, vec3(0.333)), 0.0) * (1.0 - alpha);
    rgb = clamp(rgb - kn * spill * 0.6, 0.0, 1.0);
  }

  gl_FragColor = vec4(rgb, alpha);
}`;

const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
  }
  return sh;
};

const pickMime = (): string => {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp09.00.10.08",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  throw new Error("This browser cannot record transparent video.");
};

const loadVideo = (url: string): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.onerror = () => reject(new Error("Could not read this video."));
    v.onloadedmetadata = () => resolve(v);
    v.src = url;
  });

const baseName = (name: string) =>
  name.replace(/\.[a-z0-9]+$/i, "") || "video";

/**
 * Cuts a flat-colour background out of a video and returns a transparent WebM
 * with the same dimensions and frame rate as the source.
 */
export const cutVideoBackground = async (
  file: File,
  { softness = "normal", signal, onProgress, keyColor }: CutOptions = {},
): Promise<File> => {
  const url = URL.createObjectURL(file);
  try {
    const detection = keyColor
      ? { color: keyColor, keyable: true }
      : await detectMediaBackground(url, "video");
    if (!detection.keyable) throw new NotKeyableError();

    const video = await loadVideo(url);
    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = video.duration;
    if (!width || !height || !isFinite(duration) || duration <= 0) {
      throw new Error("Could not read this video's dimensions.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: false,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("This browser cannot process video transparency.");

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "program link failed");
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

    const [edge0, edge1] = bandFor(softness, detection.color);
    gl.uniform3f(
      gl.getUniformLocation(program, "uKey"),
      detection.color.r / 255,
      detection.color.g / 255,
      detection.color.b / 255,
    );
    gl.uniform1f(gl.getUniformLocation(program, "uEdge0"), edge0);
    gl.uniform1f(gl.getUniformLocation(program, "uEdge1"), edge1);
    gl.uniform1i(gl.getUniformLocation(program, "uTex"), 0);
    gl.viewport(0, 0, width, height);

    const fps = 30;
    const stream = canvas.captureStream(fps);

    // Keep the soundtrack: route the source video's audio into the recording.
    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtor: typeof AudioContext | undefined =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (AudioCtor) {
        audioCtx = new AudioCtor();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
      }
    } catch {
      audioCtx = null; // silent clip is acceptable; the cut matters more
    }

    const bitrate = Math.max(6_000_000, Math.round(width * height * fps * 0.15));
    const recorder = new MediaRecorder(stream, {
      mimeType: pickMime(),
      videoBitsPerSecond: bitrate,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
      recorder.onerror = () => reject(new Error("Recording the transparent video failed."));
    });

    let raf = 0;
    let stopped = false;
    const stopAll = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      void audioCtx?.close().catch(() => {});
    };

    const onAbort = () => stopAll();
    signal?.addEventListener("abort", onAbort);

    const drawLoop = () => {
      if (stopped) return;
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } catch {
        // a frame that isn't ready yet — try again next tick
      }
      onProgress?.(Math.min(1, video.currentTime / duration));
      raf = requestAnimationFrame(drawLoop);
    };

    video.onended = () => stopAll();
    video.currentTime = 0;
    recorder.start(1000);
    await video.play();
    drawLoop();

    const blob = await done;
    signal?.removeEventListener("abort", onAbort);

    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!blob.size) throw new Error("The transparent video came out empty.");
    onProgress?.(1);

    return new File([blob], `${baseName(file.name)}-transparent.webm`, { type: "video/webm" });
  } finally {
    URL.revokeObjectURL(url);
  }
};
