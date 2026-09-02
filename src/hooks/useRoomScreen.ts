/**
 * SMART SCREEN RUNTIME — one hook per room you are standing in.
 *
 * It owns the room's screen record, the single <video> element that feeds the
 * 3D panel's texture, playback control for viewers, and the live camera link
 * between the teaching host and every student in the same room.
 *
 * Architecture: 3D room -> smart screen -> prerecorded video OR live camera.
 * The video element is created once and reused, so moving around the room can
 * never restart playback, and everything is torn down when you leave.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchRoomScreen,
  removeScreenVideo,
  roomScreenChannel,
  screenVideoUrl,
  setScreenCamera,
  uploadScreenVideo,
  type RoomScreen,
} from "@/lib/building/screen";

export type ScreenMode = "idle" | "video" | "camera";

interface Options {
  buildingId: string | null;
  classroomId: string | null;
  canEdit: boolean;
}

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

const clientId = () => Math.random().toString(36).slice(2, 10);

export interface RoomScreenApi {
  screen: RoomScreen | null;
  mode: ScreenMode;
  /** The element whose frames are painted onto the 3D panel. */
  video: HTMLVideoElement | null;
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  busy: string | null;
  error: string | null;
  /** True while this session is publishing its camera into the room. */
  hosting: boolean;
  canEdit: boolean;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  setMuted: (next: boolean) => void;
  setVolume: (next: number) => void;
  uploadVideo: (file: File) => Promise<void>;
  removeVideo: () => Promise<void>;
  startCamera: () => Promise<void>;
  stopCamera: () => Promise<void>;
}

