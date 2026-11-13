import type { NotificationContext } from "./types";

/**
 * Notification copy is stored however the sender typed it. Every surface
 * reads it through these helpers so a bell row, a toast and a thread show
 * the same plain sentence, never raw markup, maths delimiters or record ids.
 */

const ROLE_LABEL: Record<string, string> = {
  platform_owner: "Administrator",
  co_admin: "Administrator",
  school: "School",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  system: "Mathemagine",
};

const SOURCE_PHRASE: Record<string, string> = {
  smartboard: "the Smartboard",
  assessment: "an assignment",
};

const NAMED_ENTITY: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const HAS_HTML =
  /<\/?(?:p|div|span|strong|em|b|i|u|a|ul|ol|li|br|h[1-6]|img|blockquote|code|pre|table|thead|tbody|tr|td|th|html|body|script|style)\b/i;

const HTML_TAG =
  /<\/?(?:p|div|span|strong|em|b|i|u|a|ul|ol|li|br|h[1-6]|img|blockquote|code|pre|table|thead|tbody|tr|td|th|html|body|script|style)\b[^>]*\/?>/gi;

const looksLikeMath = (inner: string): boolean => {
  const trimmed = inner.trim();
  if (!trimmed || trimmed.length > 240) return false;
  if (/\\|\^|_|=/.test(trimmed)) return true;
  // A delimited number or symbol, not a sentence that merely mentions a price.
  if (/\s/.test(trimmed)) return false;
  return /^[a-zA-Z0-9+\-*/().,]+$/.test(trimmed);
};

const readableMath = (src: string): string => {
  let text = src;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = text
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
      .replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]*)\}/g, "$1");
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/\\times|\\cdot/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\leq|\\le(?![a-zA-Z])/g, "≤")
    .replace(/\\geq|\\ge(?![a-zA-Z])/g, "≥")
    .replace(/\\neq|\\ne(?![a-zA-Z])/g, "≠")
    .replace(/\\rightarrow|\\to(?![a-zA-Z])/g, "→")
    .replace(/\\infty/g, "∞")
    .replace(/\\pi(?![a-zA-Z])/g, "π")
    .replace(/\\theta(?![a-zA-Z])/g, "θ")
    .replace(/\\(?:left|right)/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const unwrapMath = (value: string): string =>
  value
    .replace(
      /\$\$([\s\S]+?)\$\$/g,
      (_, inner: string) => ` ${readableMath(inner)} `,
    )
    .replace(
      /\\\[([\s\S]+?)\\\]/g,
      (_, inner: string) => ` ${readableMath(inner)} `,
    )
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner: string) => readableMath(inner))
    .replace(/\$([^$\n]+)\$/g, (all, inner: string) =>
      looksLikeMath(inner) ? readableMath(inner) : all,
    );

const decodeEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => {
      const code = Number.parseInt(digits, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(
      /&([a-z]+);/gi,
      (all, name: string) => NAMED_ENTITY[name.toLowerCase()] ?? all,
    );

const stripMarkup = (value: string): string => {
  let text = value;
  if (HAS_HTML.test(text)) {
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
      .replace(HTML_TAG, "");
  }
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])[*_]([^*\n_]+)[*_](?=$|[\s).,!?;:])/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "");
};

const messageFromJson = (value: unknown, depth = 0): string | null => {
  if (depth > 4) return null;
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => messageFromJson(item, depth + 1))
      .filter((item): item is string => !!item);
    return parts.length ? parts.join(" ") : null;
  }
  const record = value as Record<string, unknown>;
  for (const key of [
    "body",
    "message",
    "text",
    "content",
    "answer",
    "subject",
    "title",
  ]) {
    if (typeof record[key] === "string" && record[key].trim())
      return record[key].trim();
  }
  return null;
};

const scrubIds = (value: string): string =>
  value
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      "",
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,!?;:])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();

/** A whole field that is a database id or internal key, not a title someone can read. */
export const isOpaqueId = (value: string): boolean => {
  const text = value.trim();
  if (!text) return true;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
  )
    return true;
  if (/^[0-9a-f]{16,}$/i.test(text)) return true;
  if (/\s/.test(text)) return false;
  if (/^[a-z0-9]+(?:[_:-][a-z0-9]+)+$/i.test(text)) return true;
  if (text.length >= 24 && /^[a-z0-9]+$/i.test(text)) return true;
  return false;
};

/** The words a person should read. Markup, maths delimiters and record ids are removed. */
export const plainNotificationText = (
  input: string | null | undefined,
): string => {
  if (!input) return "";
  let text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    try {
      text = messageFromJson(JSON.parse(text)) ?? "";
      if (!text) return "";
    } catch {
      // A sentence that happens to be wrapped in braces stays as typed.
    }
  }
  text = scrubIds(decodeEntities(unwrapMath(stripMarkup(text))));
  text = text
    .replace(/\\times|\\cdot/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return text;
};

export const humanLabel = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const text = plainNotificationText(value);
  if (!text || isOpaqueId(text)) return null;
  return text;
};

export const clipPlain = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, Math.max(1, max - 1));
  const space = sliced.lastIndexOf(" ");
  const cut = space > max * 0.6 ? sliced.slice(0, space) : sliced;
  return `${cut.trimEnd()}…`;
};

export const notificationRoleLabel = (
  role: string | null | undefined,
): string | null => {
  if (!role) return null;
  return ROLE_LABEL[role] ?? humanLabel(role.replace(/_/g, " "));
};

export const notificationTitle = (
  subject: string | null | undefined,
  senderName?: string | null,
): string => humanLabel(subject) ?? humanLabel(senderName) ?? "Notification";

export const notificationBody = (body: string | null | undefined): string =>
  plainNotificationText(body) || "This notification has no message.";

/** One sentence of where the message belongs. Internal ids are left out. */
export const notificationContextSentence = (
  context: NotificationContext | null | undefined,
): string | null => {
  if (!context) return null;
  const parts: string[] = [];
  const assignment = humanLabel(context.assignmentTitle);
  const adventure = humanLabel(context.adventureTitle);
  const lesson = humanLabel(context.lessonName);
  const course = humanLabel(context.courseName);
  const klass = humanLabel(context.className);
  const school = humanLabel(context.orgName);
  if (assignment) parts.push(`the assignment “${assignment}”`);
  else if (adventure) parts.push(`the adventure “${adventure}”`);
  else if (lesson) parts.push(`the lesson “${lesson}”`);
  if (course) parts.push(`the course “${course}”`);
  if (klass) parts.push(`the class “${klass}”`);
  if (school && parts.length < 3) parts.push(school);
  if (parts.length > 0) return `About ${parts.join(" in ")}.`;
  const known = context.source ? SOURCE_PHRASE[context.source] : undefined;
  if (known) return `This came from ${known}.`;
  return null;
};

/** The sentence a student reads when a teacher answers the question they sent. */
export const answeredQuestionNotice = (
  question: string,
  answer: string,
): string => {
  const asked = clipPlain(plainNotificationText(question), 500);
  const reply = clipPlain(plainNotificationText(answer), 900);
  if (asked && reply) {
    return `Your teacher answered your question. You asked, “${asked}” They replied, “${reply}”`;
  }
  if (reply) return `Your teacher replied, “${reply}”`;
  if (asked) return `Your teacher has responded to your question, “${asked}”`;
  return "Your teacher has responded to your question.";
};
