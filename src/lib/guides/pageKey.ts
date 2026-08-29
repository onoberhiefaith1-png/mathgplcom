// A guide belongs to a PAGE, not to one instance of it.
//
// `/class/8f2c…/notes` and `/class/91ab…/notes` are the same page, so both must
// resolve to the same key. Dynamic segments are therefore collapsed to `:id`.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isDynamic = (segment: string): boolean => {
  if (segment.startsWith("$")) return true;          // route-id form: /class/$id
  if (UUID.test(segment)) return true;               // a real id in a pathname
  if (/^\d+$/.test(segment)) return true;            // numeric id
  return false;
};

/** The stable key for a route id or pathname. Always starts with `/`. */
export const toPageKey = (input: string): string => {
  const path = (input || "/").split("?")[0].split("#")[0];
  const segments = path.split("/").filter(Boolean).map((s) => (isDynamic(s) ? ":id" : s.toLowerCase()));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
};

/** A readable label for a page key, used in the administrator list. */
export const pageKeyLabel = (key: string): string => {
  if (key === "/") return "Home";
  return key
    .split("/")
    .filter(Boolean)
    .map((s) => (s === ":id" ? "(item)" : s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())))
    .join(" › ");
};
