import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { claimUsername } from "@/lib/community/community";
import { USERNAME_RULES, isValidUsername } from "@/lib/community/types";

/**
 * No second account: the only extra thing Community needs is a unique
 * username, which becomes the member's creator identity.
 */
const UsernameDialog = ({
  open,
  onOpenChange,
  onDone,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
  initial?: string | null;
}) => {
  const [name, setName] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!isValidUsername(name)) {
      toast({ title: "Choose a valid username", description: USERNAME_RULES, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await claimUsername(name);
      toast({ title: "Welcome to MathGPL Community", description: `You are @${name.trim()}` });
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not save username",
        description: String((e as Error)?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> {initial ? "Change your username" : "Pick your creator username"}
          </DialogTitle>
          <DialogDescription>
            Everything you publish in MathGPL Community is shown under this name. {USERNAME_RULES}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <span className="text-lg text-muted-foreground">@</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
            placeholder="mrs_okafor"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-base outline-hidden focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save username
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UsernameDialog;
