// One database client, two callers.
//
// App code in the browser uses the signed-in client directly. The teaching
// agent runs the SAME shared workflow code on the server, where it must use the
// teacher's own authenticated client so row-level security still applies.
//
// `withDb` lends that client to the shared modules for the duration of one
// awaited call, and calls are queued so two agent turns can never overlap and
// borrow each other's client. Browser code never sets an override, so it always
// gets the ordinary client.

import { supabase } from "@/integrations/supabase/client";

type Client = typeof supabase;

let override: Client | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** The client the shared workflow modules should use right now. */
export function db(): Client {
  return (override ?? supabase) as Client;
}

/** Run `fn` with `client` standing in for the ordinary database client. */
export function withDb<T>(client: unknown, fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    override = client as Client;
    try {
      return await fn();
    } finally {
      override = null;
    }
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
