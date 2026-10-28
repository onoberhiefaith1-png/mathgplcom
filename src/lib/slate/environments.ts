import type { EnvironmentId, SceneMaterial, SlotScene } from "./types";

export interface EnvironmentDef {
  id: EnvironmentId;
  label: string;
  material: SceneMaterial;
  className: string;
  atmosphere: string;
}

export const ENVIRONMENTS: EnvironmentDef[] = [
  { id: "forest", label: "Forest", material: "wood", className: "env-forest", atmosphere: "Wind · pollen · sunlight" },
  { id: "ice-cavern", label: "Ice Cavern", material: "ice", className: "env-ice", atmosphere: "Frost · mist · shimmer" },
  { id: "ancient-temple", label: "Ancient Temple", material: "stone", className: "env-temple", atmosphere: "Dust · glyphs · torchlight" },
  { id: "volcanic-cavern", label: "Volcanic Cavern", material: "stone", className: "env-volcano", atmosphere: "Embers · heat · lava" },
  { id: "underwater-ruins", label: "Underwater Ruins", material: "stone", className: "env-water", atmosphere: "Bubbles · caustics · current" },
  { id: "sky-realm", label: "Sky Realm", material: "stone", className: "env-sky", atmosphere: "Clouds · wind · height" },
  { id: "desert-ruins", label: "Desert Ruins", material: "stone", className: "env-desert", atmosphere: "Sand · dust · sunlight" },
  { id: "crystal-cave", label: "Crystal Cave", material: "crystal", className: "env-crystal", atmosphere: "Refraction · pulse · motes" },
  { id: "night-observatory", label: "Night Observatory", material: "metal", className: "env-observatory", atmosphere: "Stars · orbits · instruments" },
  { id: "living-garden", label: "Living Garden", material: "wood", className: "env-garden", atmosphere: "Leaves · flowers · fireflies" },
];

const FALLBACK_ENVIRONMENT: EnvironmentDef = {
  id: "forest",
  label: "Forest",
  material: "wood",
  className: "env-forest",
  atmosphere: "Wind · pollen · sunlight",
};

export const getEnvironment = (id: EnvironmentId): EnvironmentDef =>
  ENVIRONMENTS.find((environment) => environment.id === id) ?? FALLBACK_ENVIRONMENT;

export const defaultScene = (index = 0): SlotScene => {
  const environment = ENVIRONMENTS[index % ENVIRONMENTS.length] ?? FALLBACK_ENVIRONMENT;
  return {
    environmentId: environment.id,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    rotation: 0,
    depth: 1,
    material: environment.material,
    colour: "natural",
    relief: "recessed",
    lighting: 1,
    animation: 1,
    effectIntensity: 1,
  };
};