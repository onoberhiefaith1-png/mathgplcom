/**
 * MathGPL ID sign-in.
 *
 * A MathGPL ID is an identifier, never a secret: the ID alone tells the
 * browser nothing. The ID and the password travel together to the server,
 * which resolves the account, verifies the password, and only then returns a
 * session. An unknown ID and a wrong password produce the same message, so
 * the form cannot be used to discover which IDs exist.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const GENERIC = "Incorrect MathGPL ID or password.";

/** ADM/000001 · TCH/000001 · STU/000001 · PAR/000001 · SC/OX/000001 */
const ID_PATTERN = /^(ADM|TCH|STU|PAR|SC)\/(?:[A-Z0-9]{2,6}\/)?\d{4,9}$/;

/**
 * People type letter O for zero and I/L for one. The number part of a MathGPL
 * ID is always digits, so those look-alikes are corrected before lookup.
 */
const normaliseId = (value: string) => {
  const clean = value.toUpperCase().replace(/\s+/g, "");
  const parts = clean.split("/");
  const last = parts.pop();
  if (!last) return clean;
  return [...parts, last.replace(/O/g, "0").replace(/[IL]/g, "1")].join("/");
};

const credentials = z.object({
  mathgplId: z.string().trim().max(40).transform(normaliseId),
  password: z.string().min(1).max(128),
});

// Best-effort brake on guessing, per worker instance.
const attempts = new Map<string, { n: number; until: number }>();
const throttle = (key: string) => {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.until > now && entry.n >= 8) {
    throw new Error("Too many attempts. Please wait a minute and try again.");
  }
  if (!entry || entry.until <= now) attempts.set(key, { n: 1, until: now + 60_000 });
  else entry.n += 1;
};

export const signInWithMathgplId = createServerFn({ method: "POST" })
  .inputValidator((data: { mathgplId: string; password: string }) => credentials.parse(data))
  .handler(async ({ data }) => {
    throttle(data.mathgplId);
    if (!ID_PATTERN.test(data.mathgplId)) throw new Error(GENERIC);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("account_ids")
      .select("user_id")
      .eq("mathgpl_id", data.mathgplId)
      .maybeSingle();
    if (!row?.user_id) throw new Error(GENERIC);

    const { data: found } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = found?.user?.email;
    if (!email) throw new Error(GENERIC);

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: signIn, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !signIn.session) {
      if (error && /not confirmed/i.test(error.message)) {
        throw new Error("Please confirm your email address before signing in.");
      }
      throw new Error(GENERIC);
    }

    return {
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    };
  });

/**
 * The permanent MathGPL ID of a freshly created account, so the sign-up
 * screen can show it before the person has confirmed their email address.
 */
export const mathgplIdForUser = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("account_ids")
      .select("mathgpl_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    return { mathgplId: row?.mathgpl_id ?? null };
  });
