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
} from "@/lib/academia/questionGameRules";

export default function AddQuestionGameButton({
  activityId,
}: {
  activityId: string;
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
      import("@/lib/slate/storage"),
      import("@/lib/slate/surfaces"),
    ])
      .then(async ([{ listGames }, { getSurface }]) => {
        const rows = await listGames();
        if (request.current !== id) return;
        setGames(
          rows.map((game) => {
            const surface = getSurface(game.surfaceId);
            return {
              id: game.id,
              name: game.name || "Game",
              surface: surface.label,
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
