// The assistant's hands on the real 3D Slate Game.
//
// Every executor here runs the app's own game code (src/lib/slate/*), lent the
// teacher's authenticated client through withDb, so a game Aura builds is the
// same record the editor opens and plays. No second game engine, no second
// normaliser, and nothing invented: only settings the app really has.

import type { SupabaseClient } from "@supabase/supabase-js";

import { withDb } from "@/lib/db/scope";
import { listGames, loadGame, saveGameResult } from "@/lib/slate/storage";
import { makeGame, makeSlot, uid } from "@/lib/slate/defaults";
import { ROOMS, NO_ROOM_ID, roomForSurface, getRoom } from "@/lib/slate/rooms";
import { REWARDS, PLACEABLE_REWARDS } from "@/lib/slate/rewards";
import { normalizeConversion } from "@/lib/slate/conversion";
import {
  assignQuestion,
  listGameQuestions,
  removeQuestion,
  reorderQuestions,
} from "@/lib/slate/gameQuestions";
import { assignGameToClass, listGameClasses } from "@/lib/slate/gameAssignments";
import type { Game, RewardInstance } from "@/lib/slate/types";

type AnyDb = { from: (table: string) => any };
type Ctx = { supabase: SupabaseClient<never, "public", never>; userId: string };
type Args = Record<string, unknown>;

