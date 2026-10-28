import { LogOut } from "lucide-react";
import LanguageSelector from "@/components/i18n/LanguageSelector";
import AccountMenu from "@/components/academy/AccountMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import WorkspaceSwitcher from "@/components/accounts/WorkspaceSwitcher";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useSignOut } from "@/lib/auth/signOutEverywhere";

const AcademyTopBar = () => {
  const { user, ready } = useAuth();
  const signOutEverywhere = useSignOut();
  const t = useT();

  const handleSignOut = async () => {
    // Full teardown of the previous account, then the sign-in page.
    await signOutEverywhere();
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-end gap-3 p-4 sm:gap-6 sm:p-6">
      <div className="pointer-events-auto flex items-center gap-2">
        <LanguageSelector compact />
        <WorkspaceSwitcher />
        <NotificationBell />
        <AccountMenu />
        {ready && user && (
          <button
            type="button"
            onClick={handleSignOut}
            aria-label={t("auth_log_out")}
            className="inline-flex items-center gap-2 rounded-full border border-rose-400/60 bg-background/55 px-4 py-2 text-sm font-medium text-rose-200 shadow-[0_4px_22px_hsl(var(--background)/0.6)] backdrop-blur transition hover:border-rose-400 hover:bg-rose-500/20 sm:px-5 sm:text-base"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t("auth_log_out")}</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default AcademyTopBar;
