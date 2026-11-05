// The capture promise must be started inside the click, before any await.
// Browsers will not show the permission prompt again after a block.

export function captureMicrophone(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream> = defaultGetUserMedia,
): Promise<MediaStream> {
  return getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

function defaultGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!devices?.getUserMedia) {
    const error = new Error("This browser has no microphone API");
    error.name = "NotSupportedError";
    return Promise.reject(error);
  }
  return devices.getUserMedia(constraints);
}

export function stopMicrophoneStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
