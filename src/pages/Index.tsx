import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { DoorOpen, LogOut } from "lucide-react";

import AcademyTopBar from "@/components/academy/AcademyTopBar";
import { RotatingAdventureScene } from "@/components/adventure/RotatingAdventureScene";
import DashboardEntryCard from "@/components/homepage/DashboardEntryCard";
import HomepageSettingsButton from "@/components/homepage/HomepageSettingsButton";
import { ThemeModeButton } from "@/components/theme/ThemeModeButton";
import LegalLinkStrip from "@/components/common/LegalLinkStrip";
import { useAccount } from "@/lib/accounts/useAccount";
import { WORKSPACE_PATH } from "@/lib/accounts/roles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSignOut } from "@/lib/auth/signOutEverywhere";
import PlanInviteBanner from "@/components/plans/PlanInviteBanner";
import { useBuildingContext } from "@/lib/homepage/useBuildingContext";
import { useResolvedBuilding } from "@/lib/homepage/useResolvedBuilding";
import { MATHEMAGINE_APP_LOGIN as LOGIN_BACK_TO_APP } from "@/lib/install/mathemagineApp";



const Index = () => {
  const { role, roles, isPlatformOwner } = useAccount();

  const signOutEverywhere = useSignOut();
  const { user, ready } = useAuth();
  // The installed Mathemagine app opens here even when nobody is signed in yet:
  // the platform's public building (the same one Community shows, with its
  // advertisement billboard), read-only, with Login at the top right.
  const signedOut = ready && !user;

  // The admin toggle only changes which platform selection this screen shows.
  // Choosing a building (Pro or Free) is what other people then see.
  const [preview, setPreview] = useState<"pro" | "free">("pro");
  const building = useBuildingContext(
    isPlatformOwner ? { previewVersion: preview } : undefined,
  );
  // The face is the live selection. Signed-out visitors get the public Free
  // building. An admin preview only changes this screen.
  const resolved = useResolvedBuilding({
    publicFree: signedOut,
    adminPreview: signedOut ? null : preview,
  });
  const configMode = signedOut ? "platform-free" : building.configMode;
  const showAds = signedOut ? true : resolved.adsEnabled;
  // Anything other than a plain student account keeps the full homepage.
  // A linked admin account is an admin even when its role is student.
  const elevated = isPlatformOwner || resolved.isAdmin || roles.some((r) => r !== "student");
  const isStudent = role === "student" && !elevated;
  const scene = {
    authoritative: true as const,
    configReady: resolved.ready,
    configOverride: resolved.config,
    artworkVersion: resolved.slotVersion,
    configMode,
    showAds,
  };


  const handleSignOut = async () => {
    // Leaving means leaving: land on the sign-in page, not a signed-out home.
    await signOutEverywhere();
  };





  // The student Academy page is view-only: the school's background + rotating
  // building, and one way in. No search, account menu, settings or tools.
  if (isStudent) {
    return (
      <>
        <RotatingAdventureScene interactive={false} {...scene} />
        {/* Students step into the shared Academy world from the building itself. */}
        <Link
          to="/academy"
          aria-label="Enter the Academy"
          className="hub-chrome fixed left-4 top-4 z-50 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-300/60 bg-background/80 px-5 py-2 text-sm font-semibold text-sky-200 shadow-[0_0_28px_hsl(205_90%_60%/0.35)] backdrop-blur transition hover:bg-sky-500/25 sm:left-6 sm:top-6"
        >
          <DoorOpen className="h-5 w-5" />
          Enter the Academy
        </Link>

        {ready && user && (
          <div className="fixed right-16 top-5 z-50 flex items-center gap-2">
            <ThemeModeButton scope="app" variant="hub" />
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="hub-chrome inline-flex items-center gap-2 rounded-full border border-rose-400/60 bg-background/70 px-4 py-2 text-sm font-medium text-rose-200 shadow-lg backdrop-blur transition hover:border-rose-400 hover:bg-rose-500/20"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}
        <DashboardEntryCard role="student" to="/student" />
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
        {...scene}
        routeFor={() => (signedOut ? LOGIN_BACK_TO_APP : "/academy")}
      />

      {/* Everything except the dashboard door lives at the top of the screen. */}
      <div className="fixed left-4 top-4 z-50 flex flex-col items-start gap-2 sm:left-6 sm:top-6">
        {resolved.isAdmin && (
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
        {!signedOut && resolved.canChange && <HomepageSettingsButton />}
        {/* Same door for every account type — one shared Academy world. */}
        <Link
          to={signedOut ? LOGIN_BACK_TO_APP : "/academy"}
          aria-label="Enter the Academy"
          className="hub-chrome inline-flex min-h-[44px] items-center gap-2 rounded-full border border-sky-300/60 bg-background/80 px-5 py-2 text-sm font-semibold text-sky-200 shadow-[0_0_28px_hsl(205_90%_60%/0.35)] backdrop-blur transition hover:bg-sky-500/25"
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

      {!signedOut && <PlanInviteBanner />}
      <LegalLinkStrip />

    </>
  );
};

export default Index;

