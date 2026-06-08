// MathBoard — pretty math renderer.
// Walks a Node[] tree and renders styled spans. Click on a slot moves the cursor.
// No LaTeX dependency.

import { Fragment, ReactNode } from "react";
import { Node } from "@/lib/mathboard/tokens";
import { Container, Cursor } from "@/lib/mathboard/cursor";

interface RenderOpts {
  sessionId: string;
  cursor: Cursor | null;
  onFocus: (c: Container, index: number) => void;
  readOnly?: boolean;
}

const Caret = () => (
  <span className="inline-block w-[2px] h-[1em] bg-amber-300 align-middle animate-pulse mx-[1px]" />
);

const Slot = ({
  arr,
  container,
  cursor,
  onFocus,
  className,
  placeholder,
  readOnly,
}: {
  arr: Node[];
  container: Container;
  cursor: Cursor | null;
  onFocus: RenderOpts["onFocus"];
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}) => {
  const isHere =
    cursor &&
    cursor.container.sessionId === container.sessionId &&
    cursor.container.nodeId === container.nodeId &&
    cursor.container.slot === container.slot;
  const sel = cursor?.selection;
  const selHere =
    sel &&
    sel.container.sessionId === container.sessionId &&
    sel.container.nodeId === container.nodeId &&
    sel.container.slot === container.slot
      ? sel
      : null;
  return (
    <span
      className={[
        "inline-flex items-center min-w-[0.6em] min-h-[1em] px-[1px] rounded transition-colors",
        cursor?.activeTokenId && container.nodeId === cursor.activeTokenId
          ? "ring-2 ring-amber-300/70 bg-amber-300/5"
          : isHere
          ? "bg-amber-300/5"
          : "",
        className || "",
      ].join(" ")}
      onClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        onFocus(container, arr.length);
      }}
    >
      {arr.length === 0 && !isHere && (
        <span className="opacity-40 text-amber-200/60 text-[0.85em]">{placeholder ?? "·"}</span>
      )}
      {arr.map((n, i) => {
        const inSel = !!selHere && i >= selHere.start && i < selHere.end;
        return (
          <Fragment key={n.id}>
            {isHere && cursor!.index === i && <Caret />}
            <span
              data-sel-index={i}
              onClick={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                onFocus(container, i);
              }}
              className={inSel ? "bg-cyan-400/25 ring-1 ring-cyan-300/60 rounded-sm" : ""}
            >
              {renderNode(n, { sessionId: container.sessionId, cursor, onFocus, readOnly })}
            </span>
          </Fragment>
        );
      })}
      {isHere && cursor!.index === arr.length && <Caret />}
    </span>
  );
};

