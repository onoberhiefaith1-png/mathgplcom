import { Room, RoomEvent, Track } from "livekit-client";

export async function connectClassroomRelay(
  getCredentials: () => Promise<{ url: string; token: string }>,
  audioContainer: HTMLElement,
  signal: AbortSignal,
) {
  const room = new Room();
  const elements = new Map<string, HTMLMediaElement>();
  let closed = false;
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
    return {
      enableSound: () => {
        if (closed) throw new Error("Classroom audio has disconnected");
        return room.startAudio();
      },
      setMicrophone: (enabled: boolean) => {
        if (closed) throw new Error("Classroom audio has disconnected");
        signal.throwIfAborted();
        return room.localParticipant.setMicrophoneEnabled(enabled);
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
