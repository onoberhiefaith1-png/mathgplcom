import { ListChecks } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import AcademiaItemMenu from "@/components/academia/AcademiaItemMenu";
import type { AcademiaCatalogKind } from "@/lib/academia/api";

/** View Questions stays reachable for everyone who could open a subject before, without making the ⋯ menu appear on subjects a teacher does not own. */
export function AcademiaViewQuestionsButton({
  subjectId,
  name,
  onViewQuestions,
}: {
  subjectId: string;
  name: string;
  onViewQuestions?: (subjectId: string) => void;
}) {
  const navigate = useNavigate();
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <button
      type="button"
      aria-label={`View questions for ${name}`}
      data-academia-view-questions
      onClick={event => {
        stop(event);
        if (onViewQuestions) onViewQuestions(subjectId);
        else navigate({ to: "/mcq/subject/$subjectId", params: { subjectId } });
      }}
      onPointerDown={stop}
      onKeyDown={stop}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-current opacity-80 hover:bg-foreground/10 hover:opacity-100 md:h-7 md:w-7"
    >
      <ListChecks className="h-4 w-4" />
    </button>
  );
}

export type CatalogItem = { id: string; name?: string; title?: string; created_by?: string | null };

/** Shared catalog row actions for the website and the Academia app. */
export function AcademiaCatalogRowMenu({
  kind,
  item,
  userId,
  isOrgOwner,
  onViewQuestions,
}: {
  kind: AcademiaCatalogKind;
  item: CatalogItem;
  userId?: string | null;
  isOrgOwner: boolean;
  onViewQuestions?: (subjectId: string) => void;
}) {
  const name = item.name ?? item.title ?? "Item";
  return (
    <span className="flex shrink-0 items-center" data-academia-row-menu={kind} data-item-id={item.id}>
      {kind === "subject" && (
        <AcademiaViewQuestionsButton subjectId={item.id} name={name} onViewQuestions={onViewQuestions} />
      )}
      <AcademiaItemMenu
        kind={kind}
        id={item.id}
        name={name}
        createdBy={item.created_by}
        userId={userId}
        isOrgOwner={isOrgOwner}
      />
    </span>
  );
}
