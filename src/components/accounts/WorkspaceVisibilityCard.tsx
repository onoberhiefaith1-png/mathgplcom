import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/lib/accounts/useWorkspace";

/**
 * Discoverability of the active workspace. Private is not restricted access —
 * a private workspace still uses Community fully, it just isn't listed.
 */
const WorkspaceVisibilityCard = () => {
  const qc = useQueryClient();
  const { active } = useWorkspace();

  const setVisibility = useMutation({
    mutationFn: async (visibility: "public" | "private") => {
      if (!active) throw new Error("No workspace is active.");
      const { error } = await supabase.rpc("set_workspace_visibility", {
        _org_id: active.orgId,
        _visibility: visibility,
      });
      if (error) throw error;
      return visibility;
    },
    onSuccess: async (visibility) => {
      toast({
        title: visibility === "public" ? "Workspace is discoverable" : "Workspace is private",
        description:
          visibility === "public"
            ? "Schools and teachers can find you in Community."
            : "You keep full Community access — you are simply not listed.",
      });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error) =>
      toast({ title: "Could not update", description: (error as Error).message, variant: "destructive" }),
  });

  if (!active?.isOwner) return null;
  const isPublic = active.visibility === "public";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/40 p-4">
      {isPublic ? <Globe2 className="h-4 w-4 text-sky-300" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{isPublic ? "Listed in Community" : "Not listed in Community"}</p>
        <p className="text-xs text-muted-foreground">
          {isPublic
            ? "Schools can find and invite you from Community."
            : "You can still browse and copy from Community."}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={setVisibility.isPending}
        onClick={() => setVisibility.mutate(isPublic ? "private" : "public")}
      >
        {isPublic ? "Make private" : "Make discoverable"}
      </Button>
    </div>
  );
};

export default WorkspaceVisibilityCard;
