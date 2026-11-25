/**
 * Loads the signed-in teacher's own games and saves the question's game link.
 * Hidden for students and for questions that are not Floating Numbers.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AddQuestionGameControl,
  type AddGameChoice,
} from "@/components/academia/AddQuestionGameControl";
import {
  gameCover,
  questionAcceptsGameLink,
  selectableQuestionGames,
} from "@/lib/academia/questionGameRules";

export default function AddQuestionGameButton({
  activityId,
  variant = "toolbar",
}: {
  activityId: string;
  /** menu sits on the question card. toolbar stays on the Smartboard. */
  variant?: "toolbar" | "menu";
}) {
  const queryClient = useQueryClient();
  const [eligible, setEligible] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [games, setGames] = useState<AddGameChoice[] | null>(null);
  const [gamesStatus, setGamesStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    let alive = true;
    setEligible(false);
    setCanEdit(false);
    void import("@/lib/academia/questionGameLink")
      .then(({ loadQuestionGameAccess }) => loadQuestionGameAccess(activityId))
      .then((access) => {
        if (!alive || !access) return;
        setEligible(questionAcceptsGameLink(access.activity));
        setCanEdit(access.canEdit);
        setCurrentGameId(access.activity.gameId);
      })
      .catch(() => {
        if (alive) setEligible(false);
      });
    return () => {
      alive = false;
    };
  }, [activityId]);

  const request = useRef(0);
  const onReloadGames = useCallback(() => {
    const id = ++request.current;
    setGamesStatus("loading");
    void Promise.all([
      import("@/integrations/supabase/client"),
      import("@/lib/slate/surfaces"),
    ])
      .then(async ([{ supabase }, { getSurface }]) => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id ?? "";
        const { data, error } = await supabase
          .from("slate_games")
          .select("id, name, surface_id, background, owner_id, library")
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (request.current !== id) return;
        const visible = selectableQuestionGames(
          ((data ?? []) as {
            id: string;
            name: string | null;
            surface_id: string;
            background: { src?: string | null } | null;
            owner_id: string | null;
            library: boolean | null;
          }[]).map((row) => ({
            ...row,
            ownerId: row.owner_id,
            library: row.library,
          })),
          userId,
        );
        setGames(
          visible.map((game) => {
            const surface = getSurface(game.surface_id);
            return {
              id: game.id,
              name: game.name || "Game",
              surface: game.library
                ? `${surface.label} · Template`
                : surface.label,
              preview: gameCover({
                backgroundSrc: game.background?.src,
                surfaceTexture: surface.texture,
              }),
            };
          }),
        );
        setGamesStatus("ready");
      })
      .catch(() => {
        if (request.current !== id) return;
        setGamesStatus("error");
      });
  }, []);

  return (
    <AddQuestionGameControl
      eligible={eligible}
      canEdit={canEdit}
      variant={variant}
      currentGameId={currentGameId}
      games={games}
      gamesStatus={gamesStatus}
      onReloadGames={onReloadGames}
      onSave={async (gameId) => {
        const { linkActivityGame } =
          await import("@/lib/academia/questionGameLink");
        const result = await linkActivityGame(activityId, gameId);
        setCurrentGameId(result.gameId);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["academia-activity", activityId],
          }),
          queryClient.invalidateQueries({ queryKey: ["academia-session"] }),
        ]);
        toast.success(
          result.changed
            ? result.previousGameId
              ? "Game changed. Play now uses this game."
              : "Game added. Play is ready for this question."
            : "This question already uses that game.",
        );
      }}
    />
  );
}
