import { afterEach, describe, expect, it, vi } from "vitest";
const { invoke } = vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke}}}));
import { runEngine } from "../../mathengine/client";
import { requestBlueprint } from "../ai/pipeline/blueprint";
import { runBlueprintStage } from "../ai/pipeline/generate";
import { EMPTY_TEACHER_CONTEXT } from "../ai/pipeline/types";

afterEach(()=>{vi.clearAllMocks();vi.useRealTimers();});
describe("subject-preserving generation transport", () => {
  it.each(["Mathematics","Physics","Chemistry"])("keeps %s on the engine request",async subject=>{
    invoke.mockResolvedValue({data:{narration:"analysis",questions:[]},error:null});
    await runEngine({operation:"analyseQuestion",subject,question:"QA"});
    expect(invoke.mock.calls[0][1].body).toMatchObject({mode:"mathengine",subject});
  });
  it.each(["Mathematics","Physics","Chemistry"])("keeps %s through blueprint analysis",async subject=>{
    vi.useFakeTimers();
    invoke.mockResolvedValue({data:{blueprint:{objective:"QA"}},error:null});
    await runBlueprintStage({subject,material:{text:"QA",images:[],files:[]},context:{...EMPTY_TEACHER_CONTEXT},sectionKind:"example"});
    expect(invoke.mock.calls[0][1].body).toMatchObject({mode:"blueprint",subject});
    vi.clearAllTimers();
  });
  it("retains the historical Maths default when the caller has no subject",async()=>{
    vi.useFakeTimers();
    invoke.mockResolvedValue({data:{blueprint:{objective:"QA"}},error:null});
    await requestBlueprint({material:{text:"QA",images:[],files:[]},context:{...EMPTY_TEACHER_CONTEXT},sectionKind:"example"});
    expect(invoke.mock.calls[0][1].body.subject).toBe("Mathematics");
    vi.clearAllTimers();
  });
});
