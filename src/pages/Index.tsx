import { Link } from "@/lib/router-compat";
import { GraduationCap, Globe2, Image, Package, ShieldCheck, Users } from "lucide-react";

import AcademyTopBar from "@/components/academy/AcademyTopBar";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import LevelNavPanel from "@/components/academy/LevelNavPanel";
import HomepageSettingsButton from "@/components/homepage/HomepageSettingsButton";
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

const Index = () => {
  const { role, roles, isPlatformOwner } = useAccount();
  const { isPersonal, workspaces } = useWorkspace();
  // The building belongs to the workspace you are in: your own when personal,
  // otherwise the one owned by the workspace you are visiting.
  const visiting = workspaces.length > 0 && !isPersonal;
  // Anything other than a plain student account keeps the full homepage: the
  // owner, school admins and teachers must never be locked into the student view.
  const elevated = isPlatformOwner || roles.some((r) => r !== "student");
  // Students never teach — their primary entry point is joining a teacher's class.
  const isStudent = role === "student" && !elevated;


  // The student Academy page is view-only: the school's background + rotating
  // building, and one way in. No search, account menu, settings or tools.
  if (isStudent) {
    return (
      <>
        <RotatingAdventureScene interactive={false} configMode="school-readonly" />
        <Link
          to="/student"
          aria-label="Open my dashboard"
          className="fixed bottom-10 left-1/2 z-50 inline-flex min-h-[52px] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300/60 bg-background/80 px-8 py-3 text-base font-semibold text-amber-200 shadow-[0_0_32px_hsl(40_90%_60%/0.35)] backdrop-blur transition hover:bg-amber-500/25"
        >
          <Users className="h-5 w-5" />
          My Dashboard
        </Link>
      </>
    );
  }


  return (
    <>
      <AcademyTopBar />
      <RotatingAdventureScene configMode={visiting ? "school-readonly" : "self"} />
      {!visiting && <HomepageSettingsButton />}
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
      {/* Every account type enters the shared creator ecosystem from here. */}
      <Link
        to="/community"
        aria-label="Open MathGPL Community"
        className="fixed bottom-35 right-5 z-50 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-300/50 bg-background/70 px-4 py-2 text-sm font-medium text-sky-200 shadow-[0_0_24px_hsl(205_90%_60%/0.3)] backdrop-blur transition hover:bg-sky-500/20"
      >
        <Globe2 className="h-4 w-4" />
        MathGPL Community
      </Link>
      <Link
        to={role === "school" ? "/school" : "/teaching-hub"}
        aria-label={role === "school" ? "Open School Console" : "Open Teaching Hub"}
        className="fixed bottom-20 right-5 z-50 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-300/50 bg-background/70 px-4 py-2 text-sm font-medium text-amber-200 shadow-[0_0_24px_hsl(40_90%_60%/0.3)] backdrop-blur transition hover:bg-amber-500/20"
      >
        <GraduationCap className="h-4 w-4" />
        {role === "school" ? "School Console" : "Teaching Hub"}
      </Link>
      {isPlatformOwner && (
        <Link
          to="/admin"
          aria-label="Open Platform Console"
          className="fixed bottom-50 right-5 z-50 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-400/60 bg-background/70 px-4 py-2 text-sm font-medium text-amber-100 shadow-[0_0_24px_hsl(45_90%_60%/0.35)] backdrop-blur transition hover:bg-amber-500/25"
        >
          <ShieldCheck className="h-4 w-4" />
          Platform Console
        </Link>
      )}


    </>
  );
};

export default Index;

