// Math Objects catalog — flat inline SVG icons used as classroom visual
// language ("3 cars + 2 houses → 3x + 2y"). Each entry is a small React
// component that renders a single SVG sized by the `size` prop in CSS px.
//
// Keep visuals flat, monochrome, and scalable. Avoid cartoon detail.

import type { ReactNode } from "react";

export type CategoryId =
  | "everyday" | "money" | "probability" | "transport"
  | "animals" | "school" | "science";

export interface CategoryDef {
  id: CategoryId;
  label: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "everyday",    label: "Everyday" },
  { id: "money",       label: "Money" },
  { id: "probability", label: "Probability" },
  { id: "transport",   label: "Transport" },
  { id: "animals",     label: "Animals" },
  { id: "school",      label: "School" },
  { id: "science",     label: "Science" },
];

export interface ObjectDef {
  kind: string;
  label: string;
  category: CategoryId;
  /** Inline SVG paths drawn in currentColor on a transparent background. */
  draw: () => ReactNode;
}

// ── tiny helper to render a sized svg with consistent stroke style ───────
function svg(d: () => ReactNode, viewBox = "0 0 24 24"): () => ReactNode {
  return () => (
    <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" width="100%" height="100%">
      {d()}
    </svg>
  );
}

// All objects use simple primitives so they read clearly even at 24px.
export const OBJECTS: ObjectDef[] = [
  // Everyday
  { kind: "car",    label: "Car",    category: "everyday", draw: svg(() => (<><path d="M3 14l2-5h14l2 5v4H3z"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></>)) },
  { kind: "house",  label: "House",  category: "everyday", draw: svg(() => (<><path d="M3 11l9-7 9 7v9H3z"/><path d="M10 20v-5h4v5"/></>)) },
  { kind: "book",   label: "Book",   category: "everyday", draw: svg(() => (<><path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M4 17h15"/></>)) },
  { kind: "chair",  label: "Chair",  category: "everyday", draw: svg(() => (<><path d="M6 4v9h12V4"/><path d="M5 13h14l-2 8M5 13l2 8"/></>)) },
  { kind: "tree",   label: "Tree",   category: "everyday", draw: svg(() => (<><path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M11 16v5h2v-5"/></>)) },
  { kind: "apple",  label: "Apple",  category: "everyday", draw: svg(() => (<><path d="M12 7c-3-3-8-1-8 4 0 5 4 9 8 9s8-4 8-9c0-5-5-7-8-4z"/><path d="M12 7V4M12 4c1-1 3-1 3 0"/></>)) },
  { kind: "orange", label: "Orange", category: "everyday", draw: svg(() => (<><circle cx="12" cy="13" r="7"/><path d="M12 6V4M10 4h4"/></>)) },
  { kind: "banana", label: "Banana", category: "everyday", draw: svg(() => (<><path d="M4 14c4 6 13 5 16-2-3 1-7 0-10-3-2 0-6 1-6 5z"/></>)) },
  { kind: "ball",   label: "Ball",   category: "everyday", draw: svg(() => (<><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c4 4 4 12 0 16M12 4c-4 4-4 12 0 16"/></>)) },
  { kind: "bag",    label: "Bag",    category: "everyday", draw: svg(() => (<><path d="M5 9h14l-1 11H6z"/><path d="M9 9V6a3 3 0 016 0v3"/></>)) },
  { kind: "bottle", label: "Bottle", category: "everyday", draw: svg(() => (<><path d="M10 3h4v3l2 3v11H8V9l2-3z"/></>)) },
  { kind: "clock",  label: "Clock",  category: "everyday", draw: svg(() => (<><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></>)) },
  { kind: "phone",  label: "Phone",  category: "everyday", draw: svg(() => (<><rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="18" r="0.6" fill="currentColor"/></>)) },
  { kind: "key",    label: "Key",    category: "everyday", draw: svg(() => (<><circle cx="8" cy="12" r="3"/><path d="M11 12h10M18 12v3M21 12v2"/></>)) },
  { kind: "cup",    label: "Cup",    category: "everyday", draw: svg(() => (<><path d="M5 7h12v8a4 4 0 01-4 4H9a4 4 0 01-4-4z"/><path d="M17 9h2a2 2 0 010 4h-2"/></>)) },

  // Money
  { kind: "coin",         label: "Coin",     category: "money", draw: svg(() => (<><circle cx="12" cy="12" r="8"/><path d="M9 10h5a2 2 0 010 4H9M9 10v8"/></>)) },
  { kind: "banknote",     label: "Note",     category: "money", draw: svg(() => (<><rect x="3" y="7" width="18" height="10" rx="1"/><circle cx="12" cy="12" r="2"/></>)) },
  { kind: "wallet",       label: "Wallet",   category: "money", draw: svg(() => (<><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M17 14h2"/></>)) },
  { kind: "basket",       label: "Basket",   category: "money", draw: svg(() => (<><path d="M4 9h16l-2 11H6z"/><path d="M8 9l3-5M16 9l-3-5"/></>)) },
  { kind: "currency-gbp", label: "£",        category: "money", draw: svg(() => (<><text x="6" y="18" fontSize="16" fill="currentColor" stroke="none">£</text></>)) },
  { kind: "currency-usd", label: "$",        category: "money", draw: svg(() => (<><text x="6" y="18" fontSize="16" fill="currentColor" stroke="none">$</text></>)) },
  { kind: "currency-eur", label: "€",        category: "money", draw: svg(() => (<><text x="6" y="18" fontSize="16" fill="currentColor" stroke="none">€</text></>)) },
  { kind: "currency-ngn", label: "₦",        category: "money", draw: svg(() => (<><text x="6" y="18" fontSize="16" fill="currentColor" stroke="none">₦</text></>)) },

  // Probability
  { kind: "dice",    label: "Dice",    category: "probability", draw: svg(() => (<><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></>)) },
  { kind: "spinner", label: "Spinner", category: "probability", draw: svg(() => (<><circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 4"/></>)) },
  { kind: "card",    label: "Card",    category: "probability", draw: svg(() => (<><rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M12 8l-2 3 2 3 2-3z"/></>)) },
  { kind: "marble",  label: "Marble",  category: "probability", draw: svg(() => (<><circle cx="12" cy="12" r="7"/><circle cx="9.5" cy="9.5" r="1.6" fill="currentColor"/></>)) },

  // Transport
  { kind: "bus",        label: "Bus",        category: "transport", draw: svg(() => (<><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 12h18"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></>)) },
  { kind: "train",      label: "Train",      category: "transport", draw: svg(() => (<><rect x="5" y="4" width="14" height="14" rx="3"/><path d="M5 11h14"/><circle cx="9" cy="20" r="1"/><circle cx="15" cy="20" r="1"/></>)) },
  { kind: "bicycle",    label: "Bicycle",    category: "transport", draw: svg(() => (<><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l5-8h4l3 8M11 9l3-3"/></>)) },
  { kind: "motorcycle", label: "Motorcycle", category: "transport", draw: svg(() => (<><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17l4-6h6l4 6M9 11l2-4h3"/></>)) },
  { kind: "boat",       label: "Boat",       category: "transport", draw: svg(() => (<><path d="M3 16l2 4h14l2-4z"/><path d="M5 16V8l14 8"/></>)) },
  { kind: "plane",      label: "Plane",      category: "transport", draw: svg(() => (<><path d="M3 14l8-2 4-8 2 1-2 9 5 2v2l-7-1-2 4h-2l1-5z"/></>)) },

  // Animals
  { kind: "dog",      label: "Dog",      category: "animals", draw: svg(() => (<><path d="M5 14c0-4 3-6 7-6s7 2 7 6v4H5z"/><path d="M7 10l-2-3M17 10l2-3"/><circle cx="10" cy="14" r="0.6" fill="currentColor"/><circle cx="14" cy="14" r="0.6" fill="currentColor"/></>)) },
  { kind: "cat",      label: "Cat",      category: "animals", draw: svg(() => (<><path d="M6 8l1 5c0 3 2 5 5 5s5-2 5-5l1-5-3 2h-6z"/><circle cx="10" cy="14" r="0.6" fill="currentColor"/><circle cx="14" cy="14" r="0.6" fill="currentColor"/></>)) },
  { kind: "fish",     label: "Fish",     category: "animals", draw: svg(() => (<><path d="M3 12c3-5 9-5 13 0-4 5-10 5-13 0z"/><path d="M16 12l5-3v6z"/><circle cx="7" cy="11" r="0.6" fill="currentColor"/></>)) },
  { kind: "bird",     label: "Bird",     category: "animals", draw: svg(() => (<><path d="M4 14c4 0 6-3 8-7 1 4 4 6 8 5-2 4-7 6-11 6-3 0-5-2-5-4z"/></>)) },
  { kind: "cow",      label: "Cow",      category: "animals", draw: svg(() => (<><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M6 11l-2-3M18 11l2-3"/><circle cx="10" cy="14" r="0.6" fill="currentColor"/><circle cx="14" cy="14" r="0.6" fill="currentColor"/></>)) },
  { kind: "goat",     label: "Goat",     category: "animals", draw: svg(() => (<><path d="M5 16c0-4 3-7 7-7s7 3 7 7v3H5z"/><path d="M9 9l-1-3M15 9l1-3"/></>)) },
  { kind: "lion",     label: "Lion",     category: "animals", draw: svg(() => (<><circle cx="12" cy="13" r="6"/><path d="M6 13L3 9M6 13L3 17M18 13l3-4M18 13l3 4M12 7V3"/></>)) },
  { kind: "elephant", label: "Elephant", category: "animals", draw: svg(() => (<><path d="M4 12c0-4 4-7 8-7s8 3 8 7v6H10v-3l-3-1z"/><path d="M7 18v2M17 18v2"/></>)) },

  // School
  { kind: "pencil",     label: "Pencil",     category: "school", draw: svg(() => (<><path d="M4 20l3-1 11-11-2-2L5 17z"/><path d="M14 6l2 2"/></>)) },
  { kind: "pen",        label: "Pen",        category: "school", draw: svg(() => (<><path d="M5 19l3-1 10-10-2-2L6 16z"/></>)) },
  { kind: "ruler",      label: "Ruler",      category: "school", draw: svg(() => (<><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M7 9v3M11 9v4M15 9v3M19 9v4"/></>)) },
  { kind: "eraser",     label: "Eraser",     category: "school", draw: svg(() => (<><rect x="4" y="8" width="16" height="8" rx="1"/><path d="M12 8v8"/></>)) },
  { kind: "notebook",   label: "Notebook",   category: "school", draw: svg(() => (<><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 8h14M5 13h14M5 18h14"/></>)) },
  { kind: "calculator", label: "Calculator", category: "school", draw: svg(() => (<><rect x="5" y="3" width="14" height="18" rx="2"/><rect x="7" y="6" width="10" height="3"/><circle cx="9" cy="13" r="0.6" fill="currentColor"/><circle cx="12" cy="13" r="0.6" fill="currentColor"/><circle cx="15" cy="13" r="0.6" fill="currentColor"/><circle cx="9" cy="17" r="0.6" fill="currentColor"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/><circle cx="15" cy="17" r="0.6" fill="currentColor"/></>)) },

  // Science
  { kind: "magnet",  label: "Magnet",  category: "science", draw: svg(() => (<><path d="M5 4v8a7 7 0 0014 0V4h-4v8a3 3 0 01-6 0V4z"/></>)) },
  { kind: "battery", label: "Battery", category: "science", draw: svg(() => (<><rect x="4" y="8" width="15" height="8" rx="1"/><rect x="19" y="10" width="2" height="4"/><path d="M7 11v2M10 11v2"/></>)) },
  { kind: "planet",  label: "Planet",  category: "science", draw: svg(() => (<><circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3" transform="rotate(-20 12 12)"/></>)) },
  { kind: "sun",     label: "Sun",     category: "science", draw: svg(() => (<><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></>)) },
  { kind: "moon",    label: "Moon",    category: "science", draw: svg(() => (<><path d="M19 14a8 8 0 11-9-10 6 6 0 009 10z"/></>)) },
  { kind: "atom",    label: "Atom",    category: "science", draw: svg(() => (<><circle cx="12" cy="12" r="1.5" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/></>)) },
  { kind: "leaf",    label: "Leaf",    category: "science", draw: svg(() => (<><path d="M4 20c0-9 6-16 16-16 0 10-7 16-16 16z"/><path d="M4 20L16 8"/></>)) },
  { kind: "drop",    label: "Water",   category: "science", draw: svg(() => (<><path d="M12 3s6 7 6 12a6 6 0 11-12 0c0-5 6-12 6-12z"/></>)) },
];

export const OBJECT_BY_KIND: Record<string, ObjectDef> = Object.fromEntries(
  OBJECTS.map((o) => [o.kind, o]),
);

export function objectsByCategory(id: CategoryId): ObjectDef[] {
  return OBJECTS.filter((o) => o.category === id);
}
