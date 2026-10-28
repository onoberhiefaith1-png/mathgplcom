// Operate Floating Numbers chips on a question the teacher owns. The change is
// saved to the question session, then a live "refresh" command is sent so an
// open Smartboard or Floating Numbers page re-reads the same saved data.
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { err, ok, requireUser } from "../supabase-user";
import { sendLiveCommand } from "../live";
import { compileBucket, type FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import { applyFloatingOp, FLOATING_ACTIONS } from "@/lib/chatgpt/floatingBoardOps";

export const operateFloatingNumbersTool = defineTool({
  name: "operate_floating_numbers",
  title: "Operate Floating Numbers on the board",
  description:
    "Change one line of a question's saved Floating Numbers: delete a chip, move a chip, merge chips into one, or keep two symbols side by side. Numbers are 1-based as shown on screen. The change is saved and any open Smartboard or Floating Numbers page refreshes to show it. Confirm with get_current_view before telling the teacher it appeared.",
  inputSchema: {
    subsectionId: z.string().uuid().describe("The question session id."),
    line: z.number().int().min(1).max(200).describe("1-based Floating Numbers line."),
    action: z.enum(FLOATING_ACTIONS).describe("What to do on that line."),
    n: z.number().int().min(1).optional().describe("delete: chip number to remove."),
    from: z.number().int().min(1).optional().describe("move: chip number to move."),
    to: z.number().int().min(1).optional().describe("move: position to move it to."),
    numbers: z.array(z.number().int().min(1)).min(2).max(30).optional().describe("merge: chip numbers to combine, in order."),
    a: z.string().min(1).max(50).optional().describe('keep_together: first symbol, e.g. "=".'),
    b: z.string().min(1).max(50).optional().describe('keep_together: second symbol, e.g. the fraction bar.'),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ subsectionId, line, action, n, from, to, numbers, a, b }, ctx) => {
    const authed = await requireUser(ctx);
    if ("error" in authed) return err(authed.error);
    const { client, userId } = authed;
    const { data: sub } = await client
      .from("notebook_subsections")
      .select("id, section_id, floating_lines")
      .eq("id", subsectionId)
      .maybeSingle();
    if (!sub) return err("Question session not found or not yours.");
    const { data: section } = await client
      .from("notebook_sections")
      .select("notebook_id")
      .eq("id", sub.section_id)
      .maybeSingle();
    if (!section) return err("Question session not found or not yours.");
    const { data: nb } = await client
      .from("notebooks")
      .select("id")
      .eq("id", section.notebook_id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!nb) return err("Question session not found or not yours.");

    const lines = (Array.isArray(sub.floating_lines) ? sub.floating_lines : []) as FloatingLine[];
    const result = applyFloatingOp(lines, line, action, { n, from, to, numbers, a, b });
    if (!result.ok) return err(result.error);

    const { error } = await client
      .from("notebook_subsections")
      .update({ floating_lines: result.lines, floating_bucket: compileBucket(result.lines) })
      .eq("id", subsectionId);
    if (error) return err(error.message);

    await sendLiveCommand(client, userId, "refresh", {});
    return ok(
      `Done — line ${line} now has ${result.chips.length} chips. Any open board refreshes to show it.`,
      { subsectionId, line, action, chips: result.chips },
    );
  },
});
