import { useLocation } from "@/lib/router-compat";
import type { ReactNode } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import StudentNav from "./StudentNav";

/**
 * The Student Account shell. It adds the hybrid navigation (bottom bar on
 * phones, rail on tablets, nothing on desktop) and the padding each shape
 * needs, without touching any page's own content or logic.
 *
 * Full-bleed surfaces — the SmartBoard, games and adventure canvases — opt out
 * of the padding so they keep the whole viewport.
 */
const FULL_BLEED = [/\/smartboard(\/|$)/, /\/assessment\/[^/]+/, /\/games\/[^/]+\/play/, /\/game\/[^/]+/, /\/adventures?(\/|$)/];

const StudentShell = ({ children }: { children: ReactNode }) => {
  const bp = useBreakpoint();
  const location = useLocation();
  const fullBleed = FULL_BLEED.some((re) => re.test(location.pathname ?? ""));

  if (bp === "desktop") return <>{children}</>;

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      style={{
        paddingLeft: bp === "tablet" ? 80 : 0,
        paddingBottom: bp === "phone" && !fullBleed ? "3.5rem" : 0,
      }}
    >
      {children}
      {!fullBleed && <StudentNav />}
    </div>
  );
};

export default StudentShell;
