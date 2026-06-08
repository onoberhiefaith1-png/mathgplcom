import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  alt: string;
  /** Number of depth layers stacked behind the front face. Higher = thicker standee. */
  depthLayers?: number;
  /** Spacing between layers in pixels. */
  layerGap?: number;
  /** Auto-rotation speed in degrees per second. Set to 0 to pause. */
  speed?: number;
};

/**
 * Pseudo-3D billboard: stacks copies of the character image along the Z axis
 * to fake volume, then rotates the whole stack around the Y axis.
 * Drag horizontally to control rotation; release to resume auto-spin.
 */
const Character3DBillboard = ({
  src,
  alt,
  depthLayers = 14,
  layerGap = 3,
  speed = 45,
}: Props) => {
  const [angle, setAngle] = useState(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastT = useRef<number | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      if (lastT.current == null) lastT.current = t;
      const dt = (t - lastT.current) / 1000;
      lastT.current = t;
      if (!paused.current && speed !== 0) {
        setAngle((a) => (a + speed * dt) % 360);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    paused.current = true;
    lastX.current = e.clientX;
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    setAngle((a) => (a + dx * 0.6) % 360);
  };
  const onPointerUp = () => {
    dragging.current = false;
    paused.current = false;
  };

  // Build the layered standee. Front layer is fully opaque & sharp;
  // inner layers are slightly darker to mimic side shading.
  const layers = Array.from({ length: depthLayers }, (_, i) => {
    const z = -(i * layerGap);
    // darken inner slices a bit so the side reads as volume
    const t = i / Math.max(1, depthLayers - 1);
    const brightness = 1 - t * 0.55;
    return (
      <img
        key={i}
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
        style={{
          transform: `translateZ(${z}px)`,
          filter: `brightness(${brightness})`,
          pointerEvents: "none",
        }}
      />
    );
  });

  return (
    <div
      className="relative mx-auto h-[420px] w-[320px] cursor-grab touch-none active:cursor-grabbing sm:h-[520px] sm:w-[400px]"
      style={{ perspective: "1200px" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Soft ground shadow */}
      <div
        aria-hidden
        className="absolute left-1/2 bottom-4 -translate-x-1/2 rounded-[50%] bg-black/50 blur-md"
        style={{ width: "60%", height: "24px" }}
      />
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${angle}deg)`,
        }}
      >
        {/* Back layers first (lower z) */}
        {layers.reverse()}
        {/* Sharp front face on top */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
          style={{ transform: `translateZ(${layerGap * 0.5}px)` }}
        />
      </div>
    </div>
  );
};

export default Character3DBillboard;
