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
import {
  connectionError,
  matchedCodeLabel,
  resolveAccountCode,
  type ResolvedCode,
} from "@/lib/connections/connections";
import { useChildren, useConnectChild } from "@/lib/family/useFamily";

/**
 * A parent introducing one of their children to a school or a teacher.
 *
 * The parent only starts the introduction. The school or teacher accepts, and
 * then the child confirms in their own inbox — nothing is live until both have.
 */
const ConnectChildDialog = ({ trigger }: { trigger?: React.ReactNode }) => {
  const { children: kids } = useChildren();
  const { connectChild, connecting } = useConnectChild();

  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState<string>("");
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [found, setFound] = useState<ResolvedCode | null>(null);

  const child = kids.find((k) => k.childUserId === childId) ?? kids[0] ?? null;
  const relation =
    found?.role === "school" ? "parent_school" : found?.role === "teacher" ? "parent_teacher" : null;

  const reset = () => {
    setCode("");
    setFound(null);
  };

  const look = async () => {
    setLooking(true);
    setFound(null);
    try {
      const account = await resolveAccountCode(code);
      if (!account) {
        toast({
          title: "No account found",
          description: "Check the School Code, MathGPL ID or Share Code and try again.",
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
    if (!found || !relation || !child) return;
    try {
      await connectChild({ childUserId: child.childUserId, targetUserId: found.userId, relation });
      toast({
        title: "Request sent",
        description: `${found.displayName} has to accept, then ${child.displayName} confirms it in their own account.`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast({ title: "Could not send request", description: connectionError(error), variant: "destructive" });
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
            <UserPlus className="mr-2 h-4 w-4" /> Connect a child
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a child to a school or teacher</DialogTitle>
          <DialogDescription>
            Choose your child, then enter the School Code, MathGPL ID or Share Code you were given. The
            school or teacher accepts first, and your child confirms afterwards.
          </DialogDescription>
        </DialogHeader>

        {kids.length === 0 ? (
          <p className="text-sm text-slate-600">
            Connect to your child's student account first. Then you can introduce them to a school or teacher.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="child">Child</Label>
              <select
                id="child"
                value={child?.childUserId ?? ""}
                onChange={(e) => setChildId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                {kids.map((k) => (
                  <option key={k.childUserId} value={k.childUserId}>
                    {k.displayName}
                    {k.username ? ` (@${k.username})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-code">School Code, MathGPL ID or Share Code</Label>
              <Input
                id="child-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SC/000001"
                maxLength={24}
                className="bg-white font-mono tracking-[0.2em] text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={look}
              disabled={looking || !code.trim()}
              className="min-h-[44px] w-full"
            >
              {looking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Find account
            </Button>

            {found && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{found.displayName}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  @{found.username} · {ROLE_LABEL[found.role]} · matched by {matchedCodeLabel(found.matched)}
                </p>

                {!found.acceptsRequests ? (
                  <p className="mt-2 text-sm text-slate-600">
                    This account is not accepting new connection requests at the moment.
                  </p>
                ) : relation ? (
                  <Button
                    type="button"
                    onClick={request}
                    disabled={connecting}
                    className="mt-3 min-h-[44px] w-full"
                  >
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Ask to connect {child?.displayName ?? "my child"}
                  </Button>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    A child can only be introduced to a school or a teacher.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConnectChildDialog;
