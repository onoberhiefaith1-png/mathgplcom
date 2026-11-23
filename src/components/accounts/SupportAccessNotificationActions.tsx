import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSupportAccess } from "@/lib/accounts/useSupportAccess";
import { useToast } from "@/hooks/use-toast";

/** Allow / Deny on a support-access request notification. */
const SupportAccessNotificationActions = ({ requestId }: { requestId: string }) => {
  const { user } = useAuth();
  const { respond, saving, pending } = useSupportAccess(user?.id);
  const { toast } = useToast();
  const [done, setDone] = useState<"allowed" | "denied" | null>(null);
  const waiting = pending.some((row) => row.id === requestId);

  if (done) {
    return (
      <p className="rounded-xl border border-border bg-muted p-3 text-sm text-card-foreground">
        {done === "allowed"
          ? "You allowed access. You can turn it off any time on your account page."
          : "You denied this request."}
      </p>
    );
  }
  if (!waiting) return null;

  const answer = async (status: "allowed" | "denied") => {
    try {
      await respond(requestId, status);
      setDone(status);
      toast({
        title: status === "allowed" ? "Access allowed" : "Request denied",
      });
    } catch (error) {
      toast({
        title: "Could not answer that request",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="min-h-[44px]" disabled={saving} onClick={() => void answer("allowed")}>
        Allow
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px]"
        disabled={saving}
        onClick={() => void answer("denied")}
      >
        Deny
      </Button>
    </div>
  );
};

export default SupportAccessNotificationActions;
