// MathBoard Engine — Structural Token Tree
// Pure data model. No React. No DOM.
// Every mathematical expression is a tree of typed Nodes.

export type NodeKind =
  | "num"
  | "var"
  | "op" // + - * / etc., rendered literal
  | "eq" // = ≠ ≤ ≥
  | "sym" // ∠, °, ∈, ∪, dx ...
  | "frac"
  | "mixed"
  | "bracket"
  | "power"
  | "root"
  | "abs"
  | "integral"
  | "sum"
  | "prod"
  | "lim"
  | "deriv"
  | "partial"
  | "matrix"
  | "func"; // f(x) etc.

export interface BaseNode {
  id: string;
  kind: NodeKind;
}

export interface NumNode extends BaseNode { kind: "num"; value: string }
export interface VarNode extends BaseNode { kind: "var"; name: string }
export interface OpNode extends BaseNode { kind: "op"; op: "+" | "-" | "*" | "/" | "·" | "." | "!" }
export interface EqNode extends BaseNode { kind: "eq"; op: "=" | "≠" | "≤" | "≥" | "<" | ">" }
export interface SymNode extends BaseNode { kind: "sym"; name: string }

export interface FracNode extends BaseNode { kind: "frac"; num: Node[]; den: Node[] }
export interface MixedNode extends BaseNode { kind: "mixed"; whole: Node[]; num: Node[]; den: Node[] }
export interface BracketNode extends BaseNode { kind: "bracket"; mode: "inline" | "expanded"; shape: "(" | "[" | "{"; body: Node[] }
export interface PowerNode extends BaseNode { kind: "power"; base: Node[]; exp: Node[] }
export interface RootNode extends BaseNode { kind: "root"; degree: Node[] | null; radicand: Node[] }
export interface AbsNode extends BaseNode { kind: "abs"; body: Node[] }
export interface IntegralNode extends BaseNode { kind: "integral"; lower: Node[] | null; upper: Node[] | null; body: Node[] }
export interface SumProdNode extends BaseNode { kind: "sum" | "prod"; lower: Node[]; upper: Node[]; body: Node[] }
export interface LimNode extends BaseNode { kind: "lim"; sub: Node[]; body: Node[] }
export interface DerivNode extends BaseNode { kind: "deriv"; order: 1 | 2; body: Node[]; varName: Node[] }
export interface PartialNode extends BaseNode { kind: "partial"; body: Node[]; varName: Node[] }
export interface MatrixNode extends BaseNode { kind: "matrix"; rows: Node[][][] }
export interface FuncNode extends BaseNode { kind: "func"; name: string; arg: Node[] }

export type Node =
  | NumNode | VarNode | OpNode | EqNode | SymNode
  | FracNode | MixedNode | BracketNode | PowerNode | RootNode
  | AbsNode | IntegralNode | SumProdNode | LimNode | DerivNode | PartialNode
  | MatrixNode | FuncNode;

let _id = 0;
export const nid = () => `n${++_id}_${Math.random().toString(36).slice(2, 7)}`;

export const mkNum = (v: string): NumNode => ({ id: nid(), kind: "num", value: v });
export const mkVar = (n: string): VarNode => ({ id: nid(), kind: "var", name: n });
export const mkOp = (op: OpNode["op"]): OpNode => ({ id: nid(), kind: "op", op });
export const mkEq = (op: EqNode["op"] = "="): EqNode => ({ id: nid(), kind: "eq", op });
export const mkSym = (name: string): SymNode => ({ id: nid(), kind: "sym", name });

export const mkFrac = (): FracNode => ({ id: nid(), kind: "frac", num: [], den: [] });
export const mkMixed = (): MixedNode => ({ id: nid(), kind: "mixed", whole: [], num: [], den: [] });
export const mkBracket = (mode: "inline" | "expanded" = "inline", shape: "(" | "[" | "{" = "("): BracketNode => ({
  id: nid(), kind: "bracket", mode, shape, body: [],
});
export const mkPower = (): PowerNode => ({ id: nid(), kind: "power", base: [], exp: [] });
export const mkRoot = (withDegree = false): RootNode => ({ id: nid(), kind: "root", degree: withDegree ? [] : null, radicand: [] });
export const mkAbs = (): AbsNode => ({ id: nid(), kind: "abs", body: [] });
export const mkIntegral = (definite = false): IntegralNode => ({
  id: nid(), kind: "integral",
  lower: definite ? [] : null, upper: definite ? [] : null, body: [],
});
export const mkSum = (): SumProdNode => ({ id: nid(), kind: "sum", lower: [], upper: [], body: [] });
export const mkProd = (): SumProdNode => ({ id: nid(), kind: "prod", lower: [], upper: [], body: [] });
export const mkLim = (): LimNode => ({ id: nid(), kind: "lim", sub: [], body: [] });
export const mkDeriv = (order: 1 | 2 = 1): DerivNode => ({ id: nid(), kind: "deriv", order, body: [], varName: [mkVar("x")] });
export const mkPartial = (): PartialNode => ({ id: nid(), kind: "partial", body: [], varName: [mkVar("x")] });
export const mkFunc = (name: string): FuncNode => ({ id: nid(), kind: "func", name, arg: [] });

/** Slots a node exposes that the cursor can enter (in tab-order). */
export const slotsOf = (n: Node): Array<keyof Node> => {
  switch (n.kind) {
    case "frac": return ["num", "den"] as any;
    case "mixed": return ["whole", "num", "den"] as any;
    case "bracket": return ["body"] as any;
    case "power": return ["base", "exp"] as any;
    case "root": return (n.degree ? ["degree", "radicand"] : ["radicand"]) as any;
    case "abs": return ["body"] as any;
    case "integral": return (n.lower ? ["lower", "upper", "body"] : ["body"]) as any;
    case "sum":
    case "prod": return ["lower", "upper", "body"] as any;
    case "lim": return ["sub", "body"] as any;
    case "deriv":
    case "partial": return ["body", "varName"] as any;
    case "func": return ["arg"] as any;
    default: return [];
  }
};
