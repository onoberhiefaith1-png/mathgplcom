import { useRef, useState } from "react";
import { Copy, Loader2, MoreVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { duplicateAcademiaBranch, type AcademiaDuplicateKind } from "@/lib/academia/duplication";

type Props = { kind: AcademiaDuplicateKind; id: string; name: string };

/** Also used inside the existing Subject menu, so that card has one ⋯ menu. */
export function AcademiaDuplicateItem({ kind, id, name }: Props) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const duplicate = async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      const result = await duplicateAcademiaBranch(kind, id);
      toast.success(`Created ${result.name}`, { description: "Includes everything inside. Changes to either copy stay separate." });
      // A refresh error must not turn a committed copy into a reported failure.
      await Promise.allSettled([
        qc.invalidateQueries({ queryKey: ["academia-tree"] }),
        qc.invalidateQueries({ queryKey: ["academia-sessions"] }),
        qc.invalidateQueries({ queryKey: ["academia-mine"] }),
        qc.invalidateQueries({ predicate: query => String(query.queryKey[0]).includes("mcq") }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm the copy. Try again.");
    } finally {
      running.current = false;
      setPending(false);
    }
  };
  return (
    <DropdownMenuItem disabled={pending} onSelect={event => { event.preventDefault(); void duplicate(); }}
      aria-label={`Duplicate ${name}`}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
      {pending ? "Duplicating…" : "Duplicate"}
    </DropdownMenuItem>
  );
}

export default function AcademiaDuplicateMenu(props: Props) {
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <span onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`${props.kind} options for ${props.name}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-current opacity-80 hover:bg-foreground/10 hover:opacity-100">
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <AcademiaDuplicateItem {...props} />
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
