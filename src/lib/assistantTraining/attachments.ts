// Client-safe attachment description. Honest about what the system can study.
export type TrainingAttachment = { path: string; name: string; mime: string; size: number };

export type AttachmentReading = "studied" | "name-only";

/** Images are sent to the model; videos and documents are not read (name only). */
export function attachmentReading(mime: string): AttachmentReading {
  return mime.startsWith("image/") ? "studied" : "name-only";
}

export function describeAttachments(list: TrainingAttachment[]): string {
  if (!list.length) return "";
  return [
    "Attachments:",
    ...list.map((a) =>
      attachmentReading(a.mime) === "studied"
        ? `- ${a.name} (image, provided for viewing)`
        : `- ${a.name} (${a.mime || "file"}) — NOT studied: only the file name is available. Do not describe its contents.`,
    ),
  ].join("\n");
}
