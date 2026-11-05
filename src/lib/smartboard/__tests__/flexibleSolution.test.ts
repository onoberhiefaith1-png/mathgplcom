import { describe, it, expect } from "vitest";
import { ownerAt, unshiftSolutionY, captionSlackShift, legacyOwnerAt, legacyNoteRange, shiftRows, spliceSolution, solutionContains, tagEditedNodes } from "../flexibleSolution";

describe("sensor selects the equation, not the old floating tray", () => {
 const row = [{kind:"char",ch:"x",sbOwner:0}, {kind:"char",ch:"=",sbOwner:0}, {kind:"char",ch:"1",sbOwner:0},
   {kind:"char",ch:" ",sbOwner:1}, {kind:"char",ch:"y",sbOwner:1}, {kind:"char",ch:"=",sbOwner:1}, {kind:"char",ch:"2",sbOwner:1}];
 it("selects a previous equation regardless of the active tray", () => expect(ownerAt(row,2,[],4)).toBe(0));
 it("selects a later equation on the same physical row", () => expect(ownerAt(row,6,[],0)).toBe(1));
 it("keeps the first equation selected in the gap", () => expect(ownerAt(row,4,[],1)).toBe(0));
 it("selects the second after its final symbol", () => expect(ownerAt(row,7,[],0)).toBe(1));
 it("uses the enclosing root structure for a nested caret", () => expect(ownerAt(row,0,[4,0,0,1],0)).toBe(1));
 it("uses saved row ownership for legacy untagged equations", () => expect(ownerAt([{}],0,[],3)).toBe(3));
 it("does not invent an owner for blank space", () => expect(ownerAt([],0,[])).toBeUndefined());
 it("preserves per-equation ownership during an edit", () => {
   const changed=tagEditedNodes(row,[...row,{kind:"char",ch:"+"}],1);
   expect((changed[0] as { sbOwner?: number }).sbOwner).toBe(0); expect(changed[7]).toMatchObject({sbOwner:1});
 });
 it("keeps ownership serializable across save/reload",()=>expect(ownerAt(JSON.parse(JSON.stringify(row)),6,[],0)).toBe(1));
});

describe("invisible solution margins", () => {
 const locked=new Set([7]);
 it.each([2,3.5,12,12.5])("rejects heading/next section row %s",row=>expect(solutionContains(row,4,11,locked)).toBe(false));
 it.each([4,5.5,11])("accepts writable row %s",row=>expect(solutionContains(row,4,11,locked)).toBe(true));
 it.each([7,7.5])("rejects protected note row %s",row=>expect(solutionContains(row,4,11,locked)).toBe(false));
});

describe("note removal and restoration row movement",()=>{
 it("closes a deleted note gap without losing a half-row equation",()=>{
   const remaining={4:"equation1",6:"equation2",6.5:"operator",7:"equation3",14:"next section"};
   expect(shiftRows(remaining,6,-1,11)).toEqual({4:"equation1",5:"equation2",5.5:"operator",6:"equation3",14:"next section"});
 });
 it("inserts a note below its equation and pushes following work down",()=>{
   expect({...shiftRows({4:"equation1",5:"equation2",6:"equation3"},5,1),5:"restored note"})
     .toEqual({4:"equation1",5:"restored note",6:"equation2",7:"equation3"});
 });
 it("moves ownership and locks with their rows",()=>{
   expect(shiftRows({6:1,7:2},6,-1)).toEqual({5:1,6:2});
   expect(Object.keys(shiftRows({7:true},6,-1)).map(Number)).toEqual([6]);
 });
 it("does not mutate the previous snapshot needed by Undo",()=>{
   const before={4:"a",6:"b"};const after=shiftRows(before,6,-1);
   expect(before).toEqual({4:"a",6:"b"});expect(after).toEqual({4:"a",5:"b"});
 });
 it("restores positions with the inverse move for redo/undo",()=>{
   const before={4:"a",6:"b",7.5:"c"};expect(shiftRows(shiftRows(before,6,2),8,-2)).toEqual(before);
 });
});


