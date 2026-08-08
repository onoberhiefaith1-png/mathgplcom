import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type PublicTeacher = { org_id: string; user_id: string; display_name: string; org_name: string };

/**
 * Community teacher search for schools. Only teachers who made their workspace
 * public appear here; private teachers keep full Community access, they are
 * simply not listed. Inviting sends a request — it never joins anyone.
 */
const CommunityTeacherSearch = ({ orgId }: { orgId: string | null }) => {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  const results = useQuery({
    queryKey: ["public-teachers", query],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_public_teachers", { _q: query });
      if (error) throw error;
      return (data ?? []) as PublicTeacher[];
    },
    enabled: query.length > 0,
  });

  const invite = useMutation({
    mutationFn: async (userId: string) => {
      if (!orgId) throw new Error("No school workspace is active.");
      const { error } = await supabase.rpc("invite_teacher_by_user", { _org_id: orgId, _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () =>
      toast({ title: "Invitation sent", description: "The teacher can accept or decline it from their workspace." }),
    onError: (error) =>
      toast({ title: "Could not invite", description: (error as Error).message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <div>
        <p className="text-sm font-semibold">Find a teacher in Community</p>
        <p className="text-xs text-muted-foreground">
          Search teachers who chose to be discoverable, then invite them to your school.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term.trim());
        }}
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Teacher or workspace name"
          className="italic placeholder:italic"
        />
        <Button type="submit" variant="outline">
          <Search className="mr-1 h-4 w-4" /> Search
        </Button>
      </form>

      {results.isFetching && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
        </p>
      )}

      {query && !results.isFetching && (results.data ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">No discoverable teachers matched that search.</p>
      )}

      <ul className="space-y-2">
        {(results.data ?? []).map((t) => (
          <li key={t.org_id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">{t.org_name}</p>
            </div>
            <Button
              size="sm"
              className="ml-auto"
              disabled={invite.isPending || !orgId}
              onClick={() => invite.mutate(t.user_id)}
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" /> Invite
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CommunityTeacherSearch;
