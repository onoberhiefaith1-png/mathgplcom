// The subject card's ⋯ menu. It never lets a tap reach the card underneath.
import { MoreVertical, ListChecks } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function SubjectMenu({ subjectId, className = "" }: { subjectId: string; className?: string }) {
  const navigate = useNavigate();
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span onClick={stop} onPointerDown={stop} onKeyDown={stop} className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Subject options"
          className="grid h-7 w-7 place-items-center rounded-full text-current opacity-80 hover:bg-foreground/10 hover:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem onSelect={() => navigate({ to: "/mcq/subject/$subjectId", params: { subjectId } })}>
            <ListChecks className="mr-2 h-4 w-4" /> View Questions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
