/**
 * Interior surface art for the ten-building collection (one wall, floor and
 * ceiling per building). Generated once at authoring time, made seamless by
 * scripts/building-collection/make_seamless_surfaces.py and bundled here; the
 * app never generates images at runtime. Resolved like every other sample via
 * `builtin:<key>`, so teachers can re-use or replace them in Building Settings.
 */
import type { SurfaceSample } from "./gallery";
import nileSunPalaceWall from "@/assets/surfaces/collection/nile-sun-palace-wall.webp";
import nileSunPalaceFloor from "@/assets/surfaces/collection/nile-sun-palace-floor.webp";
import nileSunPalaceCeiling from "@/assets/surfaces/collection/nile-sun-palace-ceiling.webp";
import aegeanAcademyWall from "@/assets/surfaces/collection/aegean-academy-wall.webp";
import aegeanAcademyFloor from "@/assets/surfaces/collection/aegean-academy-floor.webp";
import aegeanAcademyCeiling from "@/assets/surfaces/collection/aegean-academy-ceiling.webp";
import andalusianCourtyardWall from "@/assets/surfaces/collection/andalusian-courtyard-wall.webp";
import andalusianCourtyardFloor from "@/assets/surfaces/collection/andalusian-courtyard-floor.webp";
import andalusianCourtyardCeiling from "@/assets/surfaces/collection/andalusian-courtyard-ceiling.webp";
import meridianDomePalaceWall from "@/assets/surfaces/collection/meridian-dome-palace-wall.webp";
import meridianDomePalaceFloor from "@/assets/surfaces/collection/meridian-dome-palace-floor.webp";
import meridianDomePalaceCeiling from "@/assets/surfaces/collection/meridian-dome-palace-ceiling.webp";
import heritageClockHallWall from "@/assets/surfaces/collection/heritage-clock-hall-wall.webp";
import heritageClockHallFloor from "@/assets/surfaces/collection/heritage-clock-hall-floor.webp";
import heritageClockHallCeiling from "@/assets/surfaces/collection/heritage-clock-hall-ceiling.webp";
import glassGardenCampusWall from "@/assets/surfaces/collection/glass-garden-campus-wall.webp";
import glassGardenCampusFloor from "@/assets/surfaces/collection/glass-garden-campus-floor.webp";
import glassGardenCampusCeiling from "@/assets/surfaces/collection/glass-garden-campus-ceiling.webp";
import horizonSailsInstituteWall from "@/assets/surfaces/collection/horizon-sails-institute-wall.webp";
import horizonSailsInstituteFloor from "@/assets/surfaces/collection/horizon-sails-institute-floor.webp";
import horizonSailsInstituteCeiling from "@/assets/surfaces/collection/horizon-sails-institute-ceiling.webp";
import auroraSkyAcademyWall from "@/assets/surfaces/collection/aurora-sky-academy-wall.webp";
import auroraSkyAcademyFloor from "@/assets/surfaces/collection/aurora-sky-academy-floor.webp";
import auroraSkyAcademyCeiling from "@/assets/surfaces/collection/aurora-sky-academy-ceiling.webp";
import verdantArcologyWall from "@/assets/surfaces/collection/verdant-arcology-wall.webp";
import verdantArcologyFloor from "@/assets/surfaces/collection/verdant-arcology-floor.webp";
import verdantArcologyCeiling from "@/assets/surfaces/collection/verdant-arcology-ceiling.webp";
import celestialObservatoryWall from "@/assets/surfaces/collection/celestial-observatory-wall.webp";
import celestialObservatoryFloor from "@/assets/surfaces/collection/celestial-observatory-floor.webp";
import celestialObservatoryCeiling from "@/assets/surfaces/collection/celestial-observatory-ceiling.webp";

