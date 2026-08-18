// Inline picture/video node for the lesson note. Pasted or inserted from the
// Emoji Library, so a teacher's own artwork sits inside the text like an emoji.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { emojiMediaUrl } from "@/lib/lessonnotes/emojiItems";

function EmojiMediaView({ node, selected }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const kind = String(node.attrs.kind ?? "image");
  const height = Number(node.attrs.height) || 48;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void emojiMediaUrl(src).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block align-middle"
      style={{
        outline: selected ? "2px solid hsl(var(--primary))" : "none",
        borderRadius: 6,
      }}
    >
      {!url ? (
        <span
          className="inline-block animate-pulse rounded bg-muted/50 align-middle"
          style={{ width: height, height }}
          aria-hidden
        />
      ) : kind === "video" ? (
        <video
          src={url}
          muted
          loop
          autoPlay
          playsInline
          style={{ height, borderRadius: 6 }}
          className="align-middle"
        />
      ) : (
        <img
          src={url}
          alt={String(node.attrs.alt ?? "")}
          style={{ height, borderRadius: 6 }}
          className="align-middle"
          draggable={false}
        />
      )}
    </NodeViewWrapper>
  );
}

export const EmojiMedia = Node.create({
  name: "emojiMedia",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      kind: { default: "image" },
      height: { default: 48 },
      alt: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-emoji-media]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-emoji-media": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmojiMediaView);
  },
});

export default EmojiMedia;
