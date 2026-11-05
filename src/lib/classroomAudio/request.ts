import { supabase } from "@/integrations/supabase/client";

export async function requestClassroomAudio(action: "token" | "control", body: object) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sign in required");
  const response = await fetch(`/api/classroom-audio/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Classroom audio request failed");
  return response.json();
}
