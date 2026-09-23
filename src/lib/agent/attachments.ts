/**
 * Files a teacher hands to Aura — a photo of a worksheet, a scanned past paper,
 * a PDF of notes.
 *
 * The file itself lives in the private `aura-attachments` area, inside a folder
 * named after the teacher, so nobody else can open it. The row in
 * `aura_attachments` is what Aura reads to know the file exists.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "aura-attachments";

/** What Aura can actually look at: pictures and PDFs. */
export const AURA_FILE_TYPES = "image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.heic";

export type AuraAttachment = {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  path: string;
  createdAt: string;
};

const extensionOf = (name: string) => (name.split(".").pop() || "bin").toLowerCase();

const readable = (mime: string) => mime.startsWith("image/") || mime === "application/pdf";

/** Store one file and record it, returning the row Aura will be told about. */
export async function uploadAuraAttachment(file: File): Promise<AuraAttachment> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sign in before giving me a file.");

  const mime = file.type || "application/octet-stream";
  if (!readable(mime)) {
    throw new Error(
      "I can read photos and PDFs. For a Word document, save it as a PDF first and give me that.",
    );
  }

  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionOf(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (error) throw error;

  const { data, error: rowError } = await supabase
    .from("aura_attachments")
    .insert({ owner_id: uid, path, name: file.name, mime, size_bytes: file.size })
    .select("id, name, mime, size_bytes, path, created_at")
    .single();
  if (rowError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw rowError;
  }

  return {
    id: data.id,
    name: data.name,
    mime: data.mime,
    sizeBytes: Number(data.size_bytes ?? 0),
    path: data.path,
    createdAt: data.created_at,
  };
}

/** The teacher's recent files, newest first. */
export async function listAuraAttachments(limit = 10): Promise<AuraAttachment[]> {
  const { data, error } = await supabase
    .from("aura_attachments")
    .select("id, name, mime, size_bytes, path, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes ?? 0),
    path: row.path,
    createdAt: row.created_at,
  }));
}

/** Remove a file and its record. */
export async function removeAuraAttachment(attachment: AuraAttachment): Promise<void> {
  await supabase.storage.from(BUCKET).remove([attachment.path]);
  await supabase.from("aura_attachments").delete().eq("id", attachment.id);
}
