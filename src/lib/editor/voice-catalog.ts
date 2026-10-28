/**
 * Voice library for Stage 6.
 *
 * The speech engine exposes a small set of base voices. Each catalog entry maps
 * one of those base voices to a language / accent, plus a steering hint that is
 * sent as delivery instructions. Accent fidelity is strong for the major English
 * variants and widely supported languages, and approximate for low-resource
 * ones. `provider` exists so a dedicated accent provider can be added later
 * without changing the UI.
 */
import { SPEECH_LANGUAGES } from "./languages";

export interface VoiceOption {
  id: string;
  provider: "lovable-ai";
  label: string;
  language: string;
  region: string;
  accent: string;
  gender: "female" | "male";
  /** base voice sent to the speech model */
  engineVoice: string;
  /** accent / language steering appended to the delivery instructions */
  hint: string;
}

type Row = [
  id: string,
  label: string,
  language: string,
  region: string,
  accent: string,
  gender: "female" | "male",
  engineVoice: string,
  hint: string,
];

const ROWS: Row[] = [
  // English — United Kingdom
  ["en-gb-f-1", "Imogen", "English", "United Kingdom", "British (RP)", "female", "shimmer", "Speak in a natural British English accent (Received Pronunciation)."],
  ["en-gb-f-2", "Harriet", "English", "United Kingdom", "British (RP)", "female", "sage", "Speak in a refined British English accent."],
  ["en-gb-m-1", "Alistair", "English", "United Kingdom", "British (RP)", "male", "onyx", "Speak in a natural British English accent (Received Pronunciation)."],
  ["en-gb-m-2", "Rufus", "English", "United Kingdom", "British (Estuary)", "male", "echo", "Speak in a modern southern British English accent."],
  ["en-sc-m-1", "Callum", "English", "Scotland", "Scottish", "male", "ash", "Speak in a clear Scottish English accent."],
  ["en-ie-f-1", "Saoirse", "English", "Ireland", "Irish", "female", "coral", "Speak in a warm Irish English accent."],
  // English — United States / Canada
  ["en-us-f-1", "Ava", "English", "United States", "General American", "female", "nova", "Speak in a natural General American accent."],
  ["en-us-f-2", "Harper", "English", "United States", "General American", "female", "coral", "Speak in a friendly General American accent."],
  ["en-us-m-1", "Miles", "English", "United States", "General American", "male", "onyx", "Speak in a natural General American accent."],
  ["en-us-m-2", "Jesse", "English", "United States", "General American", "male", "ash", "Speak in a relaxed General American accent."],
  ["en-ca-f-1", "Élise", "English", "Canada", "Canadian", "female", "sage", "Speak in a Canadian English accent."],
  ["en-ca-m-1", "Owen", "English", "Canada", "Canadian", "male", "echo", "Speak in a Canadian English accent."],
  // English — Africa
  ["en-ng-f-1", "Amara", "English", "Nigeria", "Nigerian", "female", "coral", "Speak in a clear Nigerian English accent, with Nigerian rhythm and vowel sounds."],
  ["en-ng-f-2", "Zainab", "English", "Nigeria", "Nigerian", "female", "nova", "Speak in a Nigerian English accent, measured and articulate."],
  ["en-ng-m-1", "Chidi", "English", "Nigeria", "Nigerian", "male", "onyx", "Speak in a clear Nigerian English accent, with Nigerian rhythm and vowel sounds."],
  ["en-ng-m-2", "Tunde", "English", "Nigeria", "Nigerian", "male", "ash", "Speak in a Nigerian English accent, confident and warm."],
  ["en-gh-f-1", "Akosua", "English", "Ghana", "Ghanaian", "female", "shimmer", "Speak in a Ghanaian English accent."],
  ["en-gh-m-1", "Kwame", "English", "Ghana", "Ghanaian", "male", "echo", "Speak in a Ghanaian English accent."],
  ["en-ke-f-1", "Wanjiru", "English", "Kenya", "Kenyan", "female", "sage", "Speak in a Kenyan English accent."],
  ["en-za-f-1", "Thandi", "English", "South Africa", "South African", "female", "nova", "Speak in a South African English accent."],
  ["en-za-m-1", "Sipho", "English", "South Africa", "South African", "male", "onyx", "Speak in a South African English accent."],
  // English — Asia / Oceania
  ["en-in-f-1", "Priya", "English", "India", "Indian", "female", "shimmer", "Speak in a clear Indian English accent."],
  ["en-in-m-1", "Arjun", "English", "India", "Indian", "male", "ash", "Speak in a clear Indian English accent."],
  ["en-au-f-1", "Matilda", "English", "Australia", "Australian", "female", "coral", "Speak in an Australian English accent."],
  ["en-au-m-1", "Lachlan", "English", "Australia", "Australian", "male", "echo", "Speak in an Australian English accent."],
  ["en-nz-f-1", "Aroha", "English", "New Zealand", "New Zealand", "female", "sage", "Speak in a New Zealand English accent."],
  ["en-ph-f-1", "Liwayway", "English", "Philippines", "Filipino", "female", "nova", "Speak in a Filipino English accent."],
  // Nigerian languages
  ["yo-ng-f-1", "Adunni", "Yoruba", "Nigeria", "Yoruba", "female", "coral", "Speak entirely in Yoruba, using natural Yoruba pronunciation and tone."],
  ["yo-ng-m-1", "Ayodele", "Yoruba", "Nigeria", "Yoruba", "male", "onyx", "Speak entirely in Yoruba, using natural Yoruba pronunciation and tone."],
  ["ig-ng-f-1", "Ngozi", "Igbo", "Nigeria", "Igbo", "female", "shimmer", "Speak entirely in Igbo, using natural Igbo pronunciation and tone."],
  ["ig-ng-m-1", "Emeka", "Igbo", "Nigeria", "Igbo", "male", "ash", "Speak entirely in Igbo, using natural Igbo pronunciation and tone."],
  ["ha-ng-f-1", "Hauwa", "Hausa", "Nigeria", "Hausa", "female", "sage", "Speak entirely in Hausa, using natural Hausa pronunciation."],
  ["ha-ng-m-1", "Sani", "Hausa", "Nigeria", "Hausa", "male", "echo", "Speak entirely in Hausa, using natural Hausa pronunciation."],
  ["sw-ke-f-1", "Amina", "Swahili", "Kenya", "Swahili", "female", "nova", "Speak entirely in Swahili, using natural Swahili pronunciation."],
  ["sw-ke-m-1", "Juma", "Swahili", "Tanzania", "Swahili", "male", "onyx", "Speak entirely in Swahili, using natural Swahili pronunciation."],
  ["pcm-ng-f-1", "Ifeoma", "Nigerian Pidgin", "Nigeria", "Naija", "female", "coral", "Speak entirely in Nigerian Pidgin (Naija), naturally and conversationally."],
  ["pcm-ng-m-1", "Bayo", "Nigerian Pidgin", "Nigeria", "Naija", "male", "echo", "Speak entirely in Nigerian Pidgin (Naija), naturally and conversationally."],
  ["tw-gh-f-1", "Abena", "Twi (Akan)", "Ghana", "Asante Twi", "female", "shimmer", "Speak entirely in Twi (Akan), using natural Asante Twi pronunciation."],
  ["tw-gh-m-1", "Kofi", "Twi (Akan)", "Ghana", "Asante Twi", "male", "ash", "Speak entirely in Twi (Akan), using natural Asante Twi pronunciation."],
  ["am-et-f-1", "Selam", "Amharic", "Ethiopia", "Amharic", "female", "sage", "Speak entirely in Amharic."],
  ["af-za-m-1", "Pieter", "Afrikaans", "South Africa", "Afrikaans", "male", "onyx", "Speak entirely in Afrikaans."],
  // French
  ["fr-fr-f-1", "Camille", "French", "France", "Metropolitan French", "female", "shimmer", "Speak entirely in French with a Parisian accent."],
  ["fr-fr-m-1", "Julien", "French", "France", "Metropolitan French", "male", "onyx", "Speak entirely in French with a Parisian accent."],
  ["fr-ca-f-1", "Océane", "French", "Canada", "Québécois", "female", "coral", "Speak entirely in French with a Québécois accent."],
  ["fr-sn-m-1", "Ousmane", "French", "Senegal", "West African French", "male", "ash", "Speak entirely in French with a West African accent."],
  // Spanish / Portuguese
  ["es-es-f-1", "Lucía", "Spanish", "Spain", "Castilian", "female", "sage", "Speak entirely in Spanish with a Castilian accent."],
  ["es-es-m-1", "Mateo", "Spanish", "Spain", "Castilian", "male", "echo", "Speak entirely in Spanish with a Castilian accent."],
  ["es-mx-f-1", "Valentina", "Spanish", "Mexico", "Latin American", "female", "nova", "Speak entirely in Spanish with a neutral Latin American accent."],
  ["es-ar-m-1", "Santiago", "Spanish", "Argentina", "Rioplatense", "male", "onyx", "Speak entirely in Spanish with an Argentinian accent."],
  ["pt-br-f-1", "Beatriz", "Portuguese", "Brazil", "Brazilian", "female", "coral", "Speak entirely in Portuguese with a Brazilian accent."],
  ["pt-pt-m-1", "Tiago", "Portuguese", "Portugal", "European", "male", "ash", "Speak entirely in Portuguese with a European Portuguese accent."],
  // Europe
  ["de-de-f-1", "Lena", "German", "Germany", "Standard German", "female", "shimmer", "Speak entirely in German with a standard German accent."],
  ["de-de-m-1", "Jonas", "German", "Germany", "Standard German", "male", "onyx", "Speak entirely in German with a standard German accent."],
  ["it-it-f-1", "Giulia", "Italian", "Italy", "Standard Italian", "female", "nova", "Speak entirely in Italian."],
  ["it-it-m-1", "Marco", "Italian", "Italy", "Standard Italian", "male", "echo", "Speak entirely in Italian."],
  ["nl-nl-f-1", "Fenna", "Dutch", "Netherlands", "Dutch", "female", "sage", "Speak entirely in Dutch."],
  ["pl-pl-m-1", "Kacper", "Polish", "Poland", "Polish", "male", "ash", "Speak entirely in Polish."],
  ["ru-ru-f-1", "Katya", "Russian", "Russia", "Russian", "female", "coral", "Speak entirely in Russian."],
  ["tr-tr-m-1", "Emre", "Turkish", "Türkiye", "Turkish", "male", "onyx", "Speak entirely in Turkish."],
  // Middle East & Asia
  ["ar-eg-f-1", "Nour", "Arabic", "Egypt", "Egyptian Arabic", "female", "shimmer", "Speak entirely in Arabic with an Egyptian accent."],
  ["ar-sa-m-1", "Faisal", "Arabic", "Saudi Arabia", "Modern Standard", "male", "onyx", "Speak entirely in Modern Standard Arabic."],
  ["hi-in-f-1", "Ananya", "Hindi", "India", "Hindi", "female", "nova", "Speak entirely in Hindi."],
  ["hi-in-m-1", "Rohan", "Hindi", "India", "Hindi", "male", "ash", "Speak entirely in Hindi."],
  ["zh-cn-f-1", "Mei", "Chinese (Mandarin)", "China", "Mandarin", "female", "coral", "Speak entirely in Mandarin Chinese."],
  ["zh-cn-m-1", "Wei", "Chinese (Mandarin)", "China", "Mandarin", "male", "echo", "Speak entirely in Mandarin Chinese."],
  ["zh-hk-f-1", "Wing", "Chinese (Cantonese)", "Hong Kong", "Cantonese", "female", "nova", "Speak entirely in Cantonese Chinese."],
  ["ja-jp-f-1", "Yuki", "Japanese", "Japan", "Japanese", "female", "sage", "Speak entirely in Japanese."],
  ["ja-jp-m-1", "Haruto", "Japanese", "Japan", "Japanese", "male", "onyx", "Speak entirely in Japanese."],
  ["ko-kr-f-1", "Jiwoo", "Korean", "South Korea", "Korean", "female", "shimmer", "Speak entirely in Korean."],
  ["id-id-m-1", "Bayu", "Indonesian", "Indonesia", "Indonesian", "male", "ash", "Speak entirely in Indonesian."],
];

