/**
 * Writing a Community post.
 *
 * A post is public the moment it is published, so its text is screened first —
 * a refusal is always explained and nothing is published silently.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { POST_CATEGORIES } from "@/lib/community/posts";
import { useHashtagSuggestions } from "@/lib/community/usePosts";
import { screenCommunityText } from "@/lib/community/moderation.functions";
import type { NewPost } from "@/lib/community/posts";

const parseTags = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((part) => part.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

const PostComposer = ({
  onPublish,
  isPending,
  canPromote,
}: {
  onPublish: (post: NewPost) => void;
  isPending: boolean;
  /** Only accounts that may publish teaching material can advertise it. */
  canPromote: boolean;
}) => {
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(POST_CATEGORIES[0]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState<"none" | "image" | "video">("none");
  const [tagText, setTagText] = useState("");
  const [promotion, setPromotion] = useState(false);
  const [promotionUrl, setPromotionUrl] = useState("");
  const [checking, setChecking] = useState(false);

  const suggestions = useHashtagSuggestions(tagText.split(/[\s,]+/).pop() ?? "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setChecking(true);
    try {
      const verdict = await screenCommunityText({
        data: { fields: [{ label: "Post", value: body }] },
      });
      if (!verdict.ok) {
        toast.error(verdict.reason ?? "This post cannot be published.");
        return;
      }
      onPublish({
        body,
        category,
        mediaUrl: mediaKind === "none" ? null : mediaUrl,
        mediaKind,
        hashtags: parseTags(tagText),
        isPromotion: promotion,
        promotionUrl: promotion ? promotionUrl : null,
      });
      setBody("");
      setTagText("");
      setMediaUrl("");
      setMediaKind("none");
      setPromotion(false);
      setPromotionUrl("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish that post.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-dash-navy/40 p-5">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        placeholder="Share an update, a teaching idea, a resource you have published…"
        aria-label="Post text"
        className="w-full rounded-xl border border-white/15 bg-dash-navy/50 px-3 py-2 text-sm outline-none placeholder:text-dash-surface/40 focus:border-dash-gold/60"
      />

      <div className="flex flex-wrap gap-2">
        {POST_CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`min-h-[34px] rounded-full border px-3 text-xs transition ${
              category === value
                ? "border-dash-gold bg-dash-gold/15 font-semibold text-dash-gold"
                : "border-white/12 text-dash-surface/70 hover:text-dash-surface"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto,1fr]">
        <div className="flex gap-2">
          {(["none", "image", "video"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setMediaKind(kind)}
              className={`min-h-[38px] rounded-full border px-3 text-xs transition ${
                mediaKind === kind
                  ? "border-dash-gold text-dash-gold"
                  : "border-white/12 text-dash-surface/65"
              }`}
            >
              {kind === "none" ? "No media" : kind}
            </button>
          ))}
        </div>
        {mediaKind !== "none" && (
          <input
            value={mediaUrl}
            onChange={(event) => setMediaUrl(event.target.value)}
            placeholder={`${mediaKind} URL`}
            aria-label="Media URL"
            className="min-h-[38px] rounded-xl border border-white/15 bg-dash-navy/50 px-3 text-sm outline-none focus:border-dash-gold/60"
          />
        )}
      </div>

      <div>
        <input
          value={tagText}
          onChange={(event) => setTagText(event.target.value)}
          placeholder="Hashtags — algebra, gcse, revision"
          aria-label="Hashtags"
          className="min-h-[38px] w-full rounded-xl border border-white/15 bg-dash-navy/50 px-3 text-sm outline-none focus:border-dash-gold/60"
        />
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map(({ tag, uses }) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setTagText((prev) => {
                    const parts = prev.split(/[\s,]+/).filter(Boolean);
                    parts.pop();
                    return [...parts, tag].join(", ") + ", ";
                  })
                }
                className="rounded-full border border-white/12 px-3 py-1 text-xs text-dash-surface/70 hover:text-dash-gold"
              >
                #{tag} · {uses}
              </button>
            ))}
          </div>
        )}
      </div>

      {canPromote && (
        <div className="space-y-2 rounded-xl border border-white/10 p-3">
          <label className="flex items-center gap-2 text-xs text-dash-surface/75">
            <input
              type="checkbox"
              checked={promotion}
              onChange={(event) => setPromotion(event.target.checked)}
            />
            Mark as a promotion for something I teach or publish
          </label>
          {promotion && (
            <input
              value={promotionUrl}
              onChange={(event) => setPromotionUrl(event.target.value)}
              placeholder="Where should people go? (course, live room, profile)"
              aria-label="Promotion link"
              className="min-h-[38px] w-full rounded-xl border border-white/15 bg-dash-navy/50 px-3 text-sm outline-none focus:border-dash-gold/60"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-dash-surface/50">Posts are screened before they appear in Community.</p>
        <button
          type="submit"
          disabled={!body.trim() || isPending || checking}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-dash-gold px-5 text-sm font-semibold text-dash-navy transition hover:brightness-110 disabled:opacity-60"
        >
          {isPending || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {checking ? "Checking…" : "Post"}
        </button>
      </div>
    </form>
  );
};

export default PostComposer;
