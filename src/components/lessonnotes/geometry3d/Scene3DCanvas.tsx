// Scene3DCanvas — the ONE renderer for the 3D Geometry Workspace and for
// 3D scenes embedded in a Lesson Note.
//
// Three interaction levels, all of which keep the camera free:
//   "workspace" — select objects + transform gizmos
//   "lesson"    — objects locked; faces / edges / vertices are pickable
//   "view"      — students: camera only

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Line, TransformControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { geometryFor, baseRotationY } from "@/lib/geometry3d/geometryFactory";
import { curvedSurfaceGeometry, openFacesOf, polygonFaceGeometry } from "@/lib/geometry3d/openFaces";
import { SolidElements } from "./SolidElements";
import { LessonOverlay } from "./LessonOverlay";
import { LabelLayer } from "./labels/LabelLayer";
import { displayScaleOf, mathScale, viewSolid } from "@/lib/geometry3d/displayScale";

import { topologyFor, type ElementKind } from "@/lib/geometry3d/topology";

import {
  DEFAULT_CAMERA,
  DEFAULT_LABEL_SETTINGS,
  DEFAULT_SETTINGS,

  isLightTheme,
  resolveBackground,
  type Annotation3D,
  type Scene3D,
  type Scene3DSettings,
  type Solid3D,
  type Vec3,
  visibleAnnotations,
} from "@/lib/geometry3d/scene3d";

export type Interaction3D = "workspace" | "lesson" | "view";

/**
 * The solid drawn as a HOLLOW SHELL — one mesh per real mathematical face,
 * with the teacher's open faces simply not drawn. Used only while at least one
 * face is open; a closed solid keeps the original single-mesh path untouched.
 */
