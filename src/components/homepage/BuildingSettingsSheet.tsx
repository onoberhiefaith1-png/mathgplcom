/**
 * BUILDING SETTINGS — the settings of the ONE building currently selected.
 *
 * This never chooses a building; choosing happens in the selector behind it.
 * Outside and inside stay separate: Change Background and Edit Building change
 * this building's face, while the inside (hallways, rooms, doors, windows,
 * objects) is edited only after entering the building. Building Advertisement is
 * administrator-only.
 */
import { Link } from "@/lib/router-compat";
import { Image as ImageIcon, Building2, Megaphone, DoorOpen, Share2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingId: string;
  buildingName: string;
  /** Administrators only: the advertisement billboard of the Free building. */
  canManageAds: boolean;
  /** Own buildings can be offered to the Community; masters and copies cannot. */
  canShare: boolean;
  onShare: () => void;
}

const rowClass =
  "flex w-full items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-4 text-left transition hover:bg-muted/40";

const BuildingSettingsSheet = ({
  open,
  onOpenChange,
  buildingId,
  buildingName,
  canManageAds,
  canShare,
  onShare,
}: Props) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{buildingName}</SheetTitle>
        <SheetDescription>
          Everything here changes this building only. Your other buildings are untouched.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-3">
        <Link
          to={`/homepage/background?building=${buildingId}`}
          className={rowClass}
          onClick={() => onOpenChange(false)}
        >
          <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold">Change Background</span>
            <span className="block text-xs text-muted-foreground">
              The scene behind this building. The building itself never moves.
            </span>
          </span>
        </Link>

        <Link
          to={`/homepage/building?building=${buildingId}`}
          className={rowClass}
          onClick={() => onOpenChange(false)}
        >
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold">Edit Building</span>
            <span className="block text-xs text-muted-foreground">
              The outside of this building: outer picture, inner picture, generate, and each
              picture on its own.
            </span>
          </span>
        </Link>

        <Link to="/academy/edit" className={rowClass} onClick={() => onOpenChange(false)}>
          <DoorOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-semibold">Go inside and edit</span>
            <span className="block text-xs text-muted-foreground">
              Hallways, rooms, doors, windows and objects — the inside of the building you are
              using.
            </span>
          </span>
        </Link>

        {canShare && (
          <button type="button" className={rowClass} onClick={onShare}>
            <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold">Share to Community</span>
              <span className="block text-xs text-muted-foreground">
                Your buildings stay private until you choose to share one.
              </span>
            </span>
          </button>
        )}

        {canManageAds && (
          <Link
            to="/homepage/advertisements"
            className={rowClass}
            onClick={() => onOpenChange(false)}
          >
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-sm font-semibold">Building Advertisement</span>
              <span className="block text-xs text-muted-foreground">
                Administrators only — the billboard on the public building.
              </span>
            </span>
          </Link>
        )}
      </div>
    </SheetContent>
  </Sheet>
);

export default BuildingSettingsSheet;
