import { describe, expect, it } from "vitest";
import { BUILT_IN_REWARD_SOUNDS } from "./builtInRewardSounds";
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

  it("offers two built-in premium options for every reward type", () => {
    for (const key of REWARD_SOUND_KEYS) {
      const sounds = BUILT_IN_REWARD_SOUNDS[key];
      expect(sounds).toHaveLength(2);
      expect(new Set(sounds.map((sound) => sound.path)).size).toBe(2);
      for (const sound of sounds) {
        expect(sound.key).toBe(key);
        expect(sound.title.length).toBeGreaterThan(3);
        expect(sound.description.length).toBeGreaterThan(12);
        expect(sound.path).toMatch(/^\/__l5e\/assets-v1\//);
      }
    }
  });

  it("keeps built-in reward choices through normalisation", () => {
    const chosen = BUILT_IN_REWARD_SOUNDS.vault[0];
    const s = normalizeSoundSettings({
      rewards: { vault: { ref: { source: "builtin", path: chosen.path, title: chosen.title }, volume: 0.65 } },
    });
    expect(s.rewards.vault.ref?.source).toBe("builtin");
    expect(s.rewards.vault.ref?.path).toBe(chosen.path);
    expect(s.rewards.vault.volume).toBe(0.65);
  });
});
