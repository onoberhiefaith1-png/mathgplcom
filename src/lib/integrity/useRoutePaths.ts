/**
 * Every route path the router knows about, used by `route` checks.
 */
import { useMemo } from "react";
import { useRouter } from "@tanstack/react-router";

export function useRoutePaths(): Set<string> {
  const router = useRouter();
  return useMemo(() => {
    const paths = Object.values(router.routesById ?? {}).map(
      (r) => (r as { fullPath?: string }).fullPath ?? "",
    );
    return new Set(paths.filter(Boolean));
  }, [router]);
}
