import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AccountAvatar from "@/components/accounts/AccountAvatar";
import { useProfileSummary } from "@/lib/accounts/useProfileSummary";
import { removeAvatar, uploadAvatar } from "@/lib/accounts/avatar";

/**
 * Profile picture. It belongs to the account, so it follows the person into
 * every workspace, roster, directory and Community listing.
 */
const AvatarUploader = () => {
  const { toast } = useToast();
  const { refresh, avatarUrl } = useProfileSummary();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Picture too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await uploadAvatar(file);
      refresh();
      toast({ title: "Profile picture updated" });
    } catch (error) {
      toast({ title: "Could not upload picture", description: (error as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await removeAvatar();
      refresh();
      toast({ title: "Profile picture removed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Profile picture</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your picture appears in your workspace, in the schools you are connected to and in the Community.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <AccountAvatar size={64} />
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <Button type="button" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {avatarUrl ? "Change picture" : "Upload picture"}
        </Button>
        {avatarUrl && (
          <Button type="button" variant="outline" onClick={() => void clear()} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </Button>
        )}
      </div>
    </section>
  );
};

export default AvatarUploader;