const renderNode = (n: Node, opts: RenderOpts): ReactNode => {
  const c = (slot: string): Container => ({ sessionId: opts.sessionId, nodeId: n.id, slot });

  switch (n.kind) {
    case "num": return <span className="text-cyan-100">{n.value}</span>;
    case "var": return <span className="italic text-violet-200">{n.name}</span>;
    case "op": {
      const sp = n.op === "+" || n.op === "-" || n.op === "*" || n.op === "·" ? "mx-[0.18em]" : "";
      const sym = n.op === "*" ? "×" : n.op === "/" ? "÷" : n.op;
      return <span className={`text-amber-200 ${sp}`}>{sym}</span>;
    }
    case "eq": return <span className="text-amber-200 mx-[0.25em]">{n.op}</span>;
    case "sym": return <span className="text-cyan-200 mx-[0.1em]">{n.name}</span>;

    case "frac":
      return (
        <span className="inline-flex flex-col items-center align-middle leading-tight mx-[0.15em]">
          <Slot arr={n.num} container={c("num")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.25em]" />
          <span className="block w-full h-[1.5px] bg-current my-[1px]" />
          <Slot arr={n.den} container={c("den")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.25em]" />
        </span>
      );

    case "mixed":
      return (
        <span className="inline-flex items-center align-middle">
          <Slot arr={n.whole} container={c("whole")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="text-[1em] mr-[0.15em]" />
          <span className="inline-flex flex-col items-center leading-tight text-[0.6em]">
            <Slot arr={n.num} container={c("num")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.25em]" />
            <span className="block w-full h-[1.5px] bg-current my-[1px]" />
            <Slot arr={n.den} container={c("den")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.25em]" />
          </span>
        </span>
      );

    case "bracket": {
      const open = n.shape === "(" ? "(" : n.shape === "[" ? "[" : "{";
      const close = n.shape === "(" ? ")" : n.shape === "[" ? "]" : "}";
      const big = n.mode === "expanded";
      if (big) {
        return (
          <span className="inline-flex items-stretch align-middle">
            <span className="flex items-center text-amber-200/80 leading-none scale-y-[1.6] origin-center mx-[2px]">{open}</span>
            <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.15em]" />
            <span className="flex items-center text-amber-200/80 leading-none scale-y-[1.6] origin-center mx-[2px]">{close}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center align-middle">
          <span className="text-amber-200/80">{open}</span>
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.1em]" />
          <span className="text-amber-200/80">{close}</span>
        </span>
      );
    }

    case "power":
      return (
        <span className="inline-flex items-end align-middle">
          <Slot arr={n.base} container={c("base")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} />
          <span className="text-[0.6em] -translate-y-[0.6em] ml-[1px]">
            <Slot arr={n.exp} container={c("exp")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.1em]" placeholder="□" />
          </span>
        </span>
      );

    case "root":
      return (
        <span className="inline-flex items-center align-middle">
          {n.degree && (
            <span className="text-[0.55em] -translate-y-[0.4em] mr-[1px]">
              <Slot arr={n.degree} container={c("degree")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="n" />
            </span>
          )}
          <span className="text-amber-200">√</span>
          <span className="inline-flex border-t border-current pt-[1px] px-[0.1em]">
            <Slot arr={n.radicand} container={c("radicand")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="x" />
          </span>
        </span>
      );

    case "abs":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="text-amber-200">|</span>
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.15em]" />
          <span className="text-amber-200">|</span>
        </span>
      );

    case "integral":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="text-[1.6em] text-amber-200">∫</span>
          {n.lower && (
            <span className="inline-flex flex-col text-[0.55em] -ml-[0.4em] mr-[0.1em]">
              <Slot arr={n.upper!} container={c("upper")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="b" />
              <Slot arr={n.lower} container={c("lower")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="a" />
            </span>
          )}
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.1em]" />
        </span>
      );

    case "sum":
    case "prod":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="inline-flex flex-col items-center text-amber-200">
            <span className="text-[0.55em]"><Slot arr={n.upper} container={c("upper")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="n" /></span>
            <span className="text-[1.5em] leading-none">{n.kind === "sum" ? "Σ" : "Π"}</span>
            <span className="text-[0.55em]"><Slot arr={n.lower} container={c("lower")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="i=1" /></span>
          </span>
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="ml-[0.15em]" />
        </span>
      );

    case "lim":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="inline-flex flex-col items-center text-amber-200">
            <span className="text-[0.95em] leading-none">lim</span>
            <span className="text-[0.55em]"><Slot arr={n.sub} container={c("sub")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="x→a" /></span>
          </span>
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="ml-[0.15em]" />
        </span>
      );

    case "deriv":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="inline-flex flex-col items-center mr-[0.15em]">
            <span className="text-[0.7em]">d{n.order === 2 ? "²" : ""}</span>
            <span className="block w-full h-[1.5px] bg-current my-[1px]" />
            <span className="text-[0.7em]">d<Slot arr={n.varName} container={c("varName")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="x" />{n.order === 2 ? "²" : ""}</span>
          </span>
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} />
        </span>
      );

    case "partial":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="inline-flex flex-col items-center mr-[0.15em]">
            <span className="text-[0.7em]">∂</span>
            <span className="block w-full h-[1.5px] bg-current my-[1px]" />
            <span className="text-[0.7em]">∂<Slot arr={n.varName} container={c("varName")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} placeholder="x" /></span>
          </span>
          <Slot arr={n.body} container={c("body")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} />
        </span>
      );

    case "func":
      return (
        <span className="inline-flex items-center align-middle">
          <span className="text-amber-200 mr-[0.05em]">{n.name}</span>
          <span className="text-amber-200/80">(</span>
          <Slot arr={n.arg} container={c("arg")} cursor={opts.cursor} onFocus={opts.onFocus} readOnly={opts.readOnly} className="px-[0.1em]" />
          <span className="text-amber-200/80">)</span>
        </span>
      );

    case "matrix":
      return (
        <span className="inline-flex items-center align-middle text-amber-200">
          [matrix]
        </span>
      );
  }
};

interface MathRenderProps {
  sessionId: string;
  nodes: Node[];
  cursor: Cursor | null;
  onFocus: (c: Container, index: number) => void;
  readOnly?: boolean;
}

export const MathRender = ({ sessionId, nodes, cursor, onFocus, readOnly }: MathRenderProps) => {
  const root: Container = { sessionId, nodeId: null, slot: null };
  return (
    <Slot
      arr={nodes}
      container={root}
      cursor={cursor}
      onFocus={onFocus}
      readOnly={readOnly}
      placeholder="ENTER YOUR EQUATION"
      className="text-3xl md:text-4xl font-medium tracking-wide"
    />
  );
};

export default MathRender;
