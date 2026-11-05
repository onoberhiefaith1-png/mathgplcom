export const speechBitrates = { clear: 40_000, constrained: 16_000 } as const;
export type SpeechQuality = keyof typeof speechBitrates;

export interface AudioNetworkSample {
  packetLoss: number;
  roundTripMs: number;
  availableOutgoingBitrate?: number;
}

// Samples should represent fresh, consecutive intervals. Missing stats do not
// imply a good connection. Recover more slowly than we downgrade.
export function createSpeechQualityController() {
  let quality: SpeechQuality = "clear";
  let poorIntervals = 0;
  let healthyIntervals = 0;

  return (sample: AudioNetworkSample | null): SpeechQuality => {
    if (!sample || !Number.isFinite(sample.packetLoss) || !Number.isFinite(sample.roundTripMs)) {
      poorIntervals = healthyIntervals = 0;
      return quality;
    }

    const bitrate = sample.availableOutgoingBitrate ?? Infinity;
    const poor = sample.packetLoss >= 0.06 || sample.roundTripMs >= 450 || bitrate < 64_000;
    const healthy = sample.packetLoss <= 0.02 && sample.roundTripMs <= 250 && bitrate >= 96_000;
    poorIntervals = poor ? poorIntervals + 1 : 0;
    healthyIntervals = healthy ? healthyIntervals + 1 : 0;

    if (poorIntervals >= 2) quality = "constrained";
    if (healthyIntervals >= 5) quality = "clear";
    return quality;
  };
}
