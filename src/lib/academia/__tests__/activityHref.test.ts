import { expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({ enter:vi.fn(), start:vi.fn(async()=>undefined) }));
vi.mock("@/lib/academia/api",()=>({enterActivity:mocks.enter,startAttempt:mocks.start}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
import { activityHref } from "../activityChain";
it("Practice opens an MCQ directly and Play never enters it",async()=>{
 const activity={id:"mcq",kind:"mcq",session_id:"session"} as any;
 expect(await activityHref(activity,"practice")).toBe("/academia/mcq/mcq");
 expect(await activityHref(activity,"play")).toBeNull(); expect(mocks.enter).not.toHaveBeenCalled();
});
it("neither chain routes into an Adventure with an attached Game",async()=>{
 const activity={id:"adv",kind:"adventure",game_id:"embedded"} as any;
 expect(await activityHref(activity,"practice")).toBeNull(); expect(await activityHref(activity,"play")).toBeNull();
});
