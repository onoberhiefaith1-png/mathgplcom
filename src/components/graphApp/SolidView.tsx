import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Environment, Html, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { Box, RotateCcw, PanelsTopLeft, MoveDiagonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtSolid, type Solid } from "@/lib/graphApp/solids";
import { PerspectiveCamera } from "three";

type Palette = { body: string; ink: string; diagonal: string; background: string; muted: string };
function Frame({ net }: { net: boolean }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const angle = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1,size.width / size.height));
    const distance = 3.2 / Math.sin(angle);
    camera.position.set(...(net ? [0,0,distance] as const : [distance*0.65,distance*0.45,distance*0.65] as const));
    camera.lookAt(0,0,0); camera.updateProjectionMatrix(); invalidate();
  }, [camera,size.width,size.height,net,invalidate]);
  return null;
}
function Geometry({ s, net, diagonal, palette }: { s: Solid; net: boolean; diagonal: boolean; palette: Palette }) {
  const [a,b,c] = s.dimensions;
  const box = s.kind === "cube" || s.kind === "cuboid";
  const l = a, w = s.kind === "cube" ? a : b, h = s.kind === "cube" ? a : c;
  const maxExtent = box ? Math.max(l,w,h) : Math.max(2*a,b ?? 2*a);
  const scale = (net ? 0.8 : 3) / maxExtent;
  const label = (text: string, position: [number,number,number]) => <Html position={position} center><span className="whitespace-nowrap rounded bg-card/95 px-2 py-1 text-xs font-semibold text-foreground">{text} {s.unit}</span></Html>;
  return <group scale={scale}>
    {net && box ? <>
      {/* Four side faces in a strip; top and bottom hinge from face two. */}
      {[[0,0,l,h],[(l+w)/2,0,w,h],[(l+w),0,l,h],[(3*l+3*w)/2,0,w,h],[(l+w)/2,(h+l)/2,w,l],[(l+w)/2,-(h+l)/2,w,l]].map(([x,y,width,height],i) => <mesh key={i} position={[x-l/2-w,y,0]}>
        <planeGeometry args={[width,height]} /><meshStandardMaterial color={palette.body} side={2} roughness={0.5} /><Edges color={palette.ink} />
        <Html center><span className="text-sm font-bold text-primary-foreground">{i+1}</span></Html>
        <Line points={[[-width/2,-height/2,0.001],[width/2,-height/2,0.001],[width/2,height/2,0.001],[-width/2,height/2,0.001],[-width/2,-height/2,0.001]]} color={palette.ink} lineWidth={1}/>
      </mesh>)}
    </> : <>
      <mesh>
        {box ? <boxGeometry args={[l,h,w]} /> : s.kind === "sphere" ? <sphereGeometry args={[a,48,32]} /> : s.kind === "cylinder" ? <cylinderGeometry args={[a,a,b,48]} /> : <coneGeometry args={[a,b,48]} />}
        <meshStandardMaterial color={palette.body} transparent opacity={diagonal ? 0.38 : 0.92} roughness={0.35} metalness={0.12} depthWrite={!diagonal} />
        <Edges color={palette.ink} threshold={25} />
      </mesh>
      {box ? <>
        {label(`l = ${fmtSolid(l)}`, [0,-h/2,-w/2])}
        {label(`w = ${fmtSolid(w)}`, [l/2,-h/2,0])}
        {label(`h = ${fmtSolid(h)}`, [-l/2,0,w/2])}
        {diagonal && <Line points={[[-l/2,-h/2,-w/2],[l/2,h/2,w/2]]} color={palette.diagonal} lineWidth={3} />}
      </> : <>
        {label(`r = ${fmtSolid(a)}`, [a,0,0])}
        {s.kind !== "sphere" && label(`h = ${fmtSolid(b)}`, [-a,0,0])}
        {diagonal && <Line points={s.kind === "sphere" ? [[-a,0,0],[a,0,0]] : s.kind === "cone" ? [[0,b/2,0],[a,-b/2,0]] : [[-a,-b/2,0],[a,b/2,0]]} color={palette.diagonal} lineWidth={3} />}
      </>}
    </>}
  </group>;
}
export default function SolidView({ solid }: { solid: Solid }) {
  const [net,setNet] = useState(false), [diagonal,setDiagonal] = useState(true), [reset,setReset] = useState(0);
  const [palette,setPalette] = useState<Palette | null>(null);
  const swatches = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const elements = swatches.current?.children;
    if (!elements) return;
    setPalette({ body: getComputedStyle(elements[0]).color, ink: getComputedStyle(elements[1]).color, diagonal: getComputedStyle(elements[2]).color, background: getComputedStyle(elements[3]).backgroundColor, muted: getComputedStyle(elements[4]).color });
  }, []);
  const box = solid.kind === "cube" || solid.kind === "cuboid";
  return <div className="relative h-full min-h-80" aria-label={`${solid.kind} 3D model`}>
    <div ref={swatches} className="hidden"><span className="text-primary"/><span className="text-foreground"/><span className="text-destructive"/><span className="bg-card"/><span className="text-muted-foreground"/></div>
    {palette && <Canvas key={`${reset}:${net}`} frameloop="demand" dpr={[1,1.5]} camera={{ position: net ? [0,0,8] : [6,4,6], fov: 42 }}>
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={0.8} /><directionalLight position={[5,8,5]} intensity={1.8} />
      <Environment resolution={64}><Lightformer intensity={2} position={[0,5,0]} rotation-x={-Math.PI/2} scale={[10,10,1]} color={palette.background} /><Lightformer intensity={1} position={[-5,1,-1]} rotation-y={Math.PI/2} scale={[10,4,1]} color={palette.body} /></Environment>
      <Geometry s={solid} net={net && box} diagonal={diagonal} palette={palette}/>
      <OrbitControls makeDefault enableDamping minDistance={3} maxDistance={40} />
      <Frame net={net}/>
    </Canvas>}
    <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-center gap-2">
      {box && <Button size="sm" variant={net ? "default" : "outline"} onClick={() => setNet(!net)}><PanelsTopLeft/>{net ? "Solid" : "Net"}</Button>}
      <Button size="sm" variant={diagonal ? "default" : "outline"} disabled={net && box} onClick={() => setDiagonal(!diagonal)}><MoveDiagonal/>{box ? "Diagonal" : solid.kind === "cone" ? "Slant height" : solid.kind === "sphere" ? "Diameter" : "Section diagonal"}</Button>
      <Button size="icon-sm" variant="outline" title="Reset solid view" aria-label="Reset solid view" onClick={() => setReset(k => k+1)}><RotateCcw/></Button>
    </div>
    <h2 className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 font-semibold capitalize"><Box className="h-5 w-5 text-primary"/>{solid.kind}</h2>
  </div>;
}