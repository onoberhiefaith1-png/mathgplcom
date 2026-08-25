import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useNavigate } from "@/lib/router-compat";
import { DEFAULT_BACKGROUND } from "@/lib/homepage/defaults";
import SignedMedia from "@/components/gamebuilder/SignedMedia";
import { CORE_SLOTS, RING_SLOTS, defaultUrlFor } from "@/lib/homepage/buildingSlots";
import {
  clampBuildingSpeed,
  useHomepageConfig,
  useResolvedSlotUrls,
  type HomepageConfigMode,
} from "@/lib/homepage/homepageConfig";

import { adForOuterPosition, useAdImageUrls, useFacingAdRotation, usePlayableAds } from "@/lib/homepage/advertisements";
import BuildingBillboard from "@/components/adventure/BuildingBillboard";
import { useSceneCursor } from "@/lib/stability/useSceneCursor";
import { useWebglRecovery } from "@/lib/stability/useWebglRecovery";
import { setScopedCursor } from "@/lib/stability/interactionReset";

// ONE continuous floating mathematical world: eight curved segments tiled
// edge-to-edge around a single cylinder so the academies read as one connected
// civilization in the sky — never as separate floating islands.
//
// Subjects are the primary destinations; MathGPL hubs fill the remaining
// positions and act as transition/branding hubs between subjects.
//   Algebra → MathGPL → Geometry → MathGPL → Trigonometry → MathGPL → Statistics → Calculus
const academies = RING_SLOTS.map((slot) => ({
  slug: slot.id,
  image: slot.defaultUrl,
  route: slot.route ?? "/teaching-hub",
}));

const SEGMENTS = academies.length; // 8
const SEG_ANGLE = (Math.PI * 2) / SEGMENTS; // 45° per curved slice
const WORLD_RADIUS = 5.1; // radius of the connected cylinder world
const WORLD_HEIGHT = 4.4; // shared height so every slice connects top & bottom
const ringSpeed = (Math.PI * 2) / 60; // one full revolution ~60s — slow, cinematic

// ── INNER CENTRAL CORE ────────────────────────────────────────────────────
// One royal academy palace built from FOUR identical dome copies (N/S/E/W),
// each wrapped onto a 90° curved slice of a smaller inner cylinder. The slices
// overlap so their walls/roofs merge into a single continuous cylindrical core
// that sits INSIDE the outer ring city and rotates locked to it.
const CORE_SEGMENTS = 12; // many overlapping dome copies → roof closes into one ring
const CORE_SEG_ANGLE = (Math.PI * 2) / CORE_SEGMENTS; // 30° base step per dome copy
const CORE_RADIUS = 2.55; // well inside the outer ring (5.1) → hidden behind towers
const CORE_HEIGHT = 5.4; // taller than the city so the roof dominates the skyline
const CORE_Y_OFFSET = 0.95; // lift so the roof crowns above the outer towers, base hidden

// Each academy is a curved slice of the giant cylinder (a convex panel that
// bends backward at both edges and projects forward at its centre). Segments
// share radius + height, so they butt seamlessly with no sky gaps between them.
const WorldSegment = ({
  texture,
  index,
  interactive,
  onActivate,
  onHoverChange,
}: {
  texture?: THREE.Texture;
  index: number;
  interactive: boolean;
  onActivate: (index: number) => void;
  onHoverChange: (hovered: boolean) => void;
}) => {
  // EDGE MERGING: widen each slice well past its 45° share so its outer towers
  // push deep into the neighbour's territory. Neighbouring towers then occupy
  // the same arc and interlock like jigsaw pieces instead of meeting edge-to-edge.
  const overlap = SEG_ANGLE * 0.5; // each edge reaches a quarter-segment into its neighbour
  const thetaStart = index * SEG_ANGLE - overlap / 2;
  const thetaLength = SEG_ANGLE + overlap;

  // Alternate segments sit on a marginally larger radius so they consistently
  // cover (rather than z-fight with) the edge towers of their neighbours — one
  // tower partially hides the other, reading as a single continuous structure.
  const radius = WORLD_RADIUS + (index % 2 === 0 ? 0.14 : 0);

  // Cursor is scoped to the canvas and always cleared on unmount / context
  // loss, so a hover can never leave the whole page on a hand cursor.
  const setCursor = useSceneCursor();

  // No texture yet (first load / re-sign in flight) → draw nothing for this
  // slice rather than a white panel. Siblings keep rendering.
  if (!texture) return null;

  return (
    <mesh
      renderOrder={index % 2 === 0 ? 1 : 0}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!interactive) return;
        e.stopPropagation();
        onHoverChange(true);
        setCursor("pointer");
      }}
      onPointerOut={() => {
        if (!interactive) return;
        onHoverChange(false);
        setCursor("default");
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!interactive) return;
        e.stopPropagation();
        onActivate(index);
      }}
    >
      <cylinderGeometry
        args={[radius, radius, WORLD_HEIGHT, 48, 1, true, thetaStart, thetaLength]}
      />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

