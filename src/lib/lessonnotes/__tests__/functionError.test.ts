import { describe, expect, it } from "vitest";
import { describeFunctionError, readFunctionError } from "../functionError";

const invokeError = (
  status: number,
  body: unknown,
  message = "Edge Function returned a non-2xx status code",
) =>
  Object.assign(new Error(message), {
    context: new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    ),
  });

describe("readFunctionError", () => {
  it("reads status, reason, message and balance from the Response on error.context", async () => {
    const err = invokeError(402, {
      error: "AI generation is part of a paid plan.",
      reason: "no_ai_plan",
      available: 0,
    });
    expect(await readFunctionError(err)).toEqual({
      status: 402,
      reason: "no_ai_plan",
      serverMessage: "AI generation is part of a paid plan.",
      available: 0,
    });
  });

  it("leaves the Response readable for other callers (it clones)", async () => {
    const err = invokeError(402, { error: "x", reason: "insufficient" });
    await readFunctionError(err);
    await expect(
      (err as unknown as { context: Response }).context.json(),
    ).resolves.toMatchObject({
      reason: "insufficient",
    });
  });

  it("never throws on a non-JSON body, a missing context or a non-error", async () => {
    expect(
      (await readFunctionError(invokeError(500, "<html>boom</html>"))).status,
    ).toBe(500);
    expect(await readFunctionError(new Error("network"))).toEqual({
      status: null,
      reason: null,
      serverMessage: null,
      available: null,
    });
    expect((await readFunctionError(null)).status).toBeNull();
    expect((await readFunctionError("oops")).status).toBeNull();
  });
});

describe("describeFunctionError", () => {
  it("402 no_ai_plan -> AI plan or credits required, with an upgrade path", async () => {
    const err = invokeError(402, {
      error:
        "AI generation is part of a paid plan. Upgrade your plan to generate.",
      reason: "no_ai_plan",
      available: 0,
    });
    const t = describeFunctionError(err, await readFunctionError(err));
    expect(t.title).toBe("AI plan or credits required");
    expect(t.description).toContain("paid plan");
    expect(t.needsPlan).toBe(true);
  });

  it("402 out of credits -> Out of AI credits", async () => {
    for (const reason of ["insufficient", "floor"]) {
      const err = invokeError(402, {
        error: "You have run out of credits.",
        reason,
        available: 0.1,
      });
      const t = describeFunctionError(err, await readFunctionError(err));
      expect(t.title).toBe("Out of AI credits");
      expect(t.needsPlan).toBe(true);
    }
  });

  it("402 past_due / expired / disabled -> plan needs attention", async () => {
    for (const reason of ["past_due", "expired", "disabled"]) {
      const err = invokeError(402, { error: `msg ${reason}`, reason });
      const t = describeFunctionError(err, await readFunctionError(err));
      expect(t.title).toBe("AI plan or credits required");
      expect(t.description).toBe(`msg ${reason}`);
    }
  });

  it("402 with an unreadable body still points at plans", async () => {
    const err = invokeError(402, "nope");
    const t = describeFunctionError(err, await readFunctionError(err));
    expect(t.needsPlan).toBe(true);
    expect(t.title).toBe("Out of AI credits");
  });

  it("other errors keep the generic title but include the server's reason", async () => {
    const err = invokeError(400, { error: "missing highlights" });
    const t = describeFunctionError(
      err,
      await readFunctionError(err),
      "Could not generate",
    );
    expect(t).toEqual({
      title: "Could not generate",
      description: "missing highlights",
      needsPlan: false,
    });
  });

  it("a bare 500 does not just say 'non-2xx'", async () => {
    const err = invokeError(500, "<html></html>");
    const t = describeFunctionError(err, await readFunctionError(err));
    expect(t.description).toContain("500");
    expect(t.needsPlan).toBe(false);
  });

  it("keeps timeout and plain error messages", async () => {
    const timeout = new Error(
      "Floating-number generation took too long. Please try again.",
    );
    expect(
      describeFunctionError(timeout, await readFunctionError(timeout))
        .description,
    ).toBe(timeout.message);
    const net = new Error("Failed to fetch");
    expect(
      describeFunctionError(net, await readFunctionError(net)).description,
    ).toBe("Failed to fetch");
  });
});
