import { Link } from "react-router-dom";
import { GraduationCap, Image, Package } from "lucide-react";
import AcademyTopBar from "@/components/academy/AcademyTopBar";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import LevelNavPanel from "@/components/academy/LevelNavPanel";

const Index = () => (
  <>
    <AcademyTopBar />
    <HomeRotatingBuilding />
    <LevelNavPanel />
    <Link
      to="/backgrounds"
      aria-label="Open backgrounds"
      className="fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/70 px-4 py-2 text-sm font-medium text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
    >
      <Image className="h-4 w-4" />
      Backgrounds
    </Link>
    <Link
      to="/assets"
      aria-label="Open assets"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/70 px-4 py-2 text-sm font-medium text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
    >
      <Package className="h-4 w-4" />
      Assets
    </Link>
    <Link
      to="/teaching-hub"
      aria-label="Open Teaching Hub"
      className="fixed bottom-20 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-background/70 px-4 py-2 text-sm font-medium text-amber-200 shadow-[0_0_24px_hsl(40_90%_60%/0.3)] backdrop-blur transition hover:bg-amber-500/20"
    >
      <GraduationCap className="h-4 w-4" />
      Teaching Hub
    </Link>
  </>
);

export default Index;
