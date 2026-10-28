import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const INPUT = z.object({
  priceId: z.string().min(2).max(80),
  environment: z.enum(["sandbox", "live"]),
});

/**
 * Turns a readable price key such as `teacher_pro_monthly` into the provider's
 * internal price id, which differs between the test and live environments.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data) => INPUT.parse(data))
  .handler(async ({ data }) => {
    const { paddleFetch } = await import("@/lib/paddle.server");
    const res = await paddleFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await res.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) throw new Error("That price is not available yet.");
    return result.data[0]!.id;
  });
