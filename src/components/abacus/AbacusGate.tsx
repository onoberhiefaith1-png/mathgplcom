import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  children: ReactNode;
}

// The abacus itself acts as the "gate" — no literal doors.
// On win: a golden glow bursts out from behind it.
export const AbacusGate = ({ open, children }: Props) => {
  return (
    <div className="relative inline-block">
      {/* Glow burst behind the abacus */}
      <div
        className={cn(
          "absolute inset-0 -m-10 rounded-[40%] pointer-events-none transition-all duration-500",
          open ? "opacity-100 scale-125" : "opacity-0 scale-90",
        )}
        style={{
          background: "radial-gradient(circle, hsl(48 100% 60% / 0.85), hsl(40 100% 50% / 0.4) 40%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />
      {/* Light rays */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-500",
          open ? "opacity-90 animate-pulse" : "opacity-0",
        )}
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, hsl(48 100% 70% / 0.35) 20deg, transparent 40deg, transparent 80deg, hsl(48 100% 70% / 0.35) 100deg, transparent 120deg, transparent 160deg, hsl(48 100% 70% / 0.35) 180deg, transparent 200deg, transparent 240deg, hsl(48 100% 70% / 0.35) 260deg, transparent 280deg, transparent 320deg, hsl(48 100% 70% / 0.35) 340deg, transparent 360deg)",
          mixBlendMode: "screen",
        }}
      />
      <div className={cn("relative transition-transform duration-300", open && "scale-105")}>
        {children}
      </div>
    </div>
  );
};
