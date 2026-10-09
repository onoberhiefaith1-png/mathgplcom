import { useEffect } from "react";
import { useIdleSignOut } from "@/lib/auth/useIdleSignOut";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLocation } from "@/lib/router-compat";
import { rememberLastPage } from "@/lib/auth/lastPage";

/**
 * Mounted once at the app root: signs a person out after 15 minutes away, and
 * remembers their current page so signing in again returns there.
 */
const IdleSignOutWatcher = () => {
  useIdleSignOut();
  const { user } = useAuth();
  const location = useLocation();
  const path = `${location.pathname}${location.search ?? ""}`;
  useEffect(() => {
    if (user?.id) rememberLastPage(user.id, path);
  }, [user?.id, path]);
  return null;
};

export default IdleSignOutWatcher;
