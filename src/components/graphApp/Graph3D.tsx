import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import type { Fn } from "@/lib/graphApp/math";
import { ncube, projectTo3D } from "@/lib/graphApp/ncube";
import type { Item } from "./Graph2D";
import { planeOf, type Plane } from "@/lib/graphApp/space";

function PlaneMesh({ plane, colour }: { plane: Plane; colour: string }) {
  const geo = useMemo(() => {
    // Solve for the coordinate with the largest normal component over a grid of the other two.
    const k = plane.n.map(Math.abs).indexOf(Math.max(...plane.n.map(Math.abs)));
    const [i, j] = [0, 1, 2].filter((v) => v !== k);
    const n = 24, pos: number[] = [], idx: number[] = [], ok: boolean[] = [];
    for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) {
      const c = [0, 0, 0]; c[i] = -R + (2 * R * a) / n; c[j] = -R + (2 * R * b) / n;
      c[k] = (plane.d - plane.n[i] * c[i] - plane.n[j] * c[j]) / plane.n[k];
      ok.push(Math.abs(c[k]) <= R);
      const v = P(c[0], c[1], Math.max(-R, Math.min(R, c[2]))); pos.push(v.x, v.y, v.z);
    }
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const q = a * (n + 1) + b, r = q + 1, s2 = q + n + 1, t = s2 + 1;
      if (ok[q] && ok[r] && ok[s2] && ok[t]) idx.push(q, s2, r, r, s2, t);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }, [plane]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo}><meshStandardMaterial color={colour} side={THREE.DoubleSide} transparent opacity={0.55} depthWrite={false} /></mesh>;
}

const R = 5; // visible half-range
// Maths z is "up": map (x, y, z) → three (x, z, -y)
const P = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

function colourFor(t: number) {
  return new THREE.Color().setHSL(0.75 - 0.75 * Math.min(1, Math.max(0, t)), 0.85, 0.55);
}

function Surface({ f }: { f: Fn }) {
  const geo = useMemo(() => {
    const n = typeof window !== "undefined" && window.innerWidth < 700 ? 40 : 70;
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = -R + (2 * R * i) / n, y = -R + (2 * R * j) / n;
      let z = f({ x, y });
      if (!Number.isFinite(z)) z = Number.NaN;
      zs.push(z);
    }
    const fin = zs.filter(Number.isFinite).map((z) => Math.max(-2 * R, Math.min(2 * R, z)));
    const lo = Math.min(...fin), hi = Math.min(Math.max(...fin), lo + 2 * R);
    zs.forEach((z, k) => {
      const i = Math.floor(k / (n + 1)), j = k % (n + 1);
      const x = -R + (2 * R * i) / n, y = -R + (2 * R * j) / n;
      const zc = Number.isFinite(z) ? Math.max(-2 * R, Math.min(2 * R, z)) : 0;
      const v = P(x, y, zc);
      pos.push(v.x, v.y, v.z);
      const c = colourFor(hi > lo ? (zc - lo) / (hi - lo) : 0.5);
      col.push(c.r, c.g, c.b);
    });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j, b = a + 1, c = a + n + 1, d = c + 1;
      if ([a, b, c, d].every((k) => Number.isFinite(zs[k]) && Math.abs(zs[k]) < 2 * R)) idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [f]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.85} roughness={0.5} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial wireframe color="#ffffff" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function Implicit({ f }: { f: Fn }) {
  const obj = useMemo(() => {
    const res = 48;
    const mc = new MarchingCubes(res, new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }), false, false, 200000);
    mc.isolation = 0;
    for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = -R + (2 * R * i) / (res - 1), z = -R + (2 * R * j) / (res - 1), y = R - (2 * R * k) / (res - 1);
      const v = -f({ x, y, z });
      mc.field[i + j * res + k * res * res] = Number.isFinite(v) ? v : -1e3;
    }
    mc.update();
    mc.scale.set(R, R, R);
    return mc;
  }, [f]);
  useEffect(() => () => obj.geometry.dispose(), [obj]);
  return <primitive object={obj} />;
}

function Param({ fx, fy, fz, colour }: { fx: Fn; fy: Fn; fz: Fn; colour: string }) {
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let t = -4 * Math.PI; t <= 4 * Math.PI; t += 0.03) {
      const s = { t };
      const x = fx(s), y = fy(s), z = fz(s);
      if ([x, y, z].every(Number.isFinite)) out.push(P(x, y, z));
    }
    return out;
  }, [fx, fy, fz]);
  return pts.length > 1 ? <Line points={pts} color={colour} lineWidth={3} /> : null;
}

function Point3({ p, colour, labels }: { p: [number, number, number]; colour: string; labels: boolean }) {
  const [x, y, z] = p;
  return (
    <group>
      <mesh position={P(x, y, z)}><sphereGeometry args={[0.15, 20, 20]} /><meshStandardMaterial color={colour} /></mesh>
      <Line points={[P(x, y, z), P(x, y, 0)]} color="#475569" dashed dashSize={0.15} gapSize={0.1} lineWidth={1.5} />
      {labels && <Html position={P(x, y, z + 0.5)} center><div className="whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-sm text-background">({x}, {y}, {z})</div></Html>}
    </group>
  );
}