// The inner royal palace: four identical dome copies wrapped onto overlapping
// 90° slices of one smaller cylinder. Overlap merges their walls + roofs so the
// viewer reads a single continuous cylindrical core, not four buildings.
const CoreSegment = ({ texture, index }: { texture?: THREE.Texture; index: number }) => {
  // Heavy overlap so each copy's edges wrap deep into both neighbours. With many
  // copies tiled around the full circle, their roofs and walls fuse into one
  // continuous, gapless cylindrical core — a single seamless spherical dome.
  const overlap = CORE_SEG_ANGLE * 3; // each copy spans 30° + 90° = 120°
  const thetaStart = index * CORE_SEG_ANGLE - overlap / 2;
  const thetaLength = CORE_SEG_ANGLE + overlap;
  // Alternate radius so neighbouring copies cover (not z-fight) each other.
  const radius = CORE_RADIUS + (index % 2 === 0 ? 0.06 : 0);

  // Never paint an untextured panel — an unmapped material renders solid white,
  // which read as a big white box in the middle of the sky while art decoded.
  if (!texture) return null;

  return (
    <mesh renderOrder={index % 2 === 0 ? -1 : -2}>
      <cylinderGeometry args={[radius, radius, CORE_HEIGHT, 64, 1, true, thetaStart, thetaLength]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
};

const CentralCore = ({ textures }: { textures: THREE.Texture[] }) => {
  if (textures.length === 0) return null;
  return (
    <group position={[0, CORE_Y_OFFSET, 0]}>
      {Array.from({ length: CORE_SEGMENTS }).map((_, i) => (
        <CoreSegment key={i} index={i} texture={textures[i % textures.length]} />
      ))}
    </group>
  );
};

const FloatingParticles = ({ color, size, count, spread }: { color: string; size: number; count: number; spread: number }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const vertices = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 6 - 2.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    return positions;
  }, [count, spread]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    pointsRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.26) * 0.1;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[vertices, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

const Showcase = ({
  ringUrls,
  coreUrls,
  routeFor,
  interactive = true,
  onArtworkReady,
  rotationPaused = false,
  onFrontIndexChange,
  speed = 1,
}: {
  ringUrls: string[];
  coreUrls: string[];
  /** Lets the community mirror keep segment clicks inside /community. */
  routeFor?: (route: string) => string;
  /** Students view the academy — no clicks into teacher destinations. */
  interactive?: boolean;
  /** Fires once the building's artwork has decoded, so the page can fade in. */
  onArtworkReady?: () => void;
  /** Holds the building still while a video advertisement plays out. */
  rotationPaused?: boolean;
  /** Reports which outer position (0–7) currently faces the camera. */
  onFrontIndexChange?: (index: number) => void;
  /** Rotation rate multiplier — 1 is the cinematic default. */
  speed?: number;
}) => {

  const worldRef = useRef<THREE.Group>(null);
  const speedRef = useRef(ringSpeed);
  const hoveredRef = useRef(false);
  const frontIndexRef = useRef(0);
  const navigate = useNavigate();
  const { camera } = useThree();
  const pausedRef = useRef(rotationPaused);
  pausedRef.current = rotationPaused;
  const speedMulRef = useRef(clampBuildingSpeed(speed));
  speedMulRef.current = clampBuildingSpeed(speed);



  // Artwork per slot; repeated urls (the MathGPL hubs, the dome copies) load once.
  const uniqueUrls = useMemo(
    () => Array.from(new Set([...ringUrls, ...coreUrls])),
    [ringUrls, coreUrls],
  );
  // Textures load OUTSIDE Suspense and are swapped in only once decoded, so a
  // re-signed URL updates the existing materials instead of suspending (and
  // blanking) the whole scene.
  const [textureByUrl, setTextureByUrl] = useState<Map<string, THREE.Texture>>(new Map());
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    void Promise.all(
      uniqueUrls.map(
        (url) =>
          new Promise<[string, THREE.Texture | null]>((resolve) => {
            loader.load(
              url,
              (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                t.anisotropy = 8;
                resolve([url, t]);
              },
              undefined,
              () => resolve([url, null]),
            );
          }),
      ),
    ).then((entries) => {
      if (!alive) return;
      setTextureByUrl((prev) => {
        const next = new Map(prev);
        entries.forEach(([url, t]) => {
          if (t) next.set(url, t);
        });
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [uniqueUrls]);

  const coreTextures = useMemo(
    () => coreUrls.map((u) => textureByUrl.get(u)).filter((t): t is THREE.Texture => !!t),
    [coreUrls, textureByUrl],
  );

  // Only announce readiness once the core and at least one ring panel exist —
  // the page keeps showing the background until then, never a white panel.
  const artworkReady =
    coreTextures.length > 0 && ringUrls.some((u) => textureByUrl.has(u));
  useEffect(() => {
    if (artworkReady) onArtworkReady?.();
  }, [artworkReady, onArtworkReady]);




  useFrame((state, delta) => {
    if (!worldRef.current) return;
    // Ease rotation to a gentle near-stop while a hovered academy invites a
    // click, and all the way to rest while a video advertisement plays.
    const base = ringSpeed * speedMulRef.current;
    const targetSpeed = pausedRef.current ? 0 : hoveredRef.current ? base * 0.1 : base;

    speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 3.2, delta);
    worldRef.current.rotation.y += speedRef.current * delta;


    // Determine which segment currently faces the camera (front = nearest +Z).
    // Cylinder vertex angle: pos = (R·sinθ, y, R·cosθ); front faces camera at θ = 0.
    const twoPi = Math.PI * 2;
    const baseRot = worldRef.current.rotation.y;
    let best = 0;
    let bestCos = -Infinity;
    for (let i = 0; i < SEGMENTS; i += 1) {
      const center = i * SEG_ANGLE + SEG_ANGLE / 2 + baseRot;
      const c = Math.cos(((center % twoPi) + twoPi) % twoPi);
      if (c > bestCos) {
        bestCos = c;
        best = i;
      }
    }
    if (frontIndexRef.current !== best) {
      frontIndexRef.current = best;
      onFrontIndexChange?.(best);
    }

    // Gentle breathing bob of the whole world for a living, floating feel.
    worldRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.12;

    // Subtle cinematic camera drift + parallax + breathing zoom. Never jarring.
    const t = state.clock.elapsedTime;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(t * 0.12) * 0.45, 2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, -0.2 + Math.sin(t * 0.17) * 0.16, 2, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 10.5 + Math.sin(t * 0.1) * 0.35, 2, delta);
    camera.lookAt(0, 0, 0);
  });

  const handleActivate = (clickedIndex?: number) => {
    const idx = typeof clickedIndex === "number" ? clickedIndex : frontIndexRef.current;
    const academy = academies[idx];
    if (academy) navigate(routeFor ? routeFor(academy.route) : academy.route);
  };

  return (
    <>
      <ambientLight intensity={1.7} />
      <pointLight position={[0, 1.2, 7]} intensity={20} color="#ffe0b0" distance={20} />
      <pointLight position={[-3, 2.4, 2]} intensity={9} color="#c287ff" distance={16} />
      <pointLight position={[3, -1.4, -2]} intensity={6} color="#87cefa" distance={16} />

      {/* Magical purple energy + floating mathematical sparks (no orbit rings). */}
      <FloatingParticles color="#ffe7c2" size={0.04} count={140} spread={16} />
      <FloatingParticles color="#c79bff" size={0.06} count={110} spread={13} />

      <group ref={worldRef}>
        {/* Inner royal palace core — locked to the same group so it rotates with the city. */}
        <CentralCore textures={coreTextures} />
        {academies.map((academy, i) => (
          <WorldSegment
            key={i}
            index={i}
            texture={textureByUrl.get(ringUrls[i] ?? academy.image)}
            interactive={interactive}
            onActivate={handleActivate}
            onHoverChange={(h) => (hoveredRef.current = h)}
          />
        ))}
      </group>

      <fog attach="fog" args={["#e9b58f", 13, 26]} />
    </>
  );
};

/** Layer behind the building: shipped clouds, or the account's own image/video. */
const HomepageBackground = ({
  background,
}: {
  background: ReturnType<typeof useHomepageConfig>["config"]["background"];
}) => {
  if (!background?.path) {
    return (
      <video
        src={DEFAULT_BACKGROUND.url}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
    );
  }
  return (
    <SignedMedia
      path={background.path}
      source={background.source}
      mediaType={background.mediaType}
      fit="cover"
      loop
      muted
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
};

/** A whole replacement building: one image or one looping video. */
const CustomBuilding = ({
  element,
  speed = 1,
}: {
  element: NonNullable<ReturnType<typeof useHomepageConfig>["config"]["customBuilding"]>;
  /** Video playback rate — 1 is the building's own natural speed. */
  speed?: number;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  // Any video inside this building plays at the authored speed.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rate = clampBuildingSpeed(speed);
    const apply = () => {
      host.querySelectorAll("video").forEach((v) => {
        try {
          v.playbackRate = rate;
        } catch {
          /* some browsers refuse extreme rates — keep the default */
        }
      });
    };
    apply();
    const t = window.setInterval(apply, 800);
    return () => window.clearInterval(t);
  }, [speed, element.storagePath]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute"
      style={{
        left: `${element.x * 100}%`,
        top: `${element.y * 100}%`,
        width: `${element.scale * 100}%`,
        transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
        opacity: element.opacity,
      }}
    >
      <SignedMedia
        path={element.storagePath}
        source={element.source}
        mediaType={element.mediaType}
        fit="contain"
        className="h-auto w-full"
      />
    </div>
  );
};


export const RotatingAdventureScene = ({
  routeFor,
  interactive = true,
  configMode = "self",
  ownerUserId,
  showAds = false,

}: {
  routeFor?: (route: string) => string;
  /** Students view the academy; segments are not clickable for them. */
  interactive?: boolean;
  /**
   * Which building configuration to render.
   * "self" = this account's Pro building, "school-readonly" = the owner's
   * building, "platform-free" = the platform-owned Free building.
   */
  configMode?: HomepageConfigMode;
  /** Render a named account's own building (a school or teacher identity). */
  ownerUserId?: string;
  /** Plays the platform advertisement billboard on this building. */
  showAds?: boolean;
} = {}) => {
  // ONE WebGL context for the life of the page. The canvas is never keyed on
  // artwork URLs — swapping textures happens INSIDE the live scene, so the
  // building never blinks out while config or signed URLs settle.
  const gpu = useWebglRecovery("homepage-building");
  const [painted, setPainted] = useState(false);
  const [artworkReady, setArtworkReady] = useState(false);
  const { config, ready } = useHomepageConfig({ mode: configMode, ...(ownerUserId ? { ownerUserId } : {}) });

  const slotUrls = useResolvedSlotUrls(config.slotOverrides);
  const buildingVersion = configMode === "platform-free" ? "free" : "pro";
  // Advertisements come from the building pipeline, never from the page.
  const ads = usePlayableAds(showAds);
  const { current: currentAd, rotationPaused, onVideoEnded, onFacingChange } = useFacingAdRotation(ads);
  // Image advertisements also repaint their own outer artwork position, so the
  // 8 slots read as the building's own advertising surfaces.
  const adImageUrls = useAdImageUrls(ads);


  const ringUrls = useMemo(
    () =>
      RING_SLOTS.map((slot, i) => {
        // An empty or disabled slot simply keeps the building's own artwork.
        const ad = showAds ? adForOuterPosition(ads, i) : null;
        if (ad && ad.media_type === "image" && adImageUrls[i]) return adImageUrls[i];
        // The Free building ships its own outer artwork (the billboard palace).
        return slotUrls[slot.id] ?? defaultUrlFor(slot, buildingVersion);
      }),
    [slotUrls, showAds, ads, adImageUrls, buildingVersion],
  );
  const coreUrls = useMemo(
    () => CORE_SLOTS.map((slot) => slotUrls[slot.id] ?? slot.defaultUrl),
    [slotUrls],
  );

  const usingCustom = config.buildingMode === "custom" && !!config.customBuilding;
  // Only reveal the canvas once it has painted AND the artwork has decoded, so
  // no untextured (white) geometry is ever on screen.
  const visible = painted && artworkReady && gpu.alive;
  const handleArtworkReady = useCallback(() => setArtworkReady(true), []);

  return (
    <main className="relative h-screen w-screen overflow-hidden animate-fade-in bg-background">
      <HomepageBackground background={config.background} />
      {usingCustom ? (
        <CustomBuilding element={config.customBuilding!} />
      ) : ready ? (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <Canvas
            key={gpu.resetKey}
            camera={{ position: [0, -0.2, 10.5], fov: 42, near: 0.1, far: 100 }}
            dpr={[1, 1.25]}
            gl={{ antialias: true, alpha: true, powerPreference: "default", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }}
            onCreated={({ gl }) => {
              // Shared recovery: block the default teardown so the browser can
              // restore the SAME context, clear any hover cursor the loss froze,
              // and fade in on the first painted frame.
              gpu.attach(gl.domElement);
              setScopedCursor(gl.domElement, "default");
              requestAnimationFrame(() => setPainted(true));
            }}
          >
            {/* Fallback keeps the sky visible; the canvas itself stays mounted. */}
            <Suspense fallback={null}>
              <Showcase
                ringUrls={ringUrls}
                coreUrls={coreUrls}
                routeFor={routeFor}
                interactive={interactive}
                onArtworkReady={handleArtworkReady}
                rotationPaused={rotationPaused}
                onFrontIndexChange={onFacingChange}
              />
            </Suspense>
          </Canvas>
        </div>
      ) : null}
      {showAds && currentAd ? (
        <BuildingBillboard creative={currentAd} onVideoEnded={onVideoEnded} />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,hsl(var(--background)/0.18)_40%,hsl(var(--background)/0.55)_100%)]" />

    </main>
  );
};

