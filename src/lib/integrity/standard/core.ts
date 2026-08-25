import type { RequirementDomain } from "../types";

export const platformCore: RequirementDomain = {
  key: "PLAT",
  title: "Platform Core & Navigation",
  summary:
    "The shell every other feature loads inside: router, root layout, session provider, error handling and the entry route.",
  coverage:
    "Built from src/router.tsx, src/routes/__root.tsx, src/start.ts and the full route tree (255 route files enumerated). Runtime behaviour of individual pages is covered in their own domains.",
  requirements: [
    {
      id: "PLAT-001",
      name: "Single router, TanStack file routes",
      category: "Platform Core",
      source: "code-evidenced; TanStack Start template constraint",
      requirement:
        "MathGPL uses one router (TanStack Router, file-based routes under src/routes). No second routing system may be introduced.",
      behaviour: [
        "Every page is reachable through a file in src/routes.",
        "src/routeTree.gen.ts is generated, never hand-edited.",
        "Root layout wraps all pages through a single <Outlet />.",
      ],
      implementation: {
        files: ["src/router.tsx", "src/routes/__root.tsx", "src/start.ts", "src/server.ts"],
        symbols: ["createRouter", "Route (__root)"],
        routes: ["/"],
      },
      validation: [
        { kind: "module", target: "src/router.tsx", expects: ["createRouter"] },
        { kind: "route", target: "/" },
      ],
      restorationSource: "src/router.tsx + src/routes/__root.tsx (current, PASS)",
      status: "PASS",
      permanent: "PENDING",
    },
    {
      id: "PLAT-002",
      name: "Every account lands on the Rotating Building homepage",
      category: "Platform Core",
      source: "mem://index.md Core rule: 'Every account lands on the Rotating Building homepage (/) after login — never a dashboard.'",
      requirement:
        "After sign-in the entry route is '/', which renders the rotating building. Dashboards are entered from there.",
      behaviour: [
        "Sign-in never redirects straight to a dashboard.",
        "Switching workspace returns the person to '/' (the new workspace's building).",
        "Role dispatch happens from /home, not from '/'.",
      ],
      implementation: {
        files: [
          "src/routes/index.tsx",
          "src/routes/home/index.tsx",
          "src/pages/accounts/HomeDispatcher.tsx",
          "src/lib/accounts/useWorkspace.ts",
          "src/lib/accounts/roles.ts",
        ],
        symbols: ["HomeDispatcher", "useWorkspace().switchTo", "WORKSPACE_PATH"],
        routes: ["/", "/home"],
      },
      dependencies: ["RB-001", "WS-002", "ACCT-003"],
      validation: [
        { kind: "route", target: "/" },
        { kind: "route", target: "/home" },
        {
          kind: "behaviour",
          target: "Sign in, confirm the landing page is the rotating building at '/'",
        },
      ],
      restorationSource:
        "useWorkspace().switchTo redirect to '/' + memory Core rule (behaviour recorded, no archived code snapshot)",
      status: "PASS",
      permanent: "PENDING",
    },
    {
      id: "PLAT-003",
      name: "One session for the whole platform",
      category: "Platform Core",
      source:
        "Decision recorded in src/lib/auth/AuthProvider.tsx header: pages must not run their own onAuthStateChange + redirect.",
      requirement:
        "A single AuthProvider owns the Supabase session; pages read it from context and never redirect before `ready` is true.",
      behaviour: [
        "Session restoration has a timeout and a retry.",
        "No page performs its own auth redirect while the session is still restoring.",
        "Signing in once authenticates every surface.",
      ],
      implementation: {
        files: ["src/lib/auth/AuthProvider.tsx", "src/lib/async/withTimeout.ts"],
        symbols: ["AuthProvider", "useAuth"],
      },
      dependencies: ["AUTH-001", "AUTH-004"],
      validation: [
        { kind: "module", target: "src/lib/auth/AuthProvider.tsx", expects: ["AuthProvider", "useAuth"] },
        {
          kind: "manual",
          target: "Confirm no page-level onAuthStateChange redirect has been reintroduced",
        },
      ],
      restorationSource: "src/lib/auth/AuthProvider.tsx (current, PASS)",
      status: "PASS",
      permanent: "PENDING",
    },
    {
      id: "PLAT-004",
      name: "Head metadata per content route",
      category: "Platform Core",
      source: "code-evidenced; platform SEO standard",
      requirement:
        "Each content route defines its own head() with a unique title, description and Open Graph/Twitter fields.",
      behaviour: [
        "No route uses a placeholder title.",
        "og:type and twitter:card are set.",
      ],
      implementation: { files: ["src/routes/**/index.tsx"], symbols: ["head()"] },
      validation: [
        { kind: "manual", target: "Spot-check public routes for unique head() metadata" },
      ],
      restorationSource: "NONE — per-route content, no single source",
      // Measured 2026-08-25: 147 route files define no head() at all and 8 titles
      // are duplicated across routes, so this cannot be recorded as PASS without
      // an approved metadata pass over those routes.
      status: "PARTIAL",
      severity: "LOW",
      permanent: "PENDING",
      notes:
        "PARTIAL, measured 2026-08-25 (no longer UNKNOWN — the route-by-route sweep was run): the routes that do define head() carry unique titles, descriptions and Open Graph/Twitter fields, but 147 route files define no head() at all and 8 titles are duplicated. Clearing this requires an approved metadata pass over those routes.",
    },
    {
      id: "PLAT-005",
      name: "Status and health page",
      category: "Platform Core",
      source:
        "Approved in 'MATHSGPL — ACCESS, RELIABILITY & ZERO-SINGLE-POINT-OF-FAILURE SYSTEM' (deep health monitoring at /status).",
      requirement: "A /status page reports live platform health without requiring sign-in.",
      behaviour: [
        "Checks database reachability, auth and key services.",
        "Reachable when the app itself is degraded.",
      ],
      implementation: {
        files: ["src/routes/status.tsx", "src/pages/StatusPage.tsx", "src/lib/diagnostics"],
        routes: ["/status"],
      },
      dependencies: ["STAB-001"],
      validation: [{ kind: "route", target: "/status" }],
      restorationSource: "src/pages/StatusPage.tsx (current)",
      status: "PASS",
      permanent: "PENDING",
    },
    {
      id: "PLAT-006",
      name: "Connection help page",
      category: "Platform Core",
      source: "Approved in the access/trust work ('This Connection Is Not Private' issue).",
      requirement:
        "A /help/connection page explains browser/connection warnings and how to reach the site safely.",
      behaviour: ["Publicly reachable", "Explains certificate/DNS symptoms in plain language"],
      implementation: {
        files: ["src/routes/help/connection.tsx", "src/pages/help/ConnectionHelpPage.tsx"],
        routes: ["/help/connection"],
      },
      validation: [{ kind: "route", target: "/help/connection" }],
      restorationSource: "src/pages/help/ConnectionHelpPage.tsx (current)",
      status: "PASS",
      permanent: "PENDING",
    },
    {
      id: "PLAT-007",
      name: "Legal and support pages",
      category: "Platform Core",
      source: "code-evidenced; required for payments/publishing",
      requirement: "Terms, privacy, refund policy and support pages exist and are publicly reachable.",
      behaviour: ["Reachable without sign-in", "Linked from the public site"],
      implementation: {
        files: [
          "src/routes/terms/index.tsx",
          "src/routes/privacy/index.tsx",
          "src/routes/refund-policy/index.tsx",
          "src/routes/support/index.tsx",
          "src/pages/legal/LegalPage.tsx",
          "src/pages/legal/RefundPolicy.tsx",
          "src/pages/legal/Support.tsx",
        ],
        routes: ["/terms", "/privacy", "/refund-policy", "/support"],
      },
      validation: [
        { kind: "route", target: "/terms" },
        { kind: "route", target: "/privacy" },
        { kind: "route", target: "/refund-policy" },
        { kind: "route", target: "/support" },
      ],
      restorationSource: "current route files",
      status: "PASS",
      permanent: "PENDING",
    },
  ],
};
