/**
 * ACADEMY SHOWROOM — what you see once you step into a room.
 *
 * Drill-down: Room → Category → Topic → Subtopic → Products. Every level is
 * database-driven, so an empty level says what is missing instead of showing
 * invented placeholders. Products are references: opening one goes to the
 * canonical product, nothing is copied here.
 */
import { ArrowLeft, ChevronRight, Play, Star } from "lucide-react";
import { Link } from "@/lib/router-compat";
import type {
  AcademyCategory,
  AcademyPlacement,
  AcademyProduct,
  AcademyRoom,
  AcademySubtopic,
  AcademyTopic,
} from "@/lib/academy/types";
import { productRoute } from "@/lib/academy/types";

const KIND_LABEL: Record<string, string> = {
  course: "Course",
  game: "Game",
  adventure: "Adventure",
  assessment: "Assessment",
};

const Card = ({
  title,
  description,
  meta,
  onClick,
}: {
  title: string;
  description: string;
  meta: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-[92px] w-full flex-col justify-between rounded-2xl border border-border/70 bg-card/80 p-4 text-left shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-card"
  >
    <span className="text-sm font-semibold text-foreground">{title}</span>
    {description ? (
      <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</span>
    ) : null}
    <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
      {meta} <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
    </span>
  </button>
);

const Empty = ({ what }: { what: string }) => (
  <p className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-5 text-sm text-muted-foreground">
    Nothing here yet — no {what} has been added to this section.
  </p>
);

const ProductCard = ({
  placement,
  product,
}: {
  placement: AcademyPlacement;
  product?: AcademyProduct;
}) => {
  const title = placement.title_override || product?.title || KIND_LABEL[placement.product_kind];
  const description = placement.description_override || product?.description || "";
  const route = productRoute(placement.product_kind, placement.product_id);

  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm backdrop-blur">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            {KIND_LABEL[placement.product_kind]}
          </span>
          {placement.is_featured && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-500">
              <Star className="h-3 w-3" /> Featured
            </span>
          )}
          {placement.badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {placement.badge}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {route ? (
        <Link
          to={route}
          className="mt-3 inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Play className="h-4 w-4" /> Open
        </Link>
      ) : (
        <p className="mt-3 text-[11px] font-medium text-muted-foreground">
          Runs inside your class — open it from your class page so your progress is recorded.
        </p>
      )}
    </div>
  );
};

export interface ShowroomPanelProps {
  room: AcademyRoom;
  category: AcademyCategory | null;
  topic: AcademyTopic | null;
  subtopic: AcademySubtopic | null;
  catalogue: AcademyProduct[];
  onSelectCategory: (id: string | null) => void;
  onSelectTopic: (id: string | null) => void;
  onSelectSubtopic: (id: string | null) => void;
  onLeaveRoom: () => void;
}

const ShowroomPanel = ({
  room,
  category,
  topic,
  subtopic,
  catalogue,
  onSelectCategory,
  onSelectTopic,
  onSelectSubtopic,
  onLeaveRoom,
}: ShowroomPanelProps) => {
  const visible = <T extends { is_visible: boolean }>(rows: T[]) => rows.filter((r) => r.is_visible);

  const back = () => {
    if (subtopic) return onSelectSubtopic(null);
    if (topic) return onSelectTopic(null);
    if (category) return onSelectCategory(null);
    onLeaveRoom();
  };

  const crumbs = [room.name, category?.name, topic?.name, subtopic?.name].filter(Boolean) as string[];

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 top-16 mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-background/92 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border/70 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {crumbs.map((c, i) => (
            <span key={`${c}-${i}`}>
              {i > 0 && <span className="px-1.5 text-muted-foreground/60">/</span>}
              <span className={i === crumbs.length - 1 ? "font-semibold text-foreground" : ""}>{c}</span>
            </span>
          ))}
        </nav>
      </div>

      <div className="grid flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
        {!category &&
          (visible(room.categories).length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Empty what="section" />
            </div>
          ) : (
            visible(room.categories).map((c) => (
              <Card
                key={c.id}
                title={c.name}
                description={c.description}
                meta={`${visible(c.topics).length} topics`}
                onClick={() => onSelectCategory(c.id)}
              />
            ))
          ))}

        {category &&
          !topic &&
          (visible(category.topics).length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Empty what="topic" />
            </div>
          ) : (
            visible(category.topics).map((t) => (
              <Card
                key={t.id}
                title={t.name}
                description={t.description}
                meta={`${visible(t.subtopics).length} subtopics`}
                onClick={() => onSelectTopic(t.id)}
              />
            ))
          ))}

        {topic &&
          !subtopic &&
          (visible(topic.subtopics).length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Empty what="subtopic" />
            </div>
          ) : (
            visible(topic.subtopics).map((s) => (
              <Card
                key={s.id}
                title={s.name}
                description={s.description}
                meta={`${visible(s.placements).length} products`}
                onClick={() => onSelectSubtopic(s.id)}
              />
            ))
          ))}

        {subtopic &&
          (visible(subtopic.placements).length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Empty what="course, game or activity" />
            </div>
          ) : (
            [...visible(subtopic.placements)]
              .sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.position - b.position)
              .map((p) => (
                <ProductCard
                  key={p.id}
                  placement={p}
                  product={catalogue.find((c) => c.kind === p.product_kind && c.id === p.product_id)}
                />
              ))
          ))}
      </div>
    </div>
  );
};

export default ShowroomPanel;
