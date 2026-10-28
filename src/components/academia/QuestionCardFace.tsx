import MediaImg from "@/components/academia/MediaImg";
import { ReadableMath } from "@/components/gameslate/ReadableMath";
import type { QuestionDesign } from "@/lib/academia/questionDesign.functions";

/** The designed face of one Academia question: a teacher picture, or the
 * instruction in bold with the maths set large and centred. */
const QuestionCardFace = ({
  number, design, title, imagePath, size = "card",
}: {
  number?: number;
  design?: QuestionDesign | null;
  title: string;
  imagePath?: string | null;
  size?: "card" | "hero";
}) => {
  const hero = size === "hero";
  const body = (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/15 via-card to-background px-5 text-center ${hero ? "py-10" : "py-4"}`}>
      {design?.instruction ? (
        <p className={`font-bold uppercase tracking-wide text-primary ${hero ? "text-base" : "text-[11px]"}`}>{design.instruction}</p>
      ) : null}
      <div className={`font-bold text-foreground ${hero ? "text-3xl sm:text-4xl" : "text-lg"} line-clamp-3`}>
        <ReadableMath src={design?.math || title} />
      </div>
    </div>
  );
  return (
    <div className={`relative w-full overflow-hidden ${hero ? "rounded-2xl border border-border" : ""} ${hero ? "" : "aspect-[4/3]"} bg-muted`}>
      {imagePath ? <MediaImg path={imagePath} className="h-full w-full object-cover" fallback={body} /> : body}
      {number != null && (
        <span className="absolute left-2 top-2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] font-semibold">
          Question {number}
        </span>
      )}
    </div>
  );
};

export default QuestionCardFace;
