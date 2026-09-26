// Sequential frame reader for the cut-out. For MP4/MOV (H.264 / HEVC) it
// demuxes with mp4box and decodes with WebCodecs, frame after frame. This is
// far faster than seeking the <video> element once per frame, which decodes
// from the previous keyframe every time (very slow on 1440p HEVC).
// @ts-ignore - no bundled types
import MP4Box from "mp4box";

export interface FrameSource {
  fps: number;
  total: number;
  width: number;
  height: number;
  /** Draws the next frame (in order) onto ctx at w x h. Returns false at end. */
  next: (ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) => Promise<boolean>;
  close: () => void;
}

const description = (trak: any) => {
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const s = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
      box.write(s);
      return new Uint8Array(s.buffer, 8);
    }
  }
  return undefined;
};

export async function openDecodedSource(url: string, onStage?: (s: string) => void): Promise<FrameSource | null> {
  const VD = (window as any).VideoDecoder;
  if (typeof VD !== "function") return null;
  onStage?.("Reading video…");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download the video");
  const len = Number(res.headers.get("content-length")) || 0;
  let buf: ArrayBuffer;
  if (res.body && len) {
    const reader = res.body.getReader();
    const out = new Uint8Array(len);
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.set(value, got); got += value.length;
      onStage?.(`Reading video ${Math.round((got / len) * 100)}%`);
    }
    buf = out.buffer;
  } else buf = await res.arrayBuffer();

  const file = MP4Box.createFile();
  const info: any = await new Promise((resolve, reject) => {
    file.onReady = resolve;
    file.onError = reject;
    (buf as any).fileStart = 0;
    file.appendBuffer(buf);
    file.flush();
    setTimeout(() => reject(new Error("not mp4")), 5000);
  }).catch(() => null);
  const track = info?.videoTracks?.[0];
  if (!track) return null;
  const trak = file.getTrackById(track.id);
  const config = {
    codec: track.codec.startsWith("vp08") ? "vp8" : track.codec,
    codedWidth: track.video.width,
    codedHeight: track.video.height,
    description: description(trak),
  };
  const sup = await VD.isConfigSupported(config).catch(() => ({ supported: false }));
  if (!sup.supported) {
    console.warn("[cutout] decoder unsupported", config.codec);
    return null;
  }

  const samples: any[] = [];
  file.onSamples = (_id: number, _u: any, s: any[]) => { samples.push(...s); };
  file.setExtractionOptions(track.id, null, { nbSamples: Infinity });
  file.start();
  file.flush();
  if (!samples.length) return null;

  const queue: any[] = [];
  let err: Error | null = null;
  const decoder = new VD({ output: (f: any) => queue.push(f), error: (e: Error) => { err = e; } });
  decoder.configure(config);
  let fed = 0, flushed = false;
  const feed = () => {
    while (fed < samples.length && decoder.decodeQueueSize < 6 && queue.length < 8) {
      const s = samples[fed++];
      decoder.decode(new (window as any).EncodedVideoChunk({
        type: s.is_sync ? "key" : "delta",
        timestamp: (s.cts * 1e6) / s.timescale,
        duration: (s.duration * 1e6) / s.timescale,
        data: s.data,
      }));
    }
    if (fed >= samples.length && !flushed && decoder.state === "configured") { flushed = true; decoder.flush().catch(() => {}); }
  };
  let emitted = 0;
  const durSec = track.duration / track.timescale || samples.length / 30;
  return {
    fps: Math.round(samples.length / durSec) || 30,
    total: samples.length,
    width: track.video.width,
    height: track.video.height,
    next: async (ctx, w, h) => {
      if (emitted >= samples.length) return false;
      const t0 = performance.now();
      while (!queue.length) {
        if (err) throw err;
        feed();
        await new Promise((r) => setTimeout(r, 2));
        if (performance.now() - t0 > 15000) throw new Error("Video decoding stalled");
      }
      const f = queue.shift();
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(f, 0, 0, w, h);
      f.close();
      emitted++;
      feed();
      return true;
    },
    close: () => { queue.forEach((f) => f.close()); try { decoder.close(); } catch { /* */ } },
  };
}
