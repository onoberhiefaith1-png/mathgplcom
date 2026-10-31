import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { parseNodes, flattenAtoms, parseAtoms, reconstructAtomIds } from "../atoms";
import { applySelection } from "../highlightEngine";
import { fillStructure } from "../selectableStructures";
import { restoreFloatingHighlight } from "../restoreFloatingHighlight";
import { EquationAtoms } from "@/components/floating/EquationAtoms";

const matrix=String.raw`\begin{bmatrix}1×2 + 2×1 + 0×0 & 1×0 + 2×2 + 0×3 & 1\\2 & 3 & 4\\5 & 6 & 7\end{bmatrix}`;
const parsed=(source:string)=>{const tree=parseNodes(source,"line");return {tree,atoms:flattenAtoms(tree)};};
const select=(source:string,choose:(atoms:ReturnType<typeof parseAtoms>)=>string[])=>{
  const {tree,atoms}=parsed(source);const ids=choose(atoms);
  return applySelection(tree,atoms,[],new Set(ids),ids).map(chip=>chip.value);
};

describe("structure shells and independently selectable values",()=>{
  it("keeps all nine cells and each number/operator in its source location",()=>{
    const {tree}=parsed(matrix);const m=tree[0];expect(m.kind).toBe("structure");
    if(m.kind!=="structure")throw Error("no matrix");
    expect(m.spec.rows).toBe(3);expect(m.spec.cols).toBe(3);expect(m.slots).toHaveLength(9);
    expect(flattenAtoms(m.slots[0].nodes).map(a=>a.value)).toEqual(["1","×","2","+","2","×","1","+","0","×","0"]);
    expect(fillStructure(m.spec.template,m.spec.slots)).toContain("1×2 + 2×1 + 0×0");
  });
  it.each([
    [0,1,"1"], [0,3,"1×2"], [1,3,"×2"], [2,3,"2"], [0,11,"1×2+2×1+0×0"],
  ])("applies a selected cell fragment [%s,%s] without including the whole cell",(start,end,expected)=>{
    const result=select(matrix,atoms=>atoms.filter(a=>a.kind!=="structure"&&a.kind!=="slot-boundary").slice(Number(start),Number(end)).map(a=>a.id));
    expect(result).toEqual([expected]);
  });
  it("selecting the matrix bracket creates exactly one empty 3 by 3 shell",()=>{
    const [shell]=select(matrix,atoms=>[atoms[0].id]);
    expect(shell.match(/\\square/g)).toHaveLength(9);
    expect(shell).not.toMatch(/[0-9×+]/);
    expect(shell.match(/\\\\/g)).toHaveLength(2);
  });
  it("can blend the shell and just the chosen first cell",()=>{
    const result=select(matrix,atoms=>[atoms[0].id,...atoms.slice(2,5).map(a=>a.id)]);
    expect(result).toHaveLength(1);expect(result[0]).toContain("1×2 & \\square");
    expect(result[0].match(/\\square/g)).toHaveLength(8);
  });
  it("does not merge selections from different matrix cells across an invisible gap",()=>{
    const {tree}=parsed(matrix);const m=tree[0];if(m.kind!=="structure")throw Error("no matrix");
    const a=flattenAtoms(m.slots[0].nodes)[0],b=flattenAtoms(m.slots[1].nodes)[0];
    const {atoms}=parsed(matrix);
    expect(applySelection(tree,atoms,[],new Set([a.id,b.id])).map(c=>c.value)).toEqual(["1","1"]);
  });
  it.each([
    [String.raw`\sum_{n=0}^{\infty} x`,["n","=","0","∞"],String.raw`\sum_{\square}^{\square}`],
    [String.raw`\int_{0}^{5} x dx`,["0","5"],String.raw`\int_{\square}^{\square}`],
    [String.raw`\lim_{x\to 0} f(x)`,["x","→","0"],String.raw`\lim_{\square}`],
    [String.raw`\bar{x+y}`,["x","+","y"],String.raw`\bar{\square}`],
    [String.raw`\binom{n+1}{2}`,["n","+","1","2"],String.raw`\binom{\square}{\square}`],
    [String.raw`\norm{x+y}`,["x","+","y"],String.raw`\norm{\square}`],
    [String.raw`\left(x+y\right)`,["x","+","y"],String.raw`\left(\square\right)`],
  ])("decomposes %s with the same shell/slot principle",(source,values,shell)=>{
    const {tree}=parsed(String(source));const n=tree[0];expect(n.kind).toBe("structure");
    if(n.kind!=="structure")throw Error("no structure");
    expect(n.slots.flatMap(slot=>flattenAtoms(slot.nodes).map(a=>a.value))).toEqual(values);
    expect(select(String(source),atoms=>[atoms[0].id])).toEqual([shell]);
    const first=flattenAtoms(n.slots[0].nodes)[0];
    expect(select(String(source),()=>[first.id])).toEqual([values[0]]);
  });
  it("exposes a braced integrand without losing it or showing grouping braces",()=>{
    const source=String.raw`\int_{0}^{5}{x+1}`;
    const {tree}=parsed(source);const integral=tree[0];if(integral.kind!=="structure")throw Error("no integral");
    expect(integral.spec.roles).toEqual(["lower","upper","body"]);
    expect(flattenAtoms(integral.slots[2].nodes).map(a=>a.value)).toEqual(["x","+","1"]);
    expect(select(source,atoms=>[atoms.find(a=>a.value==="x")!.id])).toEqual(["x"]);
  });
  it("retains existing fraction/root/derivative selection behaviour",()=>{
    for(const source of [String.raw`\frac{dy}{dx}`,String.raw`\sqrt{x+1}`]) {
      const {atoms}=parsed(source);const first=atoms.find(a=>a.kind==="variable")!;
      expect(select(source,()=>[first.id])).toEqual([first.value]);
    }
  });
  it("keeps nested fractions and nested matrices intact while exposing their contents",()=>{
    const source=String.raw`\begin{bmatrix}\frac{1}{2} & \begin{pmatrix}3 & 4\end{pmatrix}\end{bmatrix}`;
    const {tree}=parsed(source);const m=tree[0];if(m.kind!=="structure")throw Error("no matrix");
    expect(m.spec.cols).toBe(2);expect(m.slots[0].nodes[0].kind).toBe("frac");expect(m.slots[1].nodes[0].kind).toBe("structure");
  });
  it("preserves old teacher-created chip strings when restoring ownership",()=>{
    const atoms=parseAtoms(matrix,"line");
    const ids=reconstructAtomIds(atoms,["1×2 + 2×1 + 0×0"]);
    expect(ids[0]).toHaveLength(11);
    expect(ids[0].some(id=>atoms.find(a=>a.id===id)?.kind==="slot-boundary")).toBe(false);
  });
});

