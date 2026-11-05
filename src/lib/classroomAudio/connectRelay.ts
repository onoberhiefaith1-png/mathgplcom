import { Room, RoomEvent, Track } from "livekit-client";
import { speechBitrates, createSpeechQualityController, type SpeechQuality } from "@/lib/classroomAudio/quality";
import { intervalLoss, readTransportCounters, type TransportCounters } from "@/lib/classroomAudio/diagnosis";

export type RelayState = {
  microphoneEnabled: boolean;
  canPublish: boolean;
  connected: boolean;
  connectionState: string;
  moderator: boolean;
  quality: SpeechQuality;
  participants: Array<{ id: string; name: string }>;
};

export async function connectClassroomRelay(
  getCredentials: () => Promise<{ url: string; token: string }>,
  audioContainer: HTMLElement,
  signal: AbortSignal,
  onState?: (state: RelayState) => void,
) {
  const room = new Room();
  const elements = new Map<string, HTMLMediaElement>();
  const ownedTracks = new Set<MediaStreamTrack>();
  let closed = false;
  let quality: SpeechQuality = "clear";
  let previousCounters: TransportCounters | null = null;
  const decideQuality = createSpeechQualityController();

  const publishState = () => {
    if (closed) return;
    const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    onState?.({
      microphoneEnabled: room.localParticipant.isMicrophoneEnabled || Boolean(publication && !publication.isMuted),
      canPublish: room.localParticipant.permissions?.canPublish === true,
      connected: room.state === "connected",
      connectionState: room.state,
      moderator: room.localParticipant.attributes.mathgpl_audio_role === "moderator",
      quality,
      participants: Array.from(room.remoteParticipants.values()).map((person) => ({
        id: person.identity,
        name: person.name || "Class participant",
      })),
    });
  };

  room.on(RoomEvent.ParticipantConnected, publishState);
  room.on(RoomEvent.ParticipantDisconnected, publishState);
  room.on(RoomEvent.ParticipantPermissionsChanged, publishState);
  room.on(RoomEvent.ParticipantAttributesChanged, publishState);
  room.on(RoomEvent.LocalTrackPublished, publishState);
  room.on(RoomEvent.LocalTrackUnpublished, publishState);
  room.on(RoomEvent.TrackMuted, publishState);
  room.on(RoomEvent.TrackUnmuted, publishState);
  room.on(RoomEvent.ConnectionStateChanged, publishState);

  room.on(RoomEvent.TrackSubscribed, (track, publication) => {
    if (closed || signal.aborted || track.kind !== Track.Kind.Audio) return;
    elements.get(publication.trackSid)?.remove();
    const element = track.attach();
    element.autoplay = true;
    element.setAttribute("playsinline", "");
    elements.set(publication.trackSid, element);
    audioContainer.append(element);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
    for (const element of track.detach()) element.remove();
    elements.delete(publication.trackSid);
  });

  async function applyQuality(next: SpeechQuality) {
    if (next === quality) return;
    quality = next;
    const sender = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.sender;
    const params = sender?.getParameters();
    if (!sender || !params?.encodings?.length) {
      publishState();
      return;
    }
    params.encodings[0]!.maxBitrate = speechBitrates[next];
    try {
      await sender.setParameters(params);
    } catch {
      // The next sample tries again. A failed bitrate change does not drop the room.
    }
    publishState();
  }

  const qualityTimer = setInterval(() => {
    if (closed || room.state !== "connected") return;
    const sender = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.sender;
    const read = sender?.getStats?.() ?? Promise.resolve(null);
    void read.then((report) => {
      if (closed || !report) return null;
      const counters = readTransportCounters(report as RTCStatsReport);
      if (!counters) return null;
      const sample = intervalLoss(previousCounters, counters);
      previousCounters = counters;
      return applyQuality(decideQuality(sample));
    }).catch(() => undefined);
  }, 2_000);

  function stopOwnedTracks() {
    for (const track of ownedTracks) track.stop();
    ownedTracks.clear();
  }

  function close() {
    if (closed) return;
    closed = true;
    clearInterval(qualityTimer);
    signal.removeEventListener("abort", close);
    room.removeAllListeners();
    for (const element of elements.values()) element.remove();
    elements.clear();
    stopOwnedTracks();
    void room.disconnect();
  }

  try {
    const { url, token } = await getCredentials();
    signal.throwIfAborted();
    signal.addEventListener("abort", close, { once: true });
    await room.connect(url, token);
    signal.throwIfAborted();
    publishState();
    return {
      enableSound: () => {
        if (closed) throw new Error("Classroom audio has disconnected");
        return room.startAudio();
      },
      waitUntilCanPublish: () => new Promise<void>((resolve, reject) => {
        if (closed) {
          reject(new Error("Classroom audio has disconnected"));
          return;
        }
        if (room.localParticipant.permissions?.canPublish === true) {
          resolve();
          return;
        }
        const timer = setTimeout(() => {
          room.off(RoomEvent.ParticipantPermissionsChanged, onChange);
          reject(new Error("Audio not connected"));
        }, 4_000);
        const onChange = () => {
          if (room.localParticipant.permissions?.canPublish !== true) return;
          clearTimeout(timer);
          room.off(RoomEvent.ParticipantPermissionsChanged, onChange);
          resolve();
        };
        room.on(RoomEvent.ParticipantPermissionsChanged, onChange);
      }),
      publishMicrophone: async (stream: MediaStream) => {
        if (closed) throw new Error("Classroom audio has disconnected");
        signal.throwIfAborted();
        const [track] = stream.getAudioTracks();
        if (!track) throw new Error("No microphone track");
        ownedTracks.add(track);
        await room.localParticipant.publishTrack(track, {
          source: Track.Source.Microphone,
          dtx: true,
          red: true,
          audioPreset: { maxBitrate: speechBitrates[quality] },
        });
        publishState();
      },
      stopMicrophone: async () => {
        if (closed) return;
        await room.localParticipant.setMicrophoneEnabled(false);
        stopOwnedTracks();
        publishState();
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
