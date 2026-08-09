import { useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ROLE_LABEL } from "@/lib/accounts/roles";
import { useAccount } from "@/lib/accounts/useAccount";
import { relationFor, relationLabel, resolveShareCode, type ResolvedAccount } from "@/lib/connections/connections";
import { useConnectionActions } from "@/lib/connections/useConnections";

/**
 * Connect with a Share Code.
 *
 * The code identifies the other account; the relationship is decided by the two
 * account types, and nothing becomes real until the other side accepts.
 */
export const ConnectByCodeDialog = ({ trigger }: { trigger?: React.ReactNode }) => {
  const { role } = useAccount();
  const { send, sending } = useConnectionActions();

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<ResolvedAccount | null>(null);

  const relation = relationFor(role, found?.role ?? null);

  const reset = () => {
    setCode("");
    setFound(null);
  };

  const look = async () => {
    setLooking(true);
    setFound(null);
    try {
      const account = await resolveShareCode(code);
      if (!account) {
        toast({
          title: "No account found",
          description: "Check the Share Code and try again.",
          variant: "destructive",
        });
        return;
      }
      setFound(account);
    } catch (error) {
      toast({ title: "Could not look up that code", description: (error as Error).message, variant: "destructive" });
    } finally {
      setLooking(false);
    }
  };

  const request = async () => {
    if (!found || !relation) return;
    try {
      await send({ userId: found.userId, relation });
      toast({
        title: "Request sent",
        description: `${found.displayName} decides whether to accept. You'll see it under Requests.`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast({ title: "Could not send request", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" className="min-h-[44px]">
            <UserPlus className="mr-2 h-4 w-4" /> Connect with a code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect with a code</DialogTitle>
          <DialogDescription>
            Enter a School Code, a MathGPL ID (TCH/…, STU/…, SC/…, PAR/…) or a personal Share Code.
            Never share a password — only codes. We show you who it belongs to before anything is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="share-code">School Code, MathGPL ID or Share Code</Label>
            <Input
              id="share-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TCH/000001"
              maxLength={24}
              className="bg-white font-mono tracking-[0.2em] text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <Button type="button" variant="outline" onClick={look} disabled={looking || !code.trim()} className="min-h-[44px] w-full">
            {looking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Find account
          </Button>

          {found && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{found.displayName}</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {ROLE_LABEL[found.role]}
                {found.mathgplId ? <> · <span className="font-mono">{found.mathgplId}</span></> : null}
                {" "}· matched by {matchedCodeLabel(found.matched)}
              </p>

              {relation ? (
                <>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {relationLabel(relation)}
                  </p>
                  <Button type="button" onClick={request} disabled={sending} className="mt-3 min-h-[44px] w-full">
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Send connection request
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  A {role ? ROLE_LABEL[role].toLowerCase() : "this"} account and a{" "}
                  {ROLE_LABEL[found.role].toLowerCase()} account cannot be connected directly.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectByCodeDialog;