const str = (args: Args, key: string): string | undefined => {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
const need = (args: Args, key: string): string => {
  const v = str(args, key);
  if (!v) throw new Error(`Missing required argument "${key}".`);
  return v;
};
const numOr = (args: Args, key: string, fallback: number): number => {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};
const maybeNum = (args: Args, key: string): number | undefined => {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};
const strList = (args: Args, key: string): string[] => {
  const v = args[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
};

/** One place where a game is fetched, so every write reads its own result back. */
async function readGame(ctx: Ctx, gameId: string): Promise<Game> {
  const game = await withDb(ctx.supabase, () => loadGame(gameId));
  if (!game) throw new Error("That game was not found in this workspace.");
  return game;
}

async function writeGame(ctx: Ctx, game: Game): Promise<Game> {
  const result = await withDb(ctx.supabase, () => saveGameResult(game));
  if (!result.ok) throw new Error(result.message ?? "The game could not be saved.");
  const after = await readGame(ctx, game.id);
  return after;
}

/** What the teacher would see if they opened this game: the saved truth. */
function describeGame(game: Game, questionCount: number, totalMarks: number) {
  const room = getRoom(game.roomId);
  return {
    gameId: game.id,
    name: game.name,
    topic: game.topic,
    subtopic: game.subtopic,
    room: room ? { id: room.id, label: room.label } : { id: NO_ROOM_ID, label: "None (background only)" },
    surfaceId: game.surfaceId,
    writingSurfaces: game.slots.length,
    patternLength: game.patternLength,
    questionCount,
    totalMarks,
    rewards: {
      visible: game.settings.rewards.visible,
      opacity: game.settings.rewards.opacity,
      glow: game.settings.rewards.glow,
      scale: game.settings.rewards.scale,
      placed: game.slots.map((slot, index) => ({
        line: index + 1,
        types: slot.rewards.map((r) => r.type),
      })),
    },
    lifeMultiplier: game.settings.life.multiplier,
    conversion: game.settings.conversion,
    background: {
      kind: game.background.kind,
      hasImage: Boolean(game.background.src || game.background.assetId),
    },
    savedAt: new Date(game.updatedAt).toISOString(),
    editorPath: `/game/${game.id}`,
  };
}

type Executor = (
  ctx: Ctx,
  args: Args,
) => Promise<{ data: unknown; summary: string; navigateTo?: string }>;

export const slateGameExecutors: Record<string, Executor> = {
  slate_list_rooms: async () => {
    const rooms = [
      ...ROOMS.map((r) => ({ id: r.id, label: r.label, surfaceId: r.surfaceId })),
      { id: NO_ROOM_ID, label: "None (background only)", surfaceId: "plain" },
    ];
    return {
      data: { rooms, note: "These are the only rooms the Game has. Never offer another." },
      summary: `${rooms.length} rooms a Game can be built in.`,
    };
  },

  slate_list_rewards: async () => {
    const catalogue = REWARDS.map((r) => ({
      type: r.id,
      label: r.label,
      placeableByHand: r.placeable !== false,
      earnedBy:
        r.id === "mark-seal"
          ? "The line being marked correct by the server. Never placed by hand."
          : r.id === "time-shard"
            ? "Its own line's timer, taken from the Floating Numbers question. Never placed by hand."
            : r.id === "math-vault"
              ? "The student's own working opening that Vault's code, in order. Never placed by hand. Opening a Vault never awards the line's score."
              : "Placed on a line by the teacher; it acts only after that line is marked correct, or when a chain reaches it.",
    }));
    return {
      data: {
        rewards: catalogue,
        conversionFactors: ["hourglassToTime", "lifeToTime", "vaultToLife", "completionToLife"],
        rule: "Artwork is not a reward. Nothing is awarded without server-confirmed full marks.",
      },
      summary: `${catalogue.length} reward types, ${PLACEABLE_REWARDS.length} of them placeable by hand.`,
    };
  },

  slate_list_games: async (ctx) => {
    const games = await withDb(ctx.supabase, () => listGames());
    return {
      data: games.map((g) => ({
        gameId: g.id,
        name: g.name,
        topic: g.topic,
        subtopic: g.subtopic,
        roomId: g.roomId,
        writingSurfaces: g.slots.length,
        savedAt: new Date(g.updatedAt).toISOString(),
      })),
      summary: `${games.length} Slate game${games.length === 1 ? "" : "s"} in this workspace.`,
    };
  },

  slate_read_game: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const classId = str(args, "classId") ?? null;
    const game = await readGame(ctx, gameId);
    const questions = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    const classes = await withDb(ctx.supabase, () => listGameClasses(gameId));
    const totalMarks = questions.reduce((sum, q) => sum + q.totalMarks, 0);
    return {
      data: {
        ...describeGame(game, questions.length, totalMarks),
        questions: questions.map((q) => ({
          questionRowId: q.id,
          position: q.position,
          classId: q.classId,
          notebookId: q.notebookId,
          subsectionId: q.subsectionId,
          questionText: q.questionText,
          floatingLines: q.lines.length,
          marks: q.totalMarks,
        })),
        assignedClasses: classes,
      },
      summary: `"${game.name}" — ${questions.length} question${questions.length === 1 ? "" : "s"}, ${totalMarks} marks, ${classes.length} class${classes.length === 1 ? "" : "es"} playing it.`,
    };
  },

  slate_create_game: async (ctx, args) => {
    const name = need(args, "name");
    const roomArg = str(args, "roomId") ?? ROOMS[0]!.id;
    const room = roomArg === NO_ROOM_ID ? null : ROOMS.find((r) => r.id === roomArg);
    if (roomArg !== NO_ROOM_ID && !room) {
      throw new Error(
        `There is no room called "${roomArg}". Call slate_list_rooms and pick a real one.`,
      );
    }
    const lines = Math.min(24, Math.max(1, Math.round(numOr(args, "lines", 6))));

    // A repeated request must not leave two games behind: a game of the same
    // name and topic saved minutes ago is the same intent, so it is returned.
    const existing = await withDb(ctx.supabase, () => listGames());
    const twin = existing.find(
      (g) =>
        g.name.toLowerCase() === name.toLowerCase() &&
        (g.topic ?? "").toLowerCase() === (str(args, "topic") ?? "").toLowerCase() &&
        Date.now() - g.updatedAt < 15 * 60 * 1000,
    );
    if (twin) {
      const questions = await withDb(ctx.supabase, () => listGameQuestions(twin.id, null));
      return {
        data: {
          ...describeGame(twin, questions.length, questions.reduce((s, q) => s + q.totalMarks, 0)),
          reused: true,
        },
        summary: `"${twin.name}" already exists from a moment ago, so I kept that one instead of making a second.`,
      };
    }

    const draft = makeGame({
      name,
      topic: str(args, "topic") ?? "",
      subtopic: str(args, "subtopic") ?? "",
      surfaceId: room?.surfaceId ?? "plain",
      lines,
      background: { src: null, assetId: null, kind: "image", scale: 1, x: 0, y: 0, opacity: 1 },
      roomId: room?.id ?? NO_ROOM_ID,
    });
    const saved = await writeGame(ctx, draft);
    return {
      data: { ...describeGame(saved, 0, 0), draft: true },
      summary: `Built the draft game "${saved.name}" with ${saved.slots.length} writing surfaces. No class can see it yet.`,
    };
  },

  slate_update_game: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const game = await readGame(ctx, gameId);
    const expected = str(args, "expectedSavedAt");
    if (expected && new Date(game.updatedAt).toISOString() !== expected) {
      throw new Error(
        "This game was changed somewhere else since you last read it. Read it again before saving over it.",
      );
    }
    const roomArg = str(args, "roomId");
    let roomId = game.roomId;
    let surfaceId = game.surfaceId;
    if (roomArg) {
      if (roomArg === NO_ROOM_ID) {
        roomId = NO_ROOM_ID;
      } else {
        const room = ROOMS.find((r) => r.id === roomArg);
        if (!room) throw new Error(`There is no room called "${roomArg}".`);
        roomId = room.id;
        surfaceId = room.surfaceId;
      }
    }
    const lines = maybeNum(args, "lines");
    let slots = game.slots;
    if (lines !== undefined) {
      const want = Math.min(24, Math.max(1, Math.round(lines)));
      if (want > slots.length) {
        slots = [...slots, ...Array.from({ length: want - slots.length }, (_, i) => makeSlot(slots.length + i))];
      } else if (want < slots.length) {
        // Never silently discard a surface a teacher wrote on.
        const losing = slots.slice(want).filter((s) => s.text || s.hiddenContent || s.rewards.length);
        if (losing.length > 0) {
          throw new Error(
            `Removing surfaces would throw away ${losing.length} surface${losing.length === 1 ? "" : "s"} that already has work or rewards on it. Ask the teacher first.`,
          );
        }
        slots = slots.slice(0, want);
      }
    }
    const next: Game = {
      ...game,
      name: str(args, "name") ?? game.name,
      topic: str(args, "topic") ?? game.topic,
      subtopic: str(args, "subtopic") ?? game.subtopic,
      roomId,
      surfaceId: roomId === NO_ROOM_ID ? game.surfaceId : surfaceId,
      slots,
      patternLength: Math.max(1, Math.round(maybeNum(args, "patternLength") ?? game.patternLength)),
    };
    const saved = await writeGame(ctx, next);
    const questions = await withDb(ctx.supabase, () => listGameQuestions(gameId, null));
    return {
      data: describeGame(saved, questions.length, questions.reduce((s, q) => s + q.totalMarks, 0)),
      summary: `Saved "${saved.name}" — ${saved.slots.length} writing surfaces in ${getRoom(saved.roomId)?.label ?? "background only"}.`,
    };
  },

  slate_configure_rewards: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const game = await readGame(ctx, gameId);
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const rewards = {
      ...game.settings.rewards,
      visible: typeof args["visible"] === "boolean" ? (args["visible"] as boolean) : game.settings.rewards.visible,
      opacity: clamp01(maybeNum(args, "opacity") ?? game.settings.rewards.opacity),
      glow: clamp01(maybeNum(args, "glow") ?? game.settings.rewards.glow),
      scale: Math.min(3, Math.max(0.2, maybeNum(args, "scale") ?? game.settings.rewards.scale)),
    };
    const conversion = normalizeConversion({
      ...game.settings.conversion,
      hourglassToTime: maybeNum(args, "hourglassToTime") ?? game.settings.conversion.hourglassToTime,
      lifeToTime: maybeNum(args, "lifeToTime") ?? game.settings.conversion.lifeToTime,
      vaultToLife: maybeNum(args, "vaultToLife") ?? game.settings.conversion.vaultToLife,
      completionToLife: maybeNum(args, "completionToLife") ?? game.settings.conversion.completionToLife,
    });

    const next: Game = {
      ...game,
      settings: {
        ...game.settings,
        rewards,
        conversion,
        life: {
          ...game.settings.life,
          multiplier: Math.min(10, Math.max(0.1, maybeNum(args, "lifeMultiplier") ?? game.settings.life.multiplier)),
        },
      },
    };
    const saved = await writeGame(ctx, next);
    return {
      data: {
        gameId,
        rewards: saved.settings.rewards,
        conversion: saved.settings.conversion,
        lifeMultiplier: saved.settings.life.multiplier,
      },
      summary: `Reward settings saved: rewards ${saved.settings.rewards.visible ? "visible" : "hidden"}, Life worth ${saved.settings.life.multiplier}× a question's time.`,
    };
  },

  slate_place_reward: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const type = need(args, "type");
    const def = REWARDS.find((r) => r.id === type);
    if (!def) {
      throw new Error(
        `There is no reward called "${type}". Call slate_list_rewards for the real list.`,
      );
    }
    if (def.placeable === false) {
      throw new Error(
        `The ${def.label} is never placed by hand — it comes from the question itself. Only ${PLACEABLE_REWARDS.map((r) => r.id).join(", ")} can be placed.`,
      );
    }
    const game = await readGame(ctx, gameId);
    // Line 0 is the question and is outside rewards; solving begins at line 1.
    const line = Math.round(numOr(args, "line", 1));
    if (line < 1 || line > game.slots.length) {
      throw new Error(
        `Line ${line} does not exist. This game has lines 1 to ${game.slots.length}, and line 0 is the question, which never carries a reward.`,
      );
    }
    const reward: RewardInstance = {
      id: uid(),
      type,
      state: "dormant",
      hidden: false,
      x: Math.min(92, Math.max(8, numOr(args, "x", 70))),
      y: Math.min(92, Math.max(8, numOr(args, "y", 50))),
    };
    const slots = game.slots.map((slot, index) =>
      index === line - 1 ? { ...slot, rewards: [...slot.rewards, reward] } : slot,
    );
    const saved = await writeGame(ctx, { ...game, slots });
    const placed = saved.slots[line - 1]?.rewards ?? [];
    if (!placed.some((r) => r.id === reward.id)) {
      throw new Error("The reward did not save. Nothing was changed.");
    }
    return {
      data: {
        gameId,
        line,
        rewardId: reward.id,
        type,
        onThisLine: placed.map((r) => r.type),
      },
      summary: `Put a ${def.label} on line ${line}. It can only act once that line is marked correct.`,
    };
  },

  slate_attach_question: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const subsectionId = need(args, "subsectionId");
    const classId = str(args, "classId") ?? null;
    const db = ctx.supabase as unknown as AnyDb;

    // The question must really be a question with Floating Numbers, or the
    // level would be empty in play.
    const { data: sub } = await db
      .from("notebook_subsections")
      .select("id, section_id, floating_lines")
      .eq("id", subsectionId)
      .maybeSingle();
    if (!sub) throw new Error("That question was not found. Check the session id.");
    const lineCount = Array.isArray(sub.floating_lines) ? sub.floating_lines.length : 0;
    if (lineCount === 0) {
      throw new Error(
        "This question has no Floating Numbers yet, so the level would be empty. Highlight the solution and generate them first.",
      );
    }
    const { data: section } = await db
      .from("notebook_sections")
      .select("notebook_id")
      .eq("id", sub.section_id)
      .maybeSingle();
    const notebookId = String(section?.notebook_id ?? "");
    if (!notebookId) throw new Error("That question has no lesson note above it.");

    const before = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    if (before.some((q) => q.subsectionId === subsectionId)) {
      return {
        data: { gameId, classId, subsectionId, levels: before.length, alreadyAttached: true },
        summary: `That question is already Level ${before.findIndex((q) => q.subsectionId === subsectionId) + 1} of this game.`,
      };
    }
    const ok = await withDb(ctx.supabase, () =>
      assignQuestion(gameId, notebookId, subsectionId, classId),
    );
    if (!ok) throw new Error("The question could not be attached to this game.");
    const after = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    return {
      data: {
        gameId,
        classId,
        levels: after.map((q, i) => ({ level: i + 1, subsectionId: q.subsectionId, marks: q.totalMarks })),
        totalMarks: after.reduce((s, q) => s + q.totalMarks, 0),
      },
      summary: `Added the question as Level ${after.length}. The earlier levels are untouched.`,
    };
  },

  slate_list_game_questions: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const classId = str(args, "classId") ?? null;
    const questions = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    return {
      data: {
        gameId,
        classId,
        levels: questions.map((q, i) => ({
          level: i + 1,
          questionRowId: q.id,
          subsectionId: q.subsectionId,
          questionText: q.questionText,
          floatingLines: q.lines.length,
          marks: q.totalMarks,
        })),
        totalMarks: questions.reduce((s, q) => s + q.totalMarks, 0),
      },
      summary: `${questions.length} level${questions.length === 1 ? "" : "s"} in this game, in saved order.`,
    };
  },

  slate_reorder_game_questions: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const classId = str(args, "classId") ?? null;
    const ids = strList(args, "questionRowIds");
    if (ids.length === 0) throw new Error('Argument "questionRowIds" is empty.');
    const before = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    const known = new Set(before.map((q) => q.id));
    if (ids.length !== before.length || ids.some((id) => !known.has(id))) {
      throw new Error(
        "The new order must list every level of this game exactly once. Read the levels again first.",
      );
    }
    await withDb(ctx.supabase, () => reorderQuestions(ids));
    const after = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    return {
      data: { gameId, classId, levels: after.map((q, i) => ({ level: i + 1, questionRowId: q.id })) },
      summary: `Reordered the levels. Level 1 is now "${after[0]?.questionText.slice(0, 40) ?? ""}".`,
    };
  },

  slate_remove_game_question: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const questionRowId = need(args, "questionRowId");
    const ok = await withDb(ctx.supabase, () => removeQuestion(questionRowId));
    if (!ok) throw new Error("That level could not be removed.");
    const after = await withDb(ctx.supabase, () => listGameQuestions(gameId, str(args, "classId") ?? null));
    return {
      data: { gameId, remaining: after.length },
      summary: `Removed the level. ${after.length} level${after.length === 1 ? "" : "s"} left. The lesson-note question itself is untouched.`,
    };
  },

  slate_test_game: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const classId = str(args, "classId") ?? null;
    const game = await readGame(ctx, gameId);
    const questions = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));

    const checks: { check: string; result: "pass" | "fail" | "needs a person"; detail: string }[] = [];
    checks.push(
      questions.length > 0
        ? { check: "Levels attached", result: "pass", detail: `${questions.length} level(s) in saved order.` }
        : { check: "Levels attached", result: "fail", detail: "No question is attached, so there is nothing to play." },
    );
    const empty = questions.filter((q) => q.lines.length === 0);
    checks.push(
      empty.length === 0
        ? { check: "Every level has Floating Numbers", result: "pass", detail: "Each level reads real solving lines." }
        : { check: "Every level has Floating Numbers", result: "fail", detail: `${empty.length} level(s) have none.` },
    );
    const marks = questions.reduce((s, q) => s + q.totalMarks, 0);
    checks.push(
      marks > 0
        ? { check: "Marks available", result: "pass", detail: `${marks} marks across the game.` }
        : { check: "Marks available", result: "fail", detail: "No level carries any marks." },
    );
    checks.push(
      game.slots.length >= Math.max(1, questions[0]?.lines.length ?? 1)
        ? { check: "Enough writing surfaces for Level 1", result: "pass", detail: `${game.slots.length} surfaces.` }
        : {
            check: "Enough writing surfaces for Level 1",
            result: "fail",
            detail: `Level 1 needs ${questions[0]?.lines.length} surfaces but the game has ${game.slots.length}.`,
          },
    );
    const handPlaced = game.slots.flatMap((s) => s.rewards.map((r) => r.type));
    checks.push({
      check: "Rewards placed by hand",
      result: "pass",
      detail: handPlaced.length
        ? `${handPlaced.length}: ${handPlaced.join(", ")}. Completion, Hourglass and Vault come from the question itself.`
        : "None placed. Completion, Hourglass and Vault still come from the question itself.",
    });
    checks.push({
      check: "How it looks and reads in the room",
      result: "needs a person",
      detail: "Open the preview and check the writing sits inside the room with nothing clipped.",
    });

    const failures = checks.filter((c) => c.result === "fail");
    const path = `/game/${gameId}`;
    return {
      data: {
        ...describeGame(game, questions.length, marks),
        classId,
        checks,
        passed: failures.length === 0,
        previewPath: path,
        note: "Opening the preview is not a pass. Nothing here is recorded against any student.",
      },
      summary:
        failures.length === 0
          ? `Inspected "${game.name}": ${questions.length} level(s), ${marks} marks, everything I can check is right. The look in the room still needs your eyes.`
          : `Inspected "${game.name}" and ${failures.length} thing${failures.length === 1 ? "" : "s"} are wrong: ${failures.map((f) => f.detail).join(" ")}`,
      navigateTo: path,
    };
  },

  slate_publish_game: async (ctx, args) => {
    const gameId = need(args, "gameId");
    const classId = need(args, "classId");
    const passPercentage = Math.min(100, Math.max(0, Math.round(numOr(args, "passPercentage", 70))));
    const game = await readGame(ctx, gameId);

    // The class must actually receive something playable.
    const classScoped = await withDb(ctx.supabase, () => listGameQuestions(gameId, classId));
    const pool = classScoped.length > 0 ? classScoped : await withDb(ctx.supabase, () => listGameQuestions(gameId, null));
    if (pool.length === 0) {
      throw new Error(
        "This game has no questions yet, so the class would receive an empty game. Attach at least one question first.",
      );
    }
    if (classScoped.length === 0) {
      throw new Error(
        "This game's questions are not attached for that class yet. Attach them with the class id first, so this class gets its own levels and order.",
      );
    }

    const assignmentId = await withDb(ctx.supabase, () =>
      assignGameToClass({ gameId, classId, passPercentage, title: str(args, "title") ?? game.name }),
    );
    const db = ctx.supabase as unknown as AnyDb;
    const { data: check } = await db
      .from("slate_game_assignments")
      .select("id, class_id, unassigned_at, pass_percentage")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!check || check.unassigned_at) {
      throw new Error("The game did not reach the class. Nothing was published.");
    }
    return {
      data: {
        assignmentId,
        gameId,
        classId,
        levels: classScoped.length,
        totalMarks: classScoped.reduce((s, q) => s + q.totalMarks, 0),
        passPercentage: Number(check.pass_percentage ?? passPercentage),
      },
      summary: `"${game.name}" is live for that class with ${classScoped.length} level${classScoped.length === 1 ? "" : "s"}, passing at ${passPercentage}%.`,
      navigateTo: `/class/${classId}`,
    };
  },
};
