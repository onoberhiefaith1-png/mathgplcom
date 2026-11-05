import { supabase } from "@/integrations/supabase/client";

export class ClassroomAudioError extends Error {
  code: string;
  constructor(message: string, code = "not_connected") {
    super(message);
    this.name = "ClassroomAudioError";
    this.code = code;
  }
}

export type AudioPayload = {
  error?: string;
  code?: string;
  url?: string;
  token?: string;
  speakerId?: string | null;
  moderatorId?: string | null;
  studentsMuted?: boolean;
  reset?: boolean;
};

export async function requestClassroomAudio(action: "token" | "control", body: object): Promise<AudioPayload> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new ClassroomAudioError("Sign in required", "unauthorized");
  const response = await fetch(`/api/classroom-audio/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as AudioPayload | null;
  if (!response.ok) {
    throw new ClassroomAudioError(
      typeof payload?.error === "string" ? payload.error : "Audio not connected",
      typeof payload?.code === "string" ? payload.code : "not_connected",
    );
  }
  return payload ?? {};
}
