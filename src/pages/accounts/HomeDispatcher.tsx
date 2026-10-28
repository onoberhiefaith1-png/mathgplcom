import { useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Loader2 } from "lucide-react";
import { useAccount } from "@/lib/accounts/useAccount";
import { HOME_PATH } from "@/lib/accounts/roles";

/**
 * Single front door: sends every signed-in account to the home screen for its
 * role, and everyone else to sign-in.
 */
const HomeDispatcher = () => {
  const navigate = useNavigate();
  const { role, userId, isLoading } = useAccount();

  useEffect(() => {
    if (isLoading) return;
    if (!userId) {
      navigate("/auth?next=/home", { replace: true });
      return;
    }
    navigate(HOME_PATH[role ?? "teacher"], { replace: true });
  }, [isLoading, userId, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening your workspace…
    </div>
  );
};

export default HomeDispatcher;
