import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@/lib/accounts/useAccount";
import {
  applyBuildingAsset,
  deleteBuildingAsset,
  ensureCurrentBuildingsRegistered,
  listBuildingAssets,
  renameBuildingAsset,
  type BuildingAssetRow,
} from "@/lib/homepage/buildingAssets";

/**
 * Buildings shelf: every saved homepage building, newest first. A row can be
 * renamed, deleted, or applied back onto the Pro (or platform Free) building —
 * applying restores that exact configuration, artwork and rotation included.
 */
const BuildingsShelf = () => {
  const { toast } = useToast();
  const { isPlatformOwner } = useAccount();
  const [rows, setRows] = useState<BuildingAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setRows(await listBuildingAssets());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ensureCurrentBuildingsRegistered({ includeFree: isPlatformOwner });
      } catch (e) {
        console.error(e);
      }
      if (alive) await refresh();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformOwner]);

  const apply = async (row: BuildingAssetRow, target: "pro" | "free") => {
    setBusyId(row.id);
    try {
      await applyBuildingAsset(row, target);
      toast({
        title: target === "free" ? "Applied to Free Building" : "Applied to Pro Building",
        description: row.name,
      });
    } catch (e) {
      toast({
        title: "Could not apply",
        description: String((e as Error).message),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: BuildingAssetRow) => {
    try {
      await deleteBuildingAsset(row.id);
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e) {
      console.error(e);
    }
  };

  const rename = async (row: BuildingAssetRow, name: string) => {
    const next = name.trim();
    if (!next || next === row.name) return;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, name: next } : x)));
    try {
      await renameBuildingAsset(row.id, next);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Save a building and it lands here automatically.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-border/50 bg-background/40 p-2.5">
          <div className="flex items-center gap-2">
            {row.version === "free" ? (
              <Megaphone className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
            )}
            <Input
              defaultValue={row.name}
              onBlur={(e) => void rename(row, e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
            {row.version === "free" ? "Free building" : "Pro building"} ·{" "}
            {new Date(row.created_at).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[11px]"
              disabled={busyId === row.id}
              onClick={() => void apply(row, "pro")}
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Apply to Pro
            </Button>
            {isPlatformOwner && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[11px]"
                disabled={busyId === row.id}
                onClick={() => void apply(row, "free")}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Apply to Free
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => void remove(row)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BuildingsShelf;
