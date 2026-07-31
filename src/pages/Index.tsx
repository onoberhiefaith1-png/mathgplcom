import { Link } from "@/lib/router-compat";
import { GraduationCap, Image, Package, Users } from "lucide-react";
import AcademyTopBar from "@/components/academy/AcademyTopBar";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import LevelNavPanel from "@/components/academy/LevelNavPanel";
import HomepageSettingsButton from "@/components/homepage/HomepageSettingsButton";
import { useAccount } from "@/lib/accounts/useAccount";

const Index = () => {
  const { role } = useAccount();
  // Students never teach — their primary entry point is joining a teacher's class.
  const isStudent = role === "student";

  return (
    <>
      <AcademyTopBar />
      <RotatingAdventureScene />
      <HomepageSettingsButton />
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
      {isStudent ? (
        <Link
          to="/join"
          aria-label="Join a class"
          className="fixed bottom-20 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-background/70 px-4 py-2 text-sm font-medium text-amber-200 shadow-[0_0_24px_hsl(40_90%_60%/0.3)] backdrop-blur transition hover:bg-amber-500/20"
        >
          <Users className="h-4 w-4" />
          Join Class
        </Link>
      ) : (
        <Link
          to="/teaching-hub"
          aria-label="Open Teaching Hub"
          className="fixed bottom-20 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-background/70 px-4 py-2 text-sm font-medium text-amber-200 shadow-[0_0_24px_hsl(40_90%_60%/0.3)] backdrop-blur transition hover:bg-amber-500/20"
        >
          <GraduationCap className="h-4 w-4" />
          Teaching Hub
        </Link>
      )}
    </>
  );
};

export default Index;

