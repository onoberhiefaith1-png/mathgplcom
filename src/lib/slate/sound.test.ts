import { describe, expect, it } from "vitest";
import {
  REWARD_SOUND_KEYS,
  defaultSoundSettings,
  normalizeSoundSettings,
  rewardSoundKeyForType,
  soundName,
} from "./sound";

describe("game sound settings", () => {
  it("starts silent, with the background layer available", () => {
    const s = defaultSoundSettings();
    expect(s.background.ref).toBeNull();
    expect(s.background.enabled).toBe(true);
    for (const key of REWARD_SOUND_KEYS) expect(s.rewards[key].ref).toBeNull();
  });

  it("keeps every reward volume independent", () => {
    const s = normalizeSoundSettings({
      rewards: { vault: { volume: 0.8 }, bomb: { volume: 1 }, life: { volume: 0.6 } },
      background: { volume: 0.4 },
    });
    expect(s.rewards.vault.volume).toBe(0.8);
    expect(s.rewards.bomb.volume).toBe(1);
    expect(s.rewards.life.volume).toBe(0.6);
    expect(s.background.volume).toBe(0.4);
  });

  it("clamps impossible volumes and keeps a chosen sound", () => {
    const s = normalizeSoundSettings({
      background: { ref: { source: "official", path: "a/b.mp3", title: "Drift" }, volume: 9 },
      rewards: { vault: { volume: -3 } },
    });
    expect(s.background.volume).toBe(1);
    expect(s.rewards.vault.volume).toBe(0);
    expect(soundName(s.background)).toBe("Drift");
  });

  it("maps each placed reward to its own sound gallery", () => {
    expect(rewardSoundKeyForType("math-vault")).toBe("vault");
    expect(rewardSoundKeyForType("math-core")).toBe("bomb");
    expect(rewardSoundKeyForType("premium-chain-bomb")).toBe("bomb");
    expect(rewardSoundKeyForType("retry-heart")).toBe("life");
    expect(rewardSoundKeyForType("time-shard")).toBe("hourglass");
    expect(rewardSoundKeyForType("horizontal-collector")).toBe("collector");
    expect(rewardSoundKeyForType("vertical-collector")).toBe("collector");
    expect(rewardSoundKeyForType("mark-seal")).toBe("completion");
    expect(rewardSoundKeyForType("something-else")).toBeNull();
  });
});
