import { useIdleSignOut } from "@/lib/auth/useIdleSignOut";

/** Mounted once at the app root: signs an inactive person out after 15 minutes. */
const IdleSignOutWatcher = () => {
  useIdleSignOut();
  return null;
};

export default IdleSignOutWatcher;
