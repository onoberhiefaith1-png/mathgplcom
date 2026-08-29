import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BroadcastEditor from "@/components/live/BroadcastEditor";
import type { BroadcastEntry } from "@/lib/live/broadcast";
import type { VenueKind } from "@/lib/schedule/venue";

const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

/**
 * Location / Platform for a Class: online (the existing Live platforms) or a
 * physical Classroom with an address and room details.
 */
const VenueEditor = ({
  kind,
  broadcasts,
  address,
  details,
  onKindChange,
  onBroadcastsChange,
  onAddressChange,
  onDetailsChange,
}: {
  kind: VenueKind;
  broadcasts: BroadcastEntry[];
  address: string;
  details: string;
  onKindChange: (kind: VenueKind) => void;
  onBroadcastsChange: (next: BroadcastEntry[]) => void;
  onAddressChange: (value: string) => void;
  onDetailsChange: (value: string) => void;
}) => (
  <div className="space-y-3">
    <div>
      <Label>Location / Platform</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        Is this class taught online or in a physical classroom?
      </p>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {([
        { value: "online", title: "Online", hint: "Zoom, Google Meet, WhatsApp, YouTube…" },
        { value: "classroom", title: "Classroom", hint: "A physical room students walk into." },
      ] as const).map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onKindChange(opt.value)}
          className={`rounded-xl border p-3 text-left transition ${
            kind === opt.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
          }`}
        >
          <div className="text-sm font-semibold">{opt.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{opt.hint}</div>
        </button>
      ))}
    </div>

    {kind === "online" ? (
      <BroadcastEditor value={broadcasts} onChange={onBroadcastsChange} />
    ) : (
      <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
        <div className="space-y-2">
          <Label htmlFor="venue-address">Classroom Address</Label>
          <Input
            id="venue-address"
            className={FIELD}
            placeholder="24 Main Street, London"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue-details">Classroom Details</Label>
          <Textarea
            id="venue-details"
            className={FIELD}
            placeholder="Room 204, second floor."
            rows={2}
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
          />
        </div>
      </div>
    )}
  </div>
);

export default VenueEditor;
