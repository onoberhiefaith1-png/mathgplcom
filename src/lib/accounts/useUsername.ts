import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

/** What a username is allowed to be — the same rule the database enforces. */
export const USERNAME_RULE = "3–20 letters, numbers or underscores.";
export const usernameIsValid = (value: string) => /^[A-Za-z0-9_]{3,20}$/.test(value.trim());

/**
 * The public username.
 *
 * The registered name is the account's real identity and never changes here.
 * The username is what other people see in the Community, in a code lookup and
 * on a request — the permanent MathGPL ID stays private.
 */
export const useUsername = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["username", user?.id ?? "anon"],
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.username ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (username: string) => {
      const { data, error } = await supabase.rpc("set_my_username", { _username: username.trim() });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["username"] });
      queryClient.invalidateQueries({ queryKey: ["discover"] });
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  return {
    username: query.data ?? null,
    loading: query.isLoading,
    save: save.mutateAsync,
    saving: save.isPending,
  };
};

/** Turns a database error from `set_my_username` into a sentence. */
export const usernameError = (message: string): string =>
  /username_taken/.test(message)
    ? "That username is already taken. Try another one."
    : /username_invalid/.test(message)
      ? `Use ${USERNAME_RULE}`
      : message;
