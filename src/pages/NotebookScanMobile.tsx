import { useEffect, useRef, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

/** Mobile-friendly page opened by scanning the editor QR.
 *  Captures a photo and broadcasts it (as a compressed data URL)
 *  over a realtime channel to the editor session. */
const NotebookScanMobile = () => {
  const { code } = useParams();
  const [status, setStatus] = useState<"idle" | "ready" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!code) return;
    const ch = supabase.channel(`notebook-scan-${code}`, { config: { broadcast: { ack: true } } });
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") setStatus("ready");
    });
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [code]);

  const compress = async (file: File): Promise<string> => {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.78);
  };

  const onFile = async (file: File) => {
    if (!file || !channelRef.current) return;
    setStatus("sending");
    setError("");
    try {
      const dataUrl = await compress(file);
      const res = await channelRef.current.send({
        type: "broadcast",
        event: "image",
        payload: { dataUrl, ts: Date.now() },
      });
      if (res !== "ok") throw new Error("Broadcast failed — is the notebook still open on your computer?");
      setStatus("sent");
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="max-w-sm w-full text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Notebook scan</p>
        <h1 className="text-2xl font-medium">Take a photo of the page</h1>
        <p className="text-sm text-muted-foreground">
          Your notebook is waiting. Snap the textbook page and it will appear in the notebook on your computer.
        </p>

        {status === "idle" && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Loader2 className="h-3 w-3 animate-spin" /> connecting…
          </p>
        )}

        {(status === "ready" || status === "sent" || status === "error") && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-4 text-base font-medium shadow-lg active:scale-[0.98] transition"
          >
            <Camera className="h-5 w-5" /> {status === "sent" ? "Take another" : "Open camera"}
          </button>
        )}

        {status === "sending" && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending to notebook…
          </p>
        )}
        {status === "sent" && (
          <p className="text-sm text-emerald-600 inline-flex items-center gap-2 justify-center">
            <CheckCircle2 className="h-4 w-4" /> Sent! Check your notebook.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive inline-flex items-center gap-2 justify-center">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>
    </main>
  );
};

export default NotebookScanMobile;
