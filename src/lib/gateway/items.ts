/**
 * The master list of student-access items a teacher or school can put inside a
 * gateway plan. These are not new features — every item already exists in the
 * platform. The gateway is an access-control layer over them, nothing more.
 */
export type GatewayItem =
  | "class_notes"
  | "smartboard"
  | "assignment"
  | "adventure"
  | "gallery"
  | "reports"
  | "courses";

export const GATEWAY_ITEMS: { id: GatewayItem; label: string; blurb: string }[] = [
  { id: "class_notes", label: "Class Notes", blurb: "The lesson notes shared with the class." },
  { id: "smartboard", label: "Smartboard", blurb: "Live and saved SmartBoard work." },
  { id: "assignment", label: "Assignment", blurb: "Set work, classwork and homework." },
  { id: "adventure", label: "Adventure", blurb: "Adventure games and races." },
  { id: "gallery", label: "Gallery", blurb: "Awards, rewards and the class gallery." },
  { id: "reports", label: "Reports", blurb: "Progress and trend reports." },
  { id: "courses", label: "Courses", blurb: "Courses and Skill Builder paths." },
];

export const itemLabel = (id: string): string =>
  GATEWAY_ITEMS.find((item) => item.id === id)?.label ?? id;

export const ALL_ITEM_IDS: GatewayItem[] = GATEWAY_ITEMS.map((item) => item.id);

export type GatewaySlot = "free" | "pro" | "third";
export type GatewayOwnerKind = "teacher" | "school";

/** The three slots every teacher and school owns, and how they start out. */
export const SLOT_SEED: Record<
  GatewaySlot,
  { name: string; description: string; items: GatewayItem[]; price: number | null; published: boolean }
> = {
  free: {
    name: "Free",
    description: "A starting place for every student who joins.",
    items: ["class_notes", "assignment"],
    price: 0,
    published: true,
  },
  pro: {
    name: "Pro",
    description: "Everything in the workspace.",
    items: ALL_ITEM_IDS,
    price: null,
    published: false,
  },
  third: {
    name: "Premium",
    description: "",
    items: [],
    price: null,
    published: false,
  },
};

export const SLOT_ORDER: GatewaySlot[] = ["free", "pro", "third"];

export const money = (amount: number | null | undefined, currency = "GBP"): string => {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `£${value.toFixed(2)}`;
  }
};