describe("opening is restoration, never generation",()=>{
  const source={lineId:"new",sourceUid:"h1",questionId:"q",groupId:1,equation:matrix};
  it("a newly highlighted matrix opens with no generated fillers or shells",()=>{
    const row=restoreFloatingHighlight(undefined,source);
    expect(row.fillers).toEqual([]);expect(row.containers).toEqual([]);expect(row.arrangement).toEqual([]);
    expect(row.equation).toBe(matrix);
  });
  it("does not replace saved manual chips, selections, arrangement, marks or timer on reload",()=>{
    const saved={...source,lineId:"saved",fillers:["1×2",String.raw`\frac{a}{b}`],fillersSelected:[true,false],containers:[],arrangement:[1,0],marks:3,timerSeconds:25,teacherEdited:true};
    const before=JSON.stringify(saved);const result=restoreFloatingHighlight(saved,source);
    expect(result).toEqual(saved);expect(JSON.stringify(saved)).toBe(before);
  });
});

let root:Root|undefined;let dom:JSDOM|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;dom?.window.close();dom=undefined;vi.unstubAllGlobals();});
async function mount(source:string){
  dom=new JSDOM('<div id="root"></div>',{pretendToBeVisual:true});
  vi.stubGlobal("window",dom.window);vi.stubGlobal("document",dom.window.document);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  root=createRoot(document.getElementById("root")!);const applied=vi.fn();
  await act(async()=>root!.render(createElement(EquationAtoms,{equation:source,lineId:"ui",chips:[],onApply:applied})));
  return applied;
}
async function click(element:Element){await act(async()=>element.dispatchEvent(new dom!.window.MouseEvent("click",{bubbles:true})));}
async function apply(){await click(document.querySelector('button[title="Apply selection (Enter)"]')!);}
describe("real equation controls",()=>{
  it("renders a 3 by 3 grid and applies one clicked number",async()=>{
    const applied=await mount(matrix);
    expect(document.querySelectorAll('[data-structure-slot^="row "]')).toHaveLength(9);
    await click(document.querySelector('[data-structure-slot="row 1, column 1"] [title="number · 1"]')!);
    await apply();expect(applied.mock.calls[0][0].map((c:any)=>c.value)).toEqual(["1"]);
  });
  it("the bracket applies an empty grid instead of a completed matrix",async()=>{
    const applied=await mount(matrix);
    await click(document.querySelector('button[aria-label="matrix structure 3 by 3"]')!);await apply();
    expect(applied.mock.calls[0][0][0].value.match(/\\square/g)).toHaveLength(9);
    expect(applied.mock.calls[0][0][0].value).not.toMatch(/[0-9]/);
  });
  it("clicks a single summation bound without selecting the operator or upper bound",async()=>{
    const applied=await mount(String.raw`\sum_{n=0}^{\infty} x`);
    await click(document.querySelector('[data-structure-slot="lower"] [title="number · 0"]')!);await apply();
    expect(applied.mock.calls[0][0].map((c:any)=>c.value)).toEqual(["0"]);
  });
});
