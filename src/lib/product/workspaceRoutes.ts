// Product routing + terminology.
//
// Teaching Hub and MathGPL Life are two independent products that share the
// same educational engines. A page mounted under `/live/...` must never link
// back into Teaching Hub, and it must speak Live language:
//
//   Class      → Session        Students   → Audience
//   Assignment → Challenge      Adventure  → Game Challenge
//
// The engines themselves are untouched — only the shell around them changes.

export type ProductId = "teaching-hub" | "live";

export const currentProduct = (pathname = typeof window === "undefined" ? "" : window.location.pathname): ProductId =>
  pathname.startsWith("/live") || pathname.startsWith("/c/") ? "live" : "teaching-hub";

/** Base path for class-scoped routes in the active product. */
export const classRoot = (pathname?: string): string =>
  currentProduct(pathname) === "live" ? "/live/workspace" : "/teaching-hub/classes";

export type ProductTerms = {
  space: string;
  spacePlural: string;
  people: string;
  person: string;
  assignment: string;
  assignments: string;
  adventure: string;
  adventures: string;
  home: string;
  homePath: string;
};

const TEACHING: ProductTerms = {
  space: "Class",
  spacePlural: "Classes",
  people: "Students",
  person: "Student",
  assignment: "Assignment",
  assignments: "Assignments",
  adventure: "Adventure",
  adventures: "Adventures",
  home: "Teaching Hub",
  homePath: "/teaching-hub",
};

const LIVE: ProductTerms = {
  space: "Session",
  spacePlural: "Sessions",
  people: "Audience",
  person: "Player",
  assignment: "Challenge",
  assignments: "Challenges",
  adventure: "Game Challenge",
  adventures: "Game Challenges",
  home: "MathGPL Life",
  homePath: "/live",
};

export const productTerms = (pathname?: string): ProductTerms =>
  currentProduct(pathname) === "live" ? LIVE : TEACHING;
