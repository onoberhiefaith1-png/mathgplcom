// Aura's window on the outside world.
//
// Server-only. Three read-only abilities: search the public web, read a public
// page, and study a public YouTube tutorial by reading its captions. Nothing is
// written anywhere; what she learns she proposes as knowledge for approval.
// Only public http(s) URLs are fetched, payloads are capped, and markup is
// stripped before she ever reads it.

type Args = Record<string, unknown>;
type Ctx = { userId: string };

const MAX_BYTES = 600_000;
const MAX_TEXT = 12_000;
const UA =
  "Mozilla/5.0 (compatible; MathGPL-Aura/1.0; +https://mathgpl.com) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const str = (args: Args, key: string): string | undefined => {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
const need = (args: Args, key: string): string => {
  const v = str(args, key);
  if (!v) throw new Error(`Missing required argument "${key}".`);
  return v;
};

/** Public web addresses only — never a private host or another scheme. */
export function publicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That is not a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public web pages can be read.");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127|10)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "0.0.0.0" ||
    host === "[::1]";
  if (blocked) throw new Error("That address is not a public web page.");
  return url;
}

async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`That page could not be read (${response.status}).`);
  const buffer = await response.arrayBuffer();
  const slice = buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
  return new TextDecoder("utf-8").decode(slice);
}

/** Readable words from a web page: scripts, styles and markup removed. */
export function readableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

export function pageTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

/** The video id from any ordinary YouTube address. */
export function youTubeId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
    if (!host.endsWith("youtube.com")) return null;
    const v = url.searchParams.get("v");
    if (v) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1]!;
    return null;
  } catch {
    return null;
  }
}

/** Caption tracks the watch page advertises. */
export function captionTracks(html: string): { url: string; language: string }[] {
  const out: { url: string; language: string }[] = [];
  const re = /"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"[\s\S]{0,400}?"languageCode":"([a-zA-Z-]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const url = match[1]!.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    out.push({ url, language: match[2]! });
  }
  return out;
}

/** Caption text from YouTube's json3 transcript payload. */
export function transcriptFromJson3(body: string): string {
  let parsed: { events?: { segs?: { utf8?: string }[] }[] };
  try {
    parsed = JSON.parse(body) as never;
  } catch {
    return "";
  }
  const lines: string[] = [];
  for (const event of parsed.events ?? []) {
    const text = (event.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (text && text !== "\n") lines.push(text);
  }
  return lines.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** The tutorial's spoken words broken into the steps it demonstrates. */
export function transcriptSteps(transcript: string): string[] {
  const sentences = transcript
    .split(/(?<=[.!?])\s+|\s(?=(?:next|then|after that|now|finally|first|second|third)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  const steps: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current = current ? `${current} ${sentence}` : sentence;
    if (current.length >= 180) {
      steps.push(current);
      current = "";
    }
  }
  if (current) steps.push(current);
  return steps.slice(0, 40);
}

type Executor = (
  ctx: Ctx,
  args: Args,
) => Promise<{ data: unknown; summary: string; navigateTo?: string }>;

export const researchExecutors: Record<string, Executor> = {
  web_search: async (_ctx, args) => {
    const query = need(args, "query");
    const html = await fetchText(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      "text/html",
    );
    const results: { title: string; url: string; snippet: string }[] = [];
    const re =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,800}?)(?=<a[^>]+class="[^"]*result__a|<\/div>\s*<\/div>\s*<\/div>)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null && results.length < 8) {
      const href = match[1]!.replace(/&amp;/g, "&");
      const real = /uddg=([^&]+)/.exec(href);
      const url = real ? decodeURIComponent(real[1]!) : href;
      const title = readableText(match[2]!).slice(0, 200);
      const snippetSource = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(match[3]!);
      const snippet = snippetSource ? readableText(snippetSource[1]!).slice(0, 400) : "";
      if (title && /^https?:/.test(url)) results.push({ title, url, snippet });
    }
    if (results.length === 0) {
      return {
        data: { query, results: [] },
        summary: `No public results came back for "${query}". Say so rather than guessing.`,
      };
    }
    return {
      data: { query, results },
      summary: `Found ${results.length} public result${results.length === 1 ? "" : "s"} for "${query}".`,
    };
  },

  read_web_page: async (_ctx, args) => {
    const url = publicUrl(need(args, "url"));
    const html = await fetchText(url.toString(), "text/html");
    const text = readableText(html);
    if (!text) throw new Error("That page had no readable text.");
    return {
      data: { url: url.toString(), title: pageTitle(html), text },
      summary: `Read ${url.hostname}${pageTitle(html) ? ` — ${pageTitle(html)}` : ""} (${text.length} characters).`,
    };
  },

  study_tutorial: async (_ctx, args) => {
    const raw = need(args, "url");
    const id = youTubeId(raw);
    if (!id) throw new Error("That is not a public YouTube video address.");
    const watchUrl = `https://www.youtube.com/watch?v=${id}`;

    let title = "";
    let author = "";
    try {
      const oembed = await fetchText(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
        "application/json",
      );
      const meta = JSON.parse(oembed) as { title?: string; author_name?: string };
      title = meta.title ?? "";
      author = meta.author_name ?? "";
    } catch {
      /* metadata is helpful, not essential */
    }

    let page = "";
    try {
      page = await fetchText(watchUrl, "text/html");
    } catch {
      page = "";
    }

    const tracks = captionTracks(page);
    const preferred =
      tracks.find((t) => t.language.toLowerCase().startsWith("en")) ?? tracks[0] ?? null;

    if (!preferred) {
      return {
        data: { url: watchUrl, title, author, transcript: null, steps: [] },
        summary:
          `This video has no public captions I can read, so I have not watched it. ` +
          `Tell me the steps, or give me a tutorial that has captions.`,
      };
    }

    const captionUrl = `${preferred.url}${preferred.url.includes("fmt=") ? "" : "&fmt=json3"}`;
    const body = await fetchText(captionUrl, "application/json");
    const transcript = transcriptFromJson3(body);
    if (!transcript) {
      return {
        data: { url: watchUrl, title, author, transcript: null, steps: [] },
        summary:
          "The captions for this video came back empty, so I have not watched it. Tell me the steps instead.",
      };
    }
    const steps = transcriptSteps(transcript);
    return {
      data: {
        url: watchUrl,
        title,
        author,
        language: preferred.language,
        transcript: transcript.slice(0, MAX_TEXT),
        steps,
      },
      summary:
        `Studied "${title || watchUrl}"${author ? ` by ${author}` : ""}: ` +
        `${steps.length} step${steps.length === 1 ? "" : "s"} from its captions. ` +
        `Compare these with the real pages before trusting them.`,
    };
  },
};