function ShellSurfaces({
  solid,
  openFaces,
  color,
}: {
  solid: Solid3D;
  openFaces: number[];
  color: string;
}) {
  const surfaces = useMemo(() => {
    const topo = topologyFor(solid);
    return topo.faces
      .filter((f) => !openFaces.includes(f.index))
      .map((f) => ({
        index: f.index,
        geometry:
          f.shape === "polygon" && f.points
            ? polygonFaceGeometry(f.points)
            : curvedSurfaceGeometry(solid),
      }));
  }, [solid, openFaces]);

  useEffect(() => () => surfaces.forEach((s) => s.geometry.dispose()), [surfaces]);

  return (
    <group>
      {surfaces.map((s) => (
        <mesh key={`shell${s.index}`} geometry={s.geometry} userData={{ mathSolid: true }}>
          <meshStandardMaterial
            color={color}
            flatShading
            roughness={0.55}
            metalness={0.05}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A soft light riding with the camera so an opened solid is lit inside. */
function ViewpointLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });
  return <pointLight ref={ref} intensity={12} distance={40} decay={1.6} />;
}

function Solid3DMesh({
  solid,
  selected,
  selectable,
  onSelect,
  children,
}: {
  solid: Solid3D;
  selected: boolean;
  selectable: boolean;
  onSelect?: (id: string) => void;
  children?: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => geometryFor(solid), [solid]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);
  const color = solid.style?.color ?? "#7dd3fc";
  const isSolid = solid.style?.display === "solid";
  // Open Face applies to the solid surface only — a wireframe has none.
  const openFaces = useMemo(() => openFacesOf(solid), [solid]);
  const hollow = isSolid && openFaces.length > 0;

  useEffect(() => () => { geometry.dispose(); edges.dispose(); }, [geometry, edges]);

  return (
    <group
      ref={groupRef}
      name={solid.id}
      position={solid.position}
      rotation={solid.rotation}
      scale={solid.scale}
      onPointerDown={(e) => {
        if (!selectable) return;
        e.stopPropagation();
        onSelect?.(solid.id);
      }}

    >
      <group rotation={[0, baseRotationY(solid), 0]}>
        {hollow ? (
          <ShellSurfaces solid={solid} openFaces={openFaces} color={color} />
        ) : (
          <mesh geometry={geometry} castShadow={false} userData={{ mathSolid: isSolid }}>
            {isSolid ? (
              <meshStandardMaterial
                color={color}
                flatShading
                roughness={0.55}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            ) : (
              <meshBasicMaterial color={color} transparent opacity={0.06} depthWrite={false} />
            )}
          </mesh>
        )}
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={selected ? "#fbbf24" : isSolid ? "#0f172a" : color} />
        </lineSegments>
        {children}
      </group>
    </group>
  );
}



/** X / Y / Z guide axes — orientation guides only, never selectable. */
function AxesGuides({ settings, length = 6 }: { settings: Scene3DSettings; length?: number }) {
  const light = isLightTheme(settings);
  const labelClass = `select-none text-[11px] font-semibold ${light ? "text-slate-700" : "text-white/80"}`;
  const axes: { key: string; on: boolean; dir: Vec3; color: string }[] = [
    { key: "X", on: settings.showAxisX, dir: [1, 0, 0], color: "#f87171" },
    { key: "Y", on: settings.showAxisY, dir: [0, 1, 0], color: "#4ade80" },
    { key: "Z", on: settings.showAxisZ, dir: [0, 0, 1], color: "#60a5fa" },
  ];

  const ticks = settings.coordinateLabels ? [-4, -2, 2, 4] : [];

  return (
    <group>
      {axes.filter((a) => a.on).map((a) => (
        <group key={a.key}>
          <Line
            points={[
              [-a.dir[0] * length, -a.dir[1] * length, -a.dir[2] * length],
              [a.dir[0] * length, a.dir[1] * length, a.dir[2] * length],
            ]}
            color={a.color}
            lineWidth={settings.axisThickness}
            raycast={() => null}
          />
          {settings.axisLabels && (
            <Html
              position={[a.dir[0] * (length + 0.4), a.dir[1] * (length + 0.4), a.dir[2] * (length + 0.4)]}
              center
              style={{ pointerEvents: "none" }}
            >
              <span className={labelClass} style={{ color: a.color }}>{a.key}</span>
            </Html>
          )}
          {ticks.map((t) => (
            <Html
              key={`${a.key}${t}`}
              position={[a.dir[0] * t, a.dir[1] * t, a.dir[2] * t]}
              center
              style={{ pointerEvents: "none" }}
            >
              <span className={labelClass} style={{ opacity: 0.65 }}>{t}</span>
            </Html>
          ))}
        </group>
      ))}
      {/* The origin marker is a visual part of the axis system: it renders only
          while at least one axis is visible. The setting itself is untouched,
          so the point still exists for positioning / snapping / coordinates. */}
      {settings.showOrigin && axes.some((a) => a.on) && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshBasicMaterial color={light ? "#334155" : "#e2e8f0"} />
        </mesh>
      )}
    </group>
  );
}

/** Transform gizmo bound to the selected object, looked up in the live scene. */
function SelectionGizmo({
  targetId,
  mode,
  controlsRef,
  onCommit,
}: {
  targetId: string;
  mode: "translate" | "rotate" | "scale";
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  onCommit: (next: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
}) {
  const { scene } = useThree();
  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let raf = 0;
    const find = () => {
      const obj = scene.getObjectByName(targetId) ?? null;
      if (obj) setTarget(obj);
      else raf = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(raf);
  }, [scene, targetId]);

  if (!target) return null;

  return (
    <TransformControls
      object={target}
      mode={mode}
      size={0.85}
      onMouseDown={() => { if (controlsRef.current) controlsRef.current.enabled = false; }}
      onMouseUp={() => {
        if (controlsRef.current) controlsRef.current.enabled = true;
        onCommit({
          position: [target.position.x, target.position.y, target.position.z],
          rotation: [target.rotation.x, target.rotation.y, target.rotation.z],
          scale: [target.scale.x, target.scale.y, target.scale.z],
        });
      }}
    />
  );
}

function CameraRig({
  camera,
  resetToken,
  controlsRef,
}: {
  camera: { position: Vec3; target: Vec3 };
  resetToken?: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera: cam } = useThree();
  useEffect(() => {
    if (resetToken === undefined) return;
    cam.position.set(...camera.position);
    controlsRef.current?.target.set(...camera.target);
    controlsRef.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);
  return null;
}

export interface Scene3DCanvasProps {
  scene: Scene3D;
  /** Legacy alias for interaction="workspace". */
  editable?: boolean;
  interaction?: Interaction3D;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  transformMode?: "translate" | "rotate" | "scale";
  onTransform?: (id: string, next: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
  /** Lesson Mode: which mathematical element type is pickable. */
  pickKind?: ElementKind | null;
  onPickElement?: (solidId: string, kind: ElementKind, index: number) => void;
  activeElement?: { solidId: string; kind: ElementKind; index: number } | null;
  /** Bump to re-apply the scene's default camera. */
  resetToken?: number;
  /** Fired when the user finishes an orbit/zoom/pan. */
  onCameraChange?: (cam: { position: Vec3; target: Vec3 }) => void;
  /** "demand" keeps idle lesson-note canvases free. */
  frameloop?: "always" | "demand";
  /** Display unit + precision for measurement overlays. */
  unit?: string;
  decimals?: number;
  /** Teaching-panel emphasis passed through to the lesson overlay. */
  emphasis?: { solidId: string; guide: string } | null;
  highlightFace?: { solidId: string; index: number } | null;
  fillSolidId?: string | null;
  className?: string;
}

export function Scene3DCanvas({
  scene,
  editable = false,
  interaction,
  selectedId = null,
  onSelect,
  transformMode = "translate",
  onTransform,
  pickKind = null,
  onPickElement,
  activeElement = null,
  resetToken,
  onCameraChange,
  frameloop = "demand",
  unit = "none",
  decimals = 2,
  emphasis = null,
  highlightFace = null,
  fillSolidId = null,
  className,
}: Scene3DCanvasProps) {
  const mode: Interaction3D = interaction ?? (editable ? "workspace" : "view");
  const cam = scene.camera ?? DEFAULT_CAMERA;
  const settings = scene.settings ?? DEFAULT_SETTINGS;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const light = isLightTheme(settings);
  // Workspace stage stays clean: labels belong to the lesson / finished diagram.
  const showLabels = mode !== "workspace" && (scene.lesson?.showLabels ?? true);

  const labelSettings = scene.lesson?.labels ?? DEFAULT_LABEL_SETTINGS;
  // Display gate — the calculation engine keeps every value, but a label is
  // drawn only when the teacher has switched that individual item on.
  const annotations: Annotation3D[] = useMemo(
    () => visibleAnnotations(scene.annotations),
    [scene.annotations],
  );

  // Mathematical dimensions never change how big the model looks: everything
  // is rendered from a normalised "view solid" and converted back with k.
  const viewObjects = useMemo(() => scene.objects.map(viewSolid), [scene.objects]);
  const scaleById = useMemo(
    () => Object.fromEntries(scene.objects.map((s) => [s.id, mathScale(s)])) as Record<string, number>,
    [scene.objects],
  );
  const viewScene = useMemo<Scene3D>(() => ({ ...scene, objects: viewObjects }), [scene, viewObjects]);


  const background = resolveBackground(settings);
  const bgColor = useMemo(() => {
    const c = new THREE.Color(background);
    const b = settings.backgroundBrightness;
    return b === 1 ? c : c.multiplyScalar(b);
  }, [background, settings.backgroundBrightness]);

  const gridColors = useMemo(() => {
    const base = new THREE.Color(settings.gridColor);
    const bg = new THREE.Color(background);
    const section = base.clone().lerp(bg, 1 - settings.gridOpacity);
    const cell = base.clone().lerp(bg, 1 - settings.gridOpacity * 0.6);
    return { section: `#${section.getHexString()}`, cell: `#${cell.getHexString()}` };
  }, [settings.gridColor, settings.gridOpacity, background]);

  return (
    <Canvas
      className={className}
      frameloop={frameloop}
      dpr={[1, 2]}
      camera={{ position: cam.position, fov: 45, near: 0.02, far: 200 }}
      onPointerMissed={() => mode === "workspace" && onSelect?.(null)}
    >
      <color attach="background" args={[bgColor]} />
      <ambientLight intensity={light ? 1.1 : 0.8} />
      <ViewpointLight />

      <directionalLight position={[5, 8, 5]} intensity={0.7} />
      <directionalLight position={[-6, -3, -5]} intensity={0.25} />
      <Suspense fallback={null}>
        <LabelLayer>

        {settings.showGrid && (
          <Grid
            args={[24, 24]}
            cellSize={1}
            cellThickness={0.5}
            cellColor={gridColors.cell}
            sectionSize={4}
            sectionThickness={0.9}
            sectionColor={gridColors.section}
            infiniteGrid
            fadeDistance={40}
            followCamera={false}
          />
        )}
        <AxesGuides settings={settings} />
        {viewObjects.map((s) => (
          <Solid3DMesh
            key={s.id}
            solid={s}
            selected={mode !== "view" && s.id === selectedId}
            selectable={
              mode === "workspace" ||
              // In lesson mode the picked solid hands its clicks to the
              // face / edge / vertex proxies instead of re-selecting itself.
              (mode === "lesson" && !(s.id === selectedId && !!pickKind))
            }
            onSelect={onSelect}
          >
            <SolidElements
              solid={s}
              annotations={annotations.filter((a) => a.target.solidId === s.id)}
              showLabels={showLabels}
              labelSettings={labelSettings}
              mathScale={scaleById[s.id] ?? 1}
              unit={unit}
              decimals={decimals}
              lightTheme={light}
              pickKind={mode === "lesson" && s.id === selectedId ? pickKind : null}
              onPick={(kind, index) => onPickElement?.(s.id, kind, index)}

              activeIndex={
                activeElement && activeElement.solidId === s.id && activeElement.kind === pickKind
                  ? activeElement.index
                  : null
              }
            />

          </Solid3DMesh>
        ))}
        {mode !== "workspace" && (
          <LessonOverlay
            scene={viewScene}
            scaleOf={(id) => scaleById[id] ?? 1}
            light={light}
            unit={unit}
            decimals={decimals}
            emphasis={emphasis}
            highlightFace={highlightFace}
            fillSolidId={fillSolidId}
          />
        )}
        {mode === "workspace" && selectedId && (
          <SelectionGizmo
            key={selectedId}
            targetId={selectedId}
            mode={transformMode}
            controlsRef={controlsRef}
            onCommit={(next) => {
              const src = scene.objects.find((o) => o.id === selectedId);
              const d = src ? displayScaleOf(src) : 1;
              // The gizmo scales the *rendered* solid: strip the display factor
              // back out so the stored scale stays display-only and stable.
              onTransform?.(selectedId, {
                ...next,
                scale: [next.scale[0] / d, next.scale[1] / d, next.scale[2] / d],
              });
            }}
          />
        )}
        </LabelLayer>
      </Suspense>

      <CameraRig camera={cam} resetToken={resetToken} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enablePan
        // Small minimum distance so the teacher can move the viewpoint through
        // an opened face and look around inside the solid.
        minDistance={0.05}
        enableZoom
        enableRotate

        target={cam.target}
        onEnd={() => {
          const c = controlsRef.current;
          if (!c || !onCameraChange) return;
          const p = c.object.position;
          const t = c.target;
          onCameraChange({ position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] });
        }}
      />
    </Canvas>
  );
}

export default Scene3DCanvas;
