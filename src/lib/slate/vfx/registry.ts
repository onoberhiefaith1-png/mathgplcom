// The internal VFX library. Effects are registered here by category so a
// visual can be swapped or retuned without touching any gameplay code.

export type VfxCategory = "explosion" | "fire" | "energy" | "lightning" | "collection" | "reveal";

export interface VfxEntry {
  id: string;
  category: VfxCategory;
  label: string;
  /** Approximate lifetime in seconds at speed 1. */
  life: number;
  /** Upper bound on simultaneous particles, so nothing spawns freely. */
  maxParticles: number;
}

export const VFX_LIBRARY: VfxEntry[] = [
  // explosion
  { id: "bomb-explosion", category: "explosion", label: "Bomb Explosion", life: 4.8, maxParticles: 400 },
  { id: "premium-chain-explosion", category: "explosion", label: "Premium Chain Explosion", life: 7.8, maxParticles: 220 },
  { id: "premium-directed-projectiles", category: "energy", label: "Directed Reward Projectiles", life: 3.8, maxParticles: 160 },
  { id: "small-impact", category: "explosion", label: "Small Impact", life: 0.6, maxParticles: 40 },
  { id: "large-impact", category: "explosion", label: "Large Impact", life: 1.2, maxParticles: 120 },
  { id: "shockwave", category: "explosion", label: "Shockwave", life: 1.2, maxParticles: 0 },
  { id: "smoke", category: "explosion", label: "Smoke", life: 2.3, maxParticles: 70 },
  { id: "debris", category: "explosion", label: "Debris", life: 2.1, maxParticles: 14 },
  // fire
  { id: "flame", category: "fire", label: "Flame", life: Infinity, maxParticles: 80 },
  { id: "fire-burst", category: "fire", label: "Fire Burst", life: 0.95, maxParticles: 60 },
  { id: "fire-trail", category: "fire", label: "Fire Trail", life: 1.4, maxParticles: 90 },
  { id: "embers", category: "fire", label: "Embers", life: 2, maxParticles: 60 },
  // energy
  { id: "orbital-energy", category: "energy", label: "Orbital Energy", life: 1.9, maxParticles: 84 },
  { id: "glow-burst", category: "energy", label: "Glow Burst", life: 1.2, maxParticles: 44 },
  { id: "energy-ring", category: "energy", label: "Energy Ring", life: 1, maxParticles: 0 },
  { id: "energy-trail", category: "energy", label: "Energy Trail", life: 1.6, maxParticles: 90 },
  // lightning
  { id: "lightning-horizontal", category: "lightning", label: "Lightning Horizontal", life: 1.6, maxParticles: 0 },
  { id: "lightning-vertical", category: "lightning", label: "Lightning Vertical", life: 1.6, maxParticles: 0 },
  { id: "lightning-branching", category: "lightning", label: "Branching Bolt", life: 1.2, maxParticles: 0 },
  { id: "lightning-impact", category: "lightning", label: "Lightning Impact", life: 0.5, maxParticles: 30 },
  { id: "lightning-sparks", category: "lightning", label: "Lightning Sparks", life: 0.6, maxParticles: 36 },
  // collection
  { id: "reward-absorption", category: "collection", label: "Reward Absorption", life: 0.9, maxParticles: 60 },
  { id: "life-collection", category: "collection", label: "Life Collection", life: 1.2, maxParticles: 44 },
  { id: "timer-collection", category: "collection", label: "Timer Collection", life: 1.2, maxParticles: 44 },
  // reveal
  { id: "seal-opening", category: "reveal", label: "Seal Opening", life: 0.55, maxParticles: 60 },
  { id: "energy-release", category: "reveal", label: "Energy Release", life: 1.2, maxParticles: 60 },
  { id: "hidden-text-reveal", category: "reveal", label: "Hidden Text Reveal", life: 2.2, maxParticles: 60 },
  { id: "reward-completion", category: "reveal", label: "Reward Completion", life: 0.8, maxParticles: 30 },
];

export const vfxEntry = (id: string) => VFX_LIBRARY.find((entry) => entry.id === id) ?? null;

export const vfxByCategory = (category: VfxCategory) =>
  VFX_LIBRARY.filter((entry) => entry.category === category);