describe("actual note transaction used by the Smartboard",()=>{
 const original={ink:{4:"equation A",5:"note",6:"equation B",7:"other note"},offsets:{6:18},owners:{4:0,6:1},locked:new Set([5,7])};
 it("removes only the note and moves ink, offsets, owners and remaining locks together",()=>{
   const after=spliceSolution(original,5,1,{},10);
   expect(after.ink).toEqual({4:"equation A",5:"equation B",6:"other note"});
   expect(after.offsets).toEqual({5:18});expect(after.owners).toEqual({4:0,5:1});expect([...after.locked]).toEqual([6]);
   expect(solutionContains(5,4,10,after.locked)).toBe(true);
   expect(solutionContains(6,4,10,after.locked)).toBe(false);
 });
 it("restores the note underneath its equation and keeps it protected",()=>{
   const after=spliceSolution(original,5,1,{},10);
   const restored=spliceSolution(after,5,0,{5:"note"},10);
   expect(restored.ink).toEqual(original.ink);expect(restored.offsets).toEqual(original.offsets);
   expect(restored.owners).toEqual(original.owners);expect([...restored.locked].sort()).toEqual([5,7]);
 });
 it("handles a multi-paragraph note as one removal",()=>{
   const after=spliceSolution({...original,ink:{4:"a",5:"paragraph1",6:"paragraph2",7:"b"},locked:new Set([5,6]),owners:{4:0,7:1}},5,2,{},10);
   expect(after.ink).toEqual({4:"a",5:"b"});expect(after.owners).toEqual({4:0,5:1});expect(after.locked.size).toBe(0);
 });
 it("keeps the previous snapshot untouched for undo",()=>{
   spliceSolution(original,5,1,{},10);expect(original.ink[5]).toBe("note");expect([...original.locked]).toEqual([5,7]);
 });
});


describe("legacy boards remain flexible",()=>{
 const parts=["x","=","1"," ","y","=","2"];
 const equations=[{owner:0,text:"x=1"},{owner:1,text:"y=2"}];
 it("recognises both untagged equations on the same saved row",()=>{
  expect(legacyOwnerAt(parts,2,[],equations)).toBe(0);expect(legacyOwnerAt(parts,6,[],equations)).toBe(1);
 });
 it("selects the preceding equation in a legacy gap",()=>expect(legacyOwnerAt(parts,4,[],equations)).toBe(0));
 it("selects the last equation after its final symbol",()=>expect(legacyOwnerAt(parts,7,[],equations)).toBe(1));
 it("uses container position for legacy nested structures",()=>expect(legacyOwnerAt(["x=1","y=2"],0,[1,0],equations)).toBe(1));
 it("does not guess when no saved equation matches",()=>expect(legacyOwnerAt(["unrecognised"],1,[],equations)).toBeUndefined());
 it("removes an entire matching multi-paragraph legacy note",()=>expect(legacyNoteRange({4:"Compare",5:"with standard form",6:"a=2"},new Set([4,5]),5,[["Compare","with standard form"]],3,10)).toEqual([4,5]));
 it("does not merge adjacent unrelated legacy notes",()=>expect(legacyNoteRange({4:"Compare",5:"Other note"},new Set([4,5]),5,[["Compare","with standard form"]],3,10)).toEqual([5,5]));
 it("never groups across a solution margin",()=>expect(legacyNoteRange({4:"Compare",5:"with standard form"},new Set([4,5]),5,[["Compare","with standard form"]],5,10)).toEqual([5,5]));
});


describe("Solution margin without moving saved row ids",()=>{
 it("contracts spare caption space only below its Solution boundary",()=>{
  const captions=[{at:4,px:-48}];expect(captionSlackShift(3,captions)).toBe(0);
  expect(captionSlackShift(4,captions)).toBe(-48);expect(captionSlackShift(5,captions)).toBe(-48);
 });
 it("keeps normal row spacing and leaves positive overflow to the existing layout engine",()=>{
  const captions=[{at:4,px:-48},{at:20,px:100}];
  expect((5*40+captionSlackShift(5,captions))-(4*40+captionSlackShift(4,captions))).toBe(40);
  expect(captionSlackShift(20,captions)).toBe(-48);
 });
});


describe("pointer placement follows the measured Solution margin",()=>{
 const captions=[{at:4,px:-48}];const shift=(row:number)=>captionSlackShift(row,captions);
 it("maps the first visually contracted equation back to its saved row",()=>expect(unshiftSolutionY(112,40,0,captions,shift)).toBe(160));
 it("maps later equation rows without changing their ids",()=>expect(unshiftSolutionY(192,40,0,captions,shift)).toBe(240));
 it("does not turn a tap above Solution into writing space",()=>expect(unshiftSolutionY(100,40,0,captions,shift)).toBe(100));
});
