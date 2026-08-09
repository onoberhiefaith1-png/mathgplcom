import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { Building2, Image as ImageIcon, Replace, Settings2 } from "lucide-react";
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
    body: "Replace individual artwork inside the original MathGPL building. Position, curve, perspective and size stay exactly as designed.",
  },
  {
    to: "/homepage/replace-building",
    icon: Replace,
    title: "Replace Building",
    body: "Upload a whole new building, position and preview it in the visual editor, then apply it to your homepage.",
  },
];

/** Gear on the Homepage opening the three independent customization workflows. */
const HomepageSettingsButton = () => {
  const { userId, role } = useAccount();
  const { workspaces, isPersonal } = useWorkspace();
  const [open, setOpen] = useState(false);

  // Signed-out visitors always see the default homepage.
  if (!userId) return null;
  // Students never own a building, and a member visiting a school workspace
  // sees the building its owner set — only the owner can change it.
  if (role === "student") return null;
  if (workspaces.length > 0 && !isPersonal) return null;

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
          {OPTIONS.map((opt) => (
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
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HomepageSettingsButton;