export const useRoomScreen = ({ buildingId, classroomId, canEdit }: Options): RoomScreenApi => {
  const [screen, setScreen] = useState<RoomScreen | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMutedState] = useState(true);
  const [volume, setVolumeState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hosting, setHosting] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const meRef = useRef<string>(clientId());
  const localRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── The one video element ────────────────────────────────────────────────
  const video = useMemo(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("video");
    el.crossOrigin = "anonymous";
    el.playsInline = true;
    el.muted = true;
    el.loop = false;
    el.preload = "auto";
    return el;
  }, []);

  useEffect(() => {
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
    };
  }, [video]);

  // ── Load + follow the room's screen record ───────────────────────────────
  const reload = useCallback(async () => {
    if (!classroomId) return;
    const row = await fetchRoomScreen(classroomId);
    setScreen(row);
  }, [classroomId]);

  useEffect(() => {
    setScreen(null);
    void reload();
  }, [reload]);

  const cameraLive = !!screen?.camera_active;
  const mode: ScreenMode = cameraLive ? "camera" : screen?.video_path ? "video" : "idle";

  // ── Content -> the video element ─────────────────────────────────────────
  useEffect(() => {
    if (!video) return;
    let live = true;
    if (cameraLive) {
      // A live lesson takes over the panel; the stream arrives separately.
      video.pause();
      video.removeAttribute("src");
      video.srcObject = liveStream;
      if (liveStream) void video.play().catch(() => undefined);
      return;
    }
    video.srcObject = null;
    if (!screen?.video_path) {
      video.pause();
      video.removeAttribute("src");
      setDuration(0);
      setCurrentTime(0);
      return;
    }
    void (async () => {
      const url = await screenVideoUrl(screen.video_path);
      if (!live || !url) return;
      if (video.src !== url) {
        video.src = url;
        video.load();
      }
      // Muted autoplay is always allowed; the viewer unmutes from the controls.
      video.muted = true;
      setMutedState(true);
      await video.play().catch(() => undefined);
    })();
    return () => {
      live = false;
    };
  }, [video, screen?.video_path, cameraLive, liveStream]);

  // ── Live camera link (host publishes, occupants subscribe) ───────────────
  const closePeers = useCallback(() => {
    for (const pc of peersRef.current.values()) pc.close();
    peersRef.current.clear();
  }, []);

  const stopLocal = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
  }, []);

  useEffect(() => {
    if (!classroomId) return;
    const channel = supabase.channel(roomScreenChannel(classroomId), {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;
    const me = meRef.current;

    const send = (event: string, payload: Record<string, unknown>) =>
      channel.send({ type: "broadcast", event, payload: { from: me, ...payload } });

    const peerFor = (peer: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peer);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      pc.onicecandidate = (e) => {
        if (e.candidate) void send("ice", { to: peer, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => setLiveStream(e.streams[0] ?? null);
      peersRef.current.set(peer, pc);
      return pc;
    };

    channel
      // A viewer arrived: if this session is the host, offer it the camera.
      .on("broadcast", { event: "viewer-join" }, async ({ payload }) => {
        const peer = payload?.from as string | undefined;
        if (!peer || !localRef.current) return;
        const pc = peerFor(peer);
        for (const track of localRef.current.getTracks()) {
          if (!pc.getSenders().some((s) => s.track === track)) pc.addTrack(track, localRef.current);
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void send("offer", { to: peer, sdp: offer });
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload?.to !== me || localRef.current) return;
        const peer = payload.from as string;
        const pc = peerFor(peer);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void send("answer", { to: peer, sdp: answer });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload?.to !== me) return;
        const pc = peersRef.current.get(payload.from as string);
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload?.to !== me) return;
        const pc = peersRef.current.get(payload.from as string);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => undefined);
      })
      // The screen record changed: new video, or the camera went on/off.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "building_room_screens", filter: `classroom_id=eq.${classroomId}` },
        () => { void reload(); },
      )
      .subscribe();

    return () => {
      closePeers();
      setLiveStream(null);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [classroomId, reload, closePeers]);

  // A viewer asks the host for the feed whenever a live lesson is on.
  useEffect(() => {
    if (!cameraLive || hosting || !channelRef.current) return;
    const ask = () =>
      channelRef.current?.send({
        type: "broadcast",
        event: "viewer-join",
        payload: { from: meRef.current },
      });
    void ask();
    const t = window.setInterval(() => { if (!liveStream) void ask(); }, 4000);
    return () => window.clearInterval(t);
  }, [cameraLive, hosting, liveStream]);

  // ── Viewer controls ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!video || mode === "camera") return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, [video, mode]);

  const seek = useCallback((seconds: number) => {
    if (!video || mode === "camera") return;
    video.currentTime = Math.max(0, Math.min(seconds, video.duration || seconds));
  }, [video, mode]);

  const skip = useCallback((delta: number) => {
    if (!video || mode === "camera") return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration || Infinity));
  }, [video, mode]);

  const setMuted = useCallback((next: boolean) => {
    if (!video) return;
    video.muted = next;
    if (!next && video.volume === 0) video.volume = 1;
    setMutedState(next);
    void video.play().catch(() => undefined);
  }, [video]);

  const setVolume = useCallback((next: number) => {
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, next));
    setVolumeState(video.volume);
    if (video.volume > 0 && video.muted) {
      video.muted = false;
      setMutedState(false);
    }
  }, [video]);

  // ── Editor actions ───────────────────────────────────────────────────────
  const guard = useCallback(() => {
    if (!canEdit || !buildingId || !classroomId) {
      throw new Error("Only the building's teachers and administrators can manage this screen.");
    }
    return { buildingId, classroomId };
  }, [canEdit, buildingId, classroomId]);

  const run = useCallback(async (label: string, fn: () => Promise<RoomScreen | void>) => {
    setError(null);
    setBusy(label);
    try {
      const row = await fn();
      if (row) setScreen(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }, []);

  const uploadVideo = useCallback(
    (file: File) =>
      run("Uploading video…", async () => {
        const { buildingId: b, classroomId: c } = guard();
        return uploadScreenVideo(b, c, file, screen?.video_path);
      }),
    [run, guard, screen?.video_path],
  );

  const removeVideo = useCallback(
    () =>
      run("Removing video…", async () => {
        const { buildingId: b, classroomId: c } = guard();
        return removeScreenVideo(b, c, screen?.video_path);
      }),
    [run, guard, screen?.video_path],
  );

  const startCamera = useCallback(
    () =>
      run("Starting camera…", async () => {
        const { buildingId: b, classroomId: c } = guard();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        localRef.current = stream;
        setLiveStream(stream);
        setHosting(true);
        const { data } = await supabase.auth.getUser();
        return setScreenCamera(b, c, true, data.user?.id ?? null);
      }),
    [run, guard],
  );

  const stopCamera = useCallback(
    () =>
      run("Stopping camera…", async () => {
        const { buildingId: b, classroomId: c } = guard();
        stopLocal();
        closePeers();
        setHosting(false);
        setLiveStream(null);
        return setScreenCamera(b, c, false, null);
      }),
    [run, guard, stopLocal, closePeers],
  );

  // Leaving the room always ends a live lesson this session was publishing.
  useEffect(() => () => { stopLocal(); closePeers(); }, [stopLocal, closePeers]);

  return {
    screen,
    mode,
    video,
    playing,
    muted,
    volume,
    currentTime,
    duration,
    busy,
    error,
    hosting,
    canEdit,
    togglePlay,
    seek,
    skip,
    setMuted,
    setVolume,
    uploadVideo,
    removeVideo,
    startCamera,
    stopCamera,
  };
};
