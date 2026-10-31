import { describe, expect, it, vi } from "vitest";
import { isDestructive, runCoPilotAction, validateAction, type CoPilotAction, type CoPilotBridge, type CoPilotSnapshot } from "../copilot/actions";
const snapshot = (solution = "old working"): CoPilotSnapshot => ({
  subject:"Mathematics",topic:"QA",activeSubtopic:"Proof",sessionTitle:"Example 5",focusedRef:"s5",hasAnyContent:true,
  entries:[{ref:"s5",heading:"Example 5",kind:"example",pos:100,questionText:"Prove the limit.",solutionText:solution,hasDiagram:false,diagramSummary:"",focused:true}],
});
const action = (destructive = false): CoPilotAction => ({name:"generateSolution",label:"Rewrite Example 5 solution",target:"s5",instruction:"Use a concise forward proof",destructive});
const bridgeFor = (snap: CoPilotSnapshot) => ({snapshot:()=>snap,generateSolution:vi.fn(async()=>{}),generateQuestion:vi.fn(async()=>{})}) as unknown as CoPilotBridge;
describe("approved solution replacement", () => {
  it("keeps the duplicate-solution guard for an ordinary generation request", async () => {
    const bridge = bridgeFor(snapshot());
    expect(validateAction(bridge.snapshot(),action())).toContain("already has a solution");
    await expect(runCoPilotAction(bridge,action(),undefined,true)).rejects.toThrow("already has a solution");
    expect(bridge.generateSolution).not.toHaveBeenCalled();
  });
  it("marks an explicit replacement destructive and requires approval", async () => {
    const bridge = bridgeFor(snapshot());
    expect(isDestructive(action(true))).toBe(true);
    expect(validateAction(bridge.snapshot(),action(true))).toBeNull();
    await expect(runCoPilotAction(bridge,action(true))).rejects.toThrow("requires approval");
    expect(bridge.generateSolution).not.toHaveBeenCalled();
  });
  it("replaces only the existing solution after approval", async () => {
    const bridge = bridgeFor(snapshot());
    await runCoPilotAction(bridge,action(true),undefined,true);
    expect(bridge.generateSolution).toHaveBeenCalledWith("s5","Use a concise forward proof",undefined,true);
    expect(bridge.generateQuestion).not.toHaveBeenCalled();
  });
  it("generates a missing solution without requesting replacement", async () => {
    const bridge = bridgeFor(snapshot(""));
    await runCoPilotAction(bridge,action());
    expect(bridge.generateSolution).toHaveBeenCalledWith("s5","Use a concise forward proof",undefined,false);
  });
  it("refuses a stale question reference even when approved", async () => {
    const bridge = bridgeFor(snapshot());
    await expect(runCoPilotAction(bridge,{...action(true),target:"s99"},undefined,true)).rejects.toThrow("no longer");
    expect(bridge.generateSolution).not.toHaveBeenCalled();
  });
});
