import { useState } from "react";
import { Link } from "@/lib/router-compat";
import {
  Building2,
  Image as ImageIcon,
  LibraryBig,
  Megaphone,
  Save,
  Settings2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAccount } from "@/lib/accounts/useAccount";
import { useWorkspace } from "@/lib/accounts/useWorkspace";
import { useBuildingContext } from "@/lib/homepage/useBuildingContext";
import SaveBuildingDialog from "./SaveBuildingDialog";

const OPTIONS = [
  {
    to: "/homepage/background",
    icon: ImageIcon,
    title: "Change Background",
    body: "Swap the scene behind the building for an image, animated image or looping video. The building never moves.",
  },
  {
    to: "/homepage/building",
    icon: Building2,
    title: "Edit MathGPL Building",
    body: "Change the pictures inside the original MathGPL building and set how fast it rotates. Position, curve, perspective and size stay exactly as designed.",
  },
  {
    to: "/buildings",
    icon: LibraryBig,
    title: "Building",
    body: "Your collection of complete buildings, shown one at a time. Each one arrives whole — outside, hallways, rooms, windows and screens together — and you choose which one to use.",
  },
];


/** Gear on the Homepage opening the three independent customization workflows. */
const HomepageSettingsButton = () => {
  const { userId, role, isPlatformOwner } = useAccount();
  const { workspaces, isPersonal } = useWorkspace();
  // Free accounts see the platform-owned advertising building; it is not theirs
  // to change, so no background / edit / replace controls are offered at all.
  const { canCustomize, canManageAds } = useBuildingContext();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  // Signed-out visitors always see the default homepage.
  if (!userId) return null;
  // A member visiting a school workspace sees the building its owner set — only
  // the owner can change it. Students are read-only unless the building context
  // has already granted them their own (full-access account, personal homepage).
  if (role === "student" && !isPlatformOwner && !canCustomize) return null;
  if (workspaces.length > 0 && !isPersonal && !isPlatformOwner) return null;
  if (!canCustomize && !canManageAds) return null;


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Homepage customization"
          className="fixed right-5 top-20 z-50 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/70 px-4 py-2 text-sm font-medium text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
        >
          <Settings2 className="h-4 w-4" />
          Settings
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Homepage Customization</SheetTitle>
          <SheetDescription>
            Three separate features. Each one changes only its own layer.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {(canManageAds
            ? [
                ...(canCustomize ? OPTIONS : []),
                {
                  to: "/admin/advertisements",
                  icon: Megaphone,
                  title: "Building Advertisements",
                  body: "The eight advertisement slots that play on the Free building's billboard and in Community. Nowhere else in the app shows ads.",
                },
              ]
            : OPTIONS
          ).map((opt) => (
            <Link
              key={opt.to}
              to={opt.to}
              onClick={() => setOpen(false)}
              className="block rounded-xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/60 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <opt.icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{opt.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{opt.body}</p>
            </Link>
          ))}

          {canCustomize && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSaveOpen(true);
              }}
              className="block w-full rounded-xl border border-primary/50 bg-primary/5 p-4 text-left transition hover:border-primary hover:bg-primary/10"
            >
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Save Building</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep this building as a new one in the Building Gallery — the outside together with
                every room, hallway, window and screen inside it. Buildings you saved before stay
                exactly as they are.
              </p>
            </button>
          )}
        </div>
      </SheetContent>

      <SaveBuildingDialog open={saveOpen} onOpenChange={setSaveOpen} defaultName="My Building" />
    </Sheet>
  );
};

export default HomepageSettingsButton;
