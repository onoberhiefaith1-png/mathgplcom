/**
 * Community mode.
 *
 * MathGPL Community is not a second application — it is the *same* workspace
 * rendered from someone else's shared content. Any page wrapped by
 * `CommunityModeProvider` must hide every authoring control (create, generate,
 * edit, rename, duplicate, delete) and keep navigation inside `/community`.
 */
import { createContext, useContext, type ReactNode } from "react";

const CommunityModeContext = createContext(false);

export const CommunityModeProvider = ({ children }: { children: ReactNode }) => (
  <CommunityModeContext.Provider value={true}>{children}</CommunityModeContext.Provider>
);

export const useCommunityMode = () => {
  const isCommunity = useContext(CommunityModeContext);
  return {
    isCommunity,
    /** Keeps a workspace path inside the community mirror when in community mode. */
    linkTo: (path: string) => (isCommunity ? `/community${path}` : path),
  };
};

export type CommunitySection = { path: string; label: string };

/**
 * Community has no building editor and no asset library: the rotating building
 * is only the entrance. Everything mirrored here is teaching material.
 */

/** Community → the network → … */
export const TEACHING_SECTIONS: readonly CommunitySection[] = [
  { path: "/community/lesson-notes", label: "Lesson Notes" },
  { path: "/community/classes", label: "Classes" },
  { path: "/community/adventure", label: "Adventure" },
  { path: "/community/courses", label: "Courses" },
] as const;

/** Every mirrored section, in navigation order. */
export const COMMUNITY_SECTIONS: readonly CommunitySection[] = [...TEACHING_SECTIONS] as const;