function NCube({ n, angle }: { n: number; angle: number }) {
  const { verts, edges } = useMemo(() => ncube(n), [n]);
  const proj = verts.map((v) => { const [a, b, c] = projectTo3D(v, angle); return new THREE.Vector3(a * 1.6, b * 1.6, c * 1.6); });
  return (
    <group>
      {edges.map(([a, b], i) => <Line key={i} points={[proj[a], proj[b]]} color="#38bdf8" lineWidth={1.5} />)}
      {proj.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.07, 10, 10]} /><meshStandardMaterial color="#f59e0b" /></mesh>)}
    </group>
  );
}

function Axes({ labels }: { labels: boolean }) {
  const ax: Array<[string, THREE.Vector3, string]> = [["X", P(R + 1, 0, 0), "#dc2626"], ["Y", P(0, R + 1, 0), "#2563eb"], ["Z", P(0, 0, R + 1), "#16a34a"]];
  return (
    <group>
      {ax.map(([name, end, c]) => (
        <group key={name}>
          <Line points={[end.clone().multiplyScalar(-1), end]} color={c} lineWidth={2.5} />
          {labels && <Html position={end} center><span className="text-lg font-bold" style={{ color: c }}>{name}</span></Html>}
          {labels && [-4, -2, 2, 4].map((t) => (
            <Html key={t} position={end.clone().normalize().multiplyScalar(t)} center>
              <span className="text-xs font-semibold" style={{ color: c }}>{t}</span>
            </Html>
          ))}
        </group>
      ))}
    </group>
  );
}

export interface Graph3DProps {
  items: Item[];
  grid: boolean; axes: boolean; labels: boolean;
  mode: "rotate" | "pan" | "zoom";
  resetKey: number;
  nd?: { n: number; angle: number } | null;
  /** Cross-section contour segments in maths coordinates, drawn at their height. */
  section?: [number, number, number][][] | null;
}

function FitScene({ children, revision, controls }: { children: React.ReactNode; revision: number; controls: React.RefObject<OrbitImpl | null> }) {
  const group = useRef<THREE.Group>(null);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!group.current || !(camera instanceof THREE.PerspectiveCamera)) return;
      const box = new THREE.Box3().setFromObject(group.current);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3()), extent = box.getSize(new THREE.Vector3());
      const radius = Math.max(1, extent.length() / 2);
      const angle = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, size.width / size.height));
      const distance = radius / Math.sin(angle) * 1.2;
      camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(distance));
      camera.near = Math.max(0.01, distance / 1000); camera.far = Math.max(1000, distance * 20); camera.updateProjectionMatrix();
      if (controls.current) { controls.current.target.copy(center); controls.current.update(); }
      camera.lookAt(center); invalidate();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [revision, camera, size.width, size.height, controls, invalidate]);
  return <group ref={group}>{children}</group>;
}

export default function Graph3D({ items, grid, axes, labels, mode, resetKey, nd, section }: Graph3DProps) {
  const controls = useRef<OrbitImpl | null>(null);
  useEffect(() => { controls.current?.reset(); }, [resetKey]);
  const left = mode === "rotate" ? THREE.MOUSE.ROTATE : mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.DOLLY;
  return (
    <Canvas camera={{ position: [9, 7, 9], fov: 45 }} dpr={[1, 2]} className="touch-none">
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      {grid && <gridHelper args={[2 * R, 2 * R, "#64748b", "#334155"]} />}
      {axes && !nd && <Axes labels={labels} />}
      <FitScene revision={resetKey} controls={controls}>{nd ? <NCube n={nd.n} angle={nd.angle} /> : items.filter((i) => !i.hidden).map((it) => {
        const e = it.eq;
        if (e.kind === "surface") return <Surface key={it.id} f={e.f} />;
        const plane = e.kind === "implicit3d" ? planeOf(e) : null;
        if (plane) return <PlaneMesh key={it.id} plane={plane} colour={it.colour} />;
        if (e.kind === "implicit3d") return <Implicit key={it.id} f={e.f} />;
        if (e.kind === "parametric") return <Param key={it.id} fx={e.fx} fy={e.fy} fz={e.fz} colour={it.colour} />;
        if (e.kind === "point3d") return <Point3 key={it.id} p={e.p} colour="#f59e0b" labels={labels} />;
        return null;
      })}</FitScene>
      {section && section.length > 0 && <group>{section.map((seg, i) => <Line key={i} points={seg.map(([x, y, z]) => P(x, y, z))} color="#facc15" lineWidth={3} />)}</group>}
      <OrbitControls
        ref={controls as never}
        makeDefault
        enableDamping
        minDistance={0.25}
        maxDistance={10000}
        mouseButtons={{ LEFT: left, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: mode === "pan" ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  );
}