export const VOICE_CATALOG: VoiceOption[] = ROWS.map(
  ([id, label, language, region, accent, gender, engineVoice, hint]) => ({
    id,
    provider: "lovable-ai" as const,
    label,
    language,
    region,
    accent,
    gender,
    engineVoice,
    hint,
  }),
);

export const DEFAULT_VOICE_ID = "en-gb-f-1";

/** Base voices the speech engine exposes — used to build voices for any language. */
const BASE_VOICES: { engine: string; label: string; gender: "female" | "male" }[] = [
  { engine: "nova", label: "Nova", gender: "female" },
  { engine: "shimmer", label: "Shimmer", gender: "female" },
  { engine: "coral", label: "Coral", gender: "female" },
  { engine: "sage", label: "Sage", gender: "female" },
  { engine: "onyx", label: "Onyx", gender: "male" },
  { engine: "echo", label: "Echo", gender: "male" },
  { engine: "ash", label: "Ash", gender: "male" },
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Voices for a language the catalog has no dedicated rows for. Any language the
 * engine can speak stays selectable — the language itself is steered by the hint.
 */
function genericVoices(language: string): VoiceOption[] {
  return BASE_VOICES.map((base) => ({
    id: `gen-${slug(language)}-${base.engine}`,
    provider: "lovable-ai" as const,
    label: base.label,
    language,
    region: "Standard",
    accent: "Standard",
    gender: base.gender,
    engineVoice: base.engine,
    hint: `Speak entirely in ${language}, with natural native pronunciation.`,
  }));
}

/** Every voice available for a language (catalog rows first, generic otherwise). */
export function voicesForLanguage(language: string): VoiceOption[] {
  const rows = VOICE_CATALOG.filter((v) => v.language === language);
  return rows.length > 0 ? rows : genericVoices(language);
}

/** Accents available for a language. Accent is never the same thing as language. */
export function accentsForLanguage(language: string): string[] {
  return Array.from(new Set(voicesForLanguage(language).map((v) => v.accent))).sort();
}

export function findVoice(id: string): VoiceOption {
  const known = VOICE_CATALOG.find((v) => v.id === id);
  if (known) return known;
  // generic id: gen-<language-slug>-<engine>
  const match = /^gen-(.+)-([a-z]+)$/.exec(id);
  if (match) {
    const language = SPEECH_LANGUAGES.find((l) => slug(l) === match[1]);
    if (language) {
      const found = genericVoices(language).find((v) => v.id === id);
      if (found) return found;
    }
  }
  return VOICE_CATALOG[0]!;
}

/** Default voice for a language (optionally an accent), used for every segment. */
export function defaultVoiceFor(language: string, accent?: string): VoiceOption {
  const list = voicesForLanguage(language);
  const scoped = accent ? list.filter((v) => v.accent === accent) : list;
  return scoped[0] ?? list[0] ?? VOICE_CATALOG[0]!;
}

export function voiceLabel(id: string): string {
  const voice = findVoice(id);
  return `${voice.label} · ${voice.accent} ${voice.gender === "female" ? "♀" : "♂"}`;
}

export const VOICE_LANGUAGES: string[] = SPEECH_LANGUAGES;

export interface DeliveryStyle {
  id: string;
  label: string;
  prompt: string;
}

export const DELIVERY_STYLES: DeliveryStyle[] = [
  { id: "calm-teacher", label: "Calm Teacher", prompt: "Calm, patient teacher tone; steady pace, clear articulation." },
  { id: "friendly-teacher", label: "Friendly Teacher", prompt: "Friendly, approachable teacher; light warmth and encouragement." },
  { id: "professional-presenter", label: "Professional Presenter", prompt: "Polished, professional presenter; confident and neutral." },
  { id: "energetic", label: "Energetic", prompt: "High-energy and lively, with strong forward momentum." },
  { id: "warm", label: "Warm & Encouraging", prompt: "Warm, encouraging and supportive; gentle emphasis on key ideas." },
  { id: "storytelling", label: "Storytelling", prompt: "Narrative storytelling tone with expressive pacing." },
  { id: "documentary", label: "Documentary", prompt: "Measured documentary narration; thoughtful and evocative." },
  { id: "news", label: "News Presenter", prompt: "Crisp broadcast news delivery; even pace, precise diction." },
  { id: "conversational", label: "Conversational", prompt: "Relaxed conversational delivery, as if explaining to a friend." },
  { id: "serious", label: "Serious", prompt: "Serious and authoritative; minimal emotional colour." },
  { id: "excited", label: "Excited", prompt: "Excited and enthusiastic, with bright intonation." },
  { id: "inspirational", label: "Inspirational", prompt: "Inspiring and uplifting; building emphasis toward key points." },
  { id: "dramatic", label: "Dramatic", prompt: "Dramatic delivery with strong dynamic contrast and pauses." },
  { id: "gentle", label: "Gentle", prompt: "Soft, gentle and soothing; low intensity." },
  { id: "confident", label: "Confident", prompt: "Assured and confident; grounded and direct." },
  { id: "academic", label: "Academic", prompt: "Academic lecture tone; precise, structured, unhurried." },
  { id: "children", label: "Children's Education", prompt: "Bright, playful and very clear, for young learners." },
  { id: "fast", label: "Fast-paced", prompt: "Brisk pace while staying fully intelligible." },
  { id: "slow", label: "Slow & Clear", prompt: "Deliberately slow and very clear, for learners following along." },
];

export const DEFAULT_STYLE_ID = "calm-teacher";

export function findStyle(id: string): DeliveryStyle {
  return DELIVERY_STYLES.find((s) => s.id === id) ?? DELIVERY_STYLES[0]!;
}

/**
 * Builds the delivery instruction sent alongside the script text.
 *
 * The target language always wins: the accent hint is only kept when the voice
 * belongs to that language, so an English accent can never leak into a French
 * render and every segment is spoken in exactly the same language.
 */
export function composeInstruction(
  voiceId: string,
  styleId: string,
  custom: string,
  language?: string,
): string {
  const voice = findVoice(voiceId);
  const accentHint = !language || voice.language === language ? voice.hint : "";
  const languageHint = language
    ? `Speak entirely in ${language}. Do not use any other language.`
    : "";
  const parts = [languageHint, accentHint, findStyle(styleId).prompt, custom.trim()].filter(Boolean);
  return parts.join(" ").slice(0, 600);
}
