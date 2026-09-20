import { useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { DoorOpen, GraduationCap, Globe2, Image, LogOut, Package, ShieldCheck, Users } from "lucide-react";

import AcademyTopBar from "@/components/academy/AcademyTopBar";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import LevelNavPanel from "@/components/academy/LevelNavPanel";
import HomepageSettingsButton from "@/components/homepage/HomepageSettingsButton";
import LegalLinkStrip from "@/components/common/LegalLinkStrip";
import { useAccount } from "@/lib/accounts/useAccount";
import { WORKSPACE_LABEL, WORKSPACE_PATH } from "@/lib/accounts/roles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignOut } from "@/lib/auth/signOutEverywhere";
import PlanInviteBanner from "@/components/plans/PlanInviteBanner";
import { useBuildingContext } from "@/lib/homepage/useBuildingContext";
import { supabase } from "@/integrations/supabase/client";



const Index = () => {
  const { role, roles, isPlatformOwner } = useAccount();

  const navigate = useNavigate();
  const signOutEverywhere = useSignOut();
  const { user, ready } = useAuth();
  // Anything other than a plain student account keeps the full homepage: the
  // owner, school admins and teachers must never be locked into the student view.
  const elevated = isPlatformOwner || roles.some((r) => r !== "student");
  // Students never teach — their primary entry point is joining a teacher's class.
  const isStudent = role === "student" && !elevated;

  // Central pipeline decides WHICH building and whether ads play on it.
  // Platform owner only: flip the building on screen between the real Pro
  // building and the Free advertising building. Preview only.
  const [preview, setPreview] = useState<"pro" | "free">("pro");
  const building = useBuildingContext(
    isPlatformOwner ? { previewVersion: preview } : undefined,
  );


  const handleSignOut = async () => {
    // Leaving means leaving: land on the sign-in page, not a signed-out home.
    await signOutEverywhere();
  };





  // The student Academy page is view-only: the school's background + rotating
  // building, and one way in. No search, account menu, settings or tools.
  if (isStudent) {
    return (
      <>
        <RotatingAdventureScene
          interactive={false}
          configMode={building.configMode}
          showAds={building.adsEnabled}
        />
        {/* Students step into the shared Academy world from the building itself. */}
        <Link
          to="/academy"
          aria-label="Enter the Academy"
          className="fixed bottom-26 left-1/2 z-50 inline-flex min-h-[48px] -translate-x-1/2 items-center gap-2 rounded-full border border-sky-300/60 bg-background/80 px-7 py-3 text-sm font-semibold text-sky-200 shadow-[0_0_28px_hsl(205_90%_60%/0.35)] backdrop-blur transition hover:bg-sky-500/25"
        >
          <DoorOpen className="h-5 w-5" />
          Enter the Academy
        </Link>

        {ready && user && (
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="fixed top-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-rose-400/60 bg-background/70 px-4 py-2 text-sm font-medium text-rose-200 shadow-lg backdrop-blur transition hover:border-rose-400 hover:bg-rose-500/20"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        )}
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
      {/*
        The building stays exactly as it is — the artwork, rotation and slots are
        untouched. Clicking a designated building area now walks the visitor into
        the one shared Academy world instead of jumping straight to a subject.
      */}
      <RotatingAdventureScene
        configMode={building.configMode}
        showAds={building.adsEnabled}
        routeFor={() => "/academy"}
      />
      {building.canCustomize && <HomepageSettingsButton />}

      {/* Everything except the dashboard door lives at the top of the screen. */}
      <div className="fixed left-4 top-4 z-50 flex flex-col items-start gap-2 sm:left-6 sm:top-6">
        {isPlatformOwner && (
          <div className="flex items-center gap-1 rounded-full border border-primary/40 bg-background/70 p-1 text-xs font-semibold backdrop-blur">
            <span className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Building
            </span>
            {(["pro", "free"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPreview(v)}
                aria-pressed={preview === v}
                className={
                  preview === v
                    ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                    : "rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
                }
              >
                {v === "pro" ? "Pro" : "Free"}
              </button>
            ))}
          </div>
        )}
        {/* Same door for every account type — one shared Academy world. */}
        <Link
          to="/academy"
          aria-label="Enter the Academy"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-300/60 bg-background/80 px-5 py-2 text-sm font-semibold text-sky-200 shadow-[0_0_28px_hsl(205_90%_60%/0.35)] backdrop-blur transition hover:bg-sky-500/25"
        >
          <DoorOpen className="h-5 w-5" />
          Enter the Academy
        </Link>
      </div>

      {/*
        One pronounced entry, driven only by the stored account type. There is no
        fallback destination: an administrator never lands in the Teaching Hub.
      */}
      {role && <DashboardEntryCard role={role} to={WORKSPACE_PATH[role]} />}

      <PlanInviteBanner />
      <LegalLinkStrip />

    </>
  );
};

export default Index;

