import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Invitation = {
  id: string;
  org_id: string;
  org_name: string;
  invited_by_name: string;
};

/**
 * Pending school invitations for the signed-in teacher. Nothing is ever joined
 * automatically — a relationship only exists once it is accepted here.
 */
const WorkspaceInvitations = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["my-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_pending_invitations");
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
    staleTime: 60 * 1000,
  });

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_to_teacher_invitation", {
        _invitation_id: id,
        _accept: accept,
      });
      if (error) throw error;
      return accept;
    },
    onSuccess: async (accepted) => {
      toast({
        title: accepted ? "Invitation accepted" : "Invitation declined",
        description: accepted
          ? "The school workspace is now available in your workspace switcher."
          : "Nothing was shared with the school.",
      });
      await qc.invalidateQueries();
    },
    onError: (error) =>
      toast({ title: "Could not respond", description: (error as Error).message, variant: "destructive" }),
  });

  const invitations = query.data ?? [];
  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3"
        >
          <Building2 className="h-4 w-4 text-amber-300" />
          <p className="text-sm">
            <span className="font-semibold">{inv.invited_by_name}</span> has invited you to join{" "}
            <span className="font-semibold">{inv.org_name}</span>.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: inv.id, accept: true })}
            >
              {respond.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: inv.id, accept: false })}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkspaceInvitations;
