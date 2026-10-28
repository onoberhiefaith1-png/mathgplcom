/**
 * SHARED SURFACE RENDERING.
 *
 * One surface = a designed architectural panel (wall / floor / ceiling). The
 * hallway corridors and the classroom shells both render their surfaces through
 * this module, so a texture, its fit and its brightness behave identically
 * wherever it is applied.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { presetMaterial } from "@/lib/building/presets";
import { coverFit } from "@/lib/building/imageFit";

// ── Surface texture loading ───────────────────────────────────────────────
// Each surface owns its own texture instance so it can fit/tile independently
// without disturbing another surface that shows the same image. Decoded images
// are cached by the browser, so loading the same URL twice is cheap.

/**
 * Textures are cached per URL for the lifetime of the page and never disposed
 * while the scene is alive: a component unmount (or React's double-invoked
 * effects) must not pull the image out from under another surface or door that
 * shows the same design.
 */
const textureCache = new Map<string, Promise<THREE.Texture | null>>();

const loadTexture = (url: string): Promise<THREE.Texture | null> => {
  const hit = textureCache.get(url);
  if (hit) return hit;
  const p = new Promise<THREE.Texture | null>((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.anisotropy = 4;
        t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
  textureCache.set(url, p);
  return p;
};

/**
 * Every surface gets its OWN texture instance (a clone sharing the decoded
 * image). Two walls showing the same image therefore cannot fight over one
 * object's fit / zoom / position, which is what made an edit appear to land on
 * the wrong wall or not at all until the scene re-rendered.
 */
export const useLoadedTexture = (url: string | null | undefined): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let live = true;
    loadTexture(url).then((t) => {
      if (!live) return;
      if (!t) {
        setTex(null);
        return;
      }
      const own = t.clone();
      own.colorSpace = THREE.SRGBColorSpace;
      own.anisotropy = 4;
      own.needsUpdate = true;
      setTex(own);
    });
    return () => {
      live = false;
    };
  }, [url]);
  return tex;
};

/** Grey value for a faithful (unlit) textured surface: 1 = exactly as imported. */
const brightnessColor = (brightness: number): string => {
  const v = Math.min(2, Math.max(0.2, Number.isFinite(brightness) ? brightness : 1));
  const c = new THREE.Color(1, 1, 1).multiplyScalar(Math.min(1, v));
  return `#${c.getHexString()}`;
};

/** One surface (wall / floor / roof) of a corridor segment. */
export const Surface = ({
  url,
  presetKey,
  color,
  scale,
  offsetX,
  offsetY,
  repeat,
  fit,
  brightness = 1,
  planeW,
  planeH,
  position,
  "rotation-x": rotationX,
  "rotation-y": rotationY,
  castShadow,
  receiveShadow,
  facing = THREE.DoubleSide,
children,
}: {
  url?: string | null;
  presetKey: string;
  color?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  repeat: boolean;
  fit: "cover" | "stretch";
  /** 0.2 – 2, 1 = exactly as imported. Only affects textured surfaces. */
  brightness?: number;
  planeW: number;
  planeH: number;
  position?: [number, number, number];
  "rotation-x"?: number;
  "rotation-y"?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /**
   * Which face of the surface is drawn. Corridor surfaces pass FrontSide with
   * their normal pointing INTO the hallway, so a corridor is only ever seen
   * from the inside: looking through a junction mouth shows the far hallway's
   * wallpaper, floor and ceiling instead of the unlit back of its shell.
   */
  facing?: THREE.Side;
children?: React.ReactNode;
}) => {
  const tex = useLoadedTexture(url);
  const mat = presetMaterial(presetKey, color);
  const map = tex ?? null;
  // Fit the texture to the plane. Runs when the texture or its placement
  // changes — never during render. The material is flagged so the new
  // placement is visible immediately, without waiting for anything else to
  // change in the scene.
  const matRef = useRef<THREE.Material | null>(null);
  useEffect(() => {
    if (!tex) return;
    const img = tex.image as { width?: number; height?: number } | undefined;
    const iw = img?.width ?? planeW;
    const ih = img?.height ?? planeH;
    if (repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const s = Math.max(0.1, scale);
      tex.repeat.set(s, s);
      tex.offset.set(offsetX, offsetY);
    } else {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      if (fit === "stretch") {
        tex.repeat.set(1, 1);
        tex.offset.set(0, 0);
      } else {
        const fitted = coverFit(planeW, planeH, iw, ih, scale, offsetX, offsetY);
        tex.repeat.set(fitted.repeat[0], fitted.repeat[1]);
        tex.offset.set(fitted.offset[0], fitted.offset[1]);
      }
    }
    tex.needsUpdate = true;
    if (matRef.current) matRef.current.needsUpdate = true;
  }, [tex, repeat, fit, scale, offsetX, offsetY, planeW, planeH, brightness]);
return (
    <mesh
      position={position}
      rotation-x={rotationX}
      rotation-y={rotationY}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
      <meshStandardMaterial
        color={mat.color}
        roughness={mat.roughness}
        metalness={mat.metalness}
        emissive={mat.emissive ?? "#000000"}
        emissiveIntensity={mat.emissiveIntensity ?? 0}
        side={facing}
      />
      {map && (
        // An imported image is artwork fitted ON the surface, not plaster: it
        // sits just in front of the painted plane, is rendered unlit and
        // outside tone mapping, so it looks exactly like the source file in
        // every hallway whatever the corridor lighting is doing. Transparent
        // areas of the image simply reveal the surface colour behind it.
        <mesh position={[0, 0, 0.012]}>
          {children}
          <meshBasicMaterial
            ref={matRef as never}
            color={brightnessColor(brightness)}
            map={map}
            transparent
            toneMapped={false}
            side={facing}
          />
        </mesh>
      )}
    </mesh>
  );
};
