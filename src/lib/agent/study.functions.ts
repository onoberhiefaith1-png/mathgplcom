// One stretch of Aura's autonomous exploration, run as the signed-in administrator.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const question = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["open", "answered"]),
  answer: z.string().optional(),
});

const ledger = z.object({
  known: z.array(z.string()).default([]),
  unknown: z.array(z.string()).default([]),
  tested: z.array(z.string()).default([]),
  failed: z.array(z.string()).default([]),
  questions: z.array(question).default([]),
  corrections: z.array(z.string()).default([]),
  map: z.record(z.string(), z.enum(["confirmed", "uncertain", "untouched"])).default({}),
});

const schema = z.object({
  subject: z.string().min(2).max(500),
  transcript: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(60)
    .default([]),
  ledger: ledger.nullable().optional(),
  missionId: z.string().nullable().optional(),
});

export const studyStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { runStudyStep } = await import("./study.server");
    return runStudyStep(
      { supabase: context.supabase as never, userId: context.userId },
      {
        subject: data.subject,
        transcript: data.transcript,
        ledger: data.ledger ?? null,
        missionId: data.missionId ?? null,
      },
    );
  });
