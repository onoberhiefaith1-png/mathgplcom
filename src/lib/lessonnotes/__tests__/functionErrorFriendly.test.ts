import { describe, expect, it } from "vitest";
import { friendlyFunctionErrorMessage, isTransientFunctionError } from "../functionError";

const httpError = (status: number, body: unknown) => {
  const e = new Error("Edge Function returned a non-2xx status code") as Error & { context: Response };
  e.name = "FunctionsHttpError";
  e.context = new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  return e;
};

describe("edge-function errors", () => {
  it("never shows the opaque Edge Function text for a platform failure", async () => {
    const msg = await friendlyFunctionErrorMessage(httpError(546, "<html>worker limit</html>"));
    expect(msg).not.toMatch(/edge function|non-2xx/i);
    expect(msg).toMatch(/try again/i);
  });

  it("surfaces the server detail for a controlled refusal", async () => {
    const msg = await friendlyFunctionErrorMessage(
      httpError(422, { error: "incomplete_solution", detail: "The connection dropped before the solution finished writing." }),
    );
    expect(msg).toMatch(/connection dropped/);
  });

  it("treats 5xx / fetch / relay failures as transient and 4xx as answers", () => {
    expect(isTransientFunctionError(new Error("x"), { status: 504, reason: null, serverMessage: null, available: null })).toBe(true);
    expect(isTransientFunctionError(new Error("x"), { status: 422, reason: null, serverMessage: null, available: null })).toBe(false);
    const fetchErr = new Error("Failed to send a request to the Edge Function");
    fetchErr.name = "FunctionsFetchError";
    expect(isTransientFunctionError(fetchErr)).toBe(true);
    const abort = new Error("aborted"); abort.name = "AbortError";
    expect(isTransientFunctionError(abort)).toBe(false);
  });
});
