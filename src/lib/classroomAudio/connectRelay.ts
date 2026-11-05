import { Room, RoomEvent, Track } from "livekit-client";

export async function connectClassroomRelay(
  getCredentials: () => Promise<{ url: string; token: string }>,
  audioContainer: HTMLElement,
  signal: AbortSignal,
  onState?: (state: {
    microphoneEnabled: boolean;
    canPublish: boolean;
    connected: boolean;
    participants: Array<{ id: string; name: string }>;
  }) => void,
) {
  const room = new Room();
  const elements = new Map<string, HTMLMediaElement>();
  let closed = false;
  const publishState = () => {
    if (closed) return;
    onState?.({
      microphoneEnabled: room.localParticipant.isMicrophoneEnabled,
      canPublish: room.localParticipant.permissions?.canPublish === true,
      connected: room.state === "connected",
      participants: Array.from(room.remoteParticipants.values()).map((person) => ({
        id: person.identity,
        name: person.name || "Class participant",
      })),
    });
  };
  room.on(RoomEvent.ParticipantConnected, publishState);
  room.on(RoomEvent.ParticipantDisconnected, publishState);
  room.on(RoomEvent.ParticipantPermissionsChanged, publishState);
  room.on(RoomEvent.LocalTrackPublished, publishState);
  room.on(RoomEvent.LocalTrackUnpublished, publishState);
  room.on(RoomEvent.TrackMuted, publishState);
  room.on(RoomEvent.TrackUnmuted, publishState);
  room.on(RoomEvent.ConnectionStateChanged, publishState);
  function close() {
    if (closed) return;
    closed = true;
    signal.removeEventListener("abort", close);
    room.removeAllListeners();
    for (const element of elements.values()) element.remove();
    elements.clear();
    void room.disconnect();
  }

  room.on(RoomEvent.TrackSubscribed, (track, publication) => {
    if (closed || signal.aborted || track.kind !== Track.Kind.Audio) return;
    elements.get(publication.trackSid)?.remove();
    const element = track.attach();
    elements.set(publication.trackSid, element);
    audioContainer.append(element);
  });
  room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
    for (const element of track.detach()) element.remove();
    elements.delete(publication.trackSid);
  });

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
      setMicrophone: (enabled: boolean) => {
        if (closed) throw new Error("Classroom audio has disconnected");
        signal.throwIfAborted();
        return room.localParticipant.setMicrophoneEnabled(enabled, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }, { audioPreset: { maxBitrate: 40_000 }, dtx: true, red: true });
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