export const COLLECTION_SURFACE_SAMPLES: SurfaceSample[] = [
  { key: "nile-sun-palace-wall", label: "Nile Sun Palace Wall", style: "Collection", url: nileSunPalaceWall },
  { key: "nile-sun-palace-floor", label: "Nile Sun Palace Floor", style: "Collection", url: nileSunPalaceFloor },
  { key: "nile-sun-palace-ceiling", label: "Nile Sun Palace Ceiling", style: "Collection", url: nileSunPalaceCeiling },
  { key: "aegean-academy-wall", label: "Aegean Academy Wall", style: "Collection", url: aegeanAcademyWall },
  { key: "aegean-academy-floor", label: "Aegean Academy Floor", style: "Collection", url: aegeanAcademyFloor },
  { key: "aegean-academy-ceiling", label: "Aegean Academy Ceiling", style: "Collection", url: aegeanAcademyCeiling },
  { key: "andalusian-courtyard-wall", label: "Andalusian Courtyard Wall", style: "Collection", url: andalusianCourtyardWall },
  { key: "andalusian-courtyard-floor", label: "Andalusian Courtyard Floor", style: "Collection", url: andalusianCourtyardFloor },
  { key: "andalusian-courtyard-ceiling", label: "Andalusian Courtyard Ceiling", style: "Collection", url: andalusianCourtyardCeiling },
  { key: "meridian-dome-palace-wall", label: "Meridian Dome Palace Wall", style: "Collection", url: meridianDomePalaceWall },
  { key: "meridian-dome-palace-floor", label: "Meridian Dome Palace Floor", style: "Collection", url: meridianDomePalaceFloor },
  { key: "meridian-dome-palace-ceiling", label: "Meridian Dome Palace Ceiling", style: "Collection", url: meridianDomePalaceCeiling },
  { key: "heritage-clock-hall-wall", label: "Heritage Clock Hall Wall", style: "Collection", url: heritageClockHallWall },
  { key: "heritage-clock-hall-floor", label: "Heritage Clock Hall Floor", style: "Collection", url: heritageClockHallFloor },
  { key: "heritage-clock-hall-ceiling", label: "Heritage Clock Hall Ceiling", style: "Collection", url: heritageClockHallCeiling },
  { key: "glass-garden-campus-wall", label: "Glass Garden Campus Wall", style: "Collection", url: glassGardenCampusWall },
  { key: "glass-garden-campus-floor", label: "Glass Garden Campus Floor", style: "Collection", url: glassGardenCampusFloor },
  { key: "glass-garden-campus-ceiling", label: "Glass Garden Campus Ceiling", style: "Collection", url: glassGardenCampusCeiling },
  { key: "horizon-sails-institute-wall", label: "Horizon Sails Institute Wall", style: "Collection", url: horizonSailsInstituteWall },
  { key: "horizon-sails-institute-floor", label: "Horizon Sails Institute Floor", style: "Collection", url: horizonSailsInstituteFloor },
  { key: "horizon-sails-institute-ceiling", label: "Horizon Sails Institute Ceiling", style: "Collection", url: horizonSailsInstituteCeiling },
  { key: "aurora-sky-academy-wall", label: "Aurora Sky Academy Wall", style: "Collection", url: auroraSkyAcademyWall },
  { key: "aurora-sky-academy-floor", label: "Aurora Sky Academy Floor", style: "Collection", url: auroraSkyAcademyFloor },
  { key: "aurora-sky-academy-ceiling", label: "Aurora Sky Academy Ceiling", style: "Collection", url: auroraSkyAcademyCeiling },
  { key: "verdant-arcology-wall", label: "Verdant Arcology Wall", style: "Collection", url: verdantArcologyWall },
  { key: "verdant-arcology-floor", label: "Verdant Arcology Floor", style: "Collection", url: verdantArcologyFloor },
  { key: "verdant-arcology-ceiling", label: "Verdant Arcology Ceiling", style: "Collection", url: verdantArcologyCeiling },
  { key: "celestial-observatory-wall", label: "Celestial Observatory Wall", style: "Collection", url: celestialObservatoryWall },
  { key: "celestial-observatory-floor", label: "Celestial Observatory Floor", style: "Collection", url: celestialObservatoryFloor },
  { key: "celestial-observatory-ceiling", label: "Celestial Observatory Ceiling", style: "Collection", url: celestialObservatoryCeiling },
];
