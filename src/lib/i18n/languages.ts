/**
 * The language catalogue.
 *
 * English is the permanent master language: it is always present, always first
 * in a user's personal list, and can never be removed. The ten "popular"
 * languages are a curated shortlist (English excluded, because it already owns
 * the permanent first position); everything else appears under All Languages.
 *
 * Adding a language later means adding one entry here plus a locale file — the
 * selector and its sections update automatically.
 */

export type LanguageCode = string;

export type Language = {
  code: LanguageCode;
  /** English name, used for alphabetical ordering. */
  name: string;
  /** The language's own name, shown to the user. */
  endonym: string;
  flag: string;
  popular?: boolean;
  rtl?: boolean;
};

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", endonym: "English", flag: "🇬🇧" },

  // The ten popular languages (alphabetical by English name).
  { code: "ar", name: "Arabic", endonym: "العربية", flag: "🇸🇦", popular: true, rtl: true },
  { code: "bn", name: "Bengali", endonym: "বাংলা", flag: "🇧🇩", popular: true },
  { code: "zh", name: "Chinese", endonym: "中文", flag: "🇨🇳", popular: true },
  { code: "fr", name: "French", endonym: "Français", flag: "🇫🇷", popular: true },
  { code: "hi", name: "Hindi", endonym: "हिन्दी", flag: "🇮🇳", popular: true },
  { code: "id", name: "Indonesian", endonym: "Bahasa Indonesia", flag: "🇮🇩", popular: true },
  { code: "ja", name: "Japanese", endonym: "日本語", flag: "🇯🇵", popular: true },
  { code: "pt", name: "Portuguese", endonym: "Português", flag: "🇵🇹", popular: true },
  { code: "ru", name: "Russian", endonym: "Русский", flag: "🇷🇺", popular: true },
  { code: "es", name: "Spanish", endonym: "Español", flag: "🇪🇸", popular: true },

  // All other supported languages.
  { code: "af", name: "Afrikaans", endonym: "Afrikaans", flag: "🇿🇦" },
  { code: "am", name: "Amharic", endonym: "አማርኛ", flag: "🇪🇹" },
  { code: "cs", name: "Czech", endonym: "Čeština", flag: "🇨🇿" },
  { code: "da", name: "Danish", endonym: "Dansk", flag: "🇩🇰" },
  { code: "nl", name: "Dutch", endonym: "Nederlands", flag: "🇳🇱" },
  { code: "fil", name: "Filipino", endonym: "Filipino", flag: "🇵🇭" },
  { code: "de", name: "German", endonym: "Deutsch", flag: "🇩🇪" },
  { code: "el", name: "Greek", endonym: "Ελληνικά", flag: "🇬🇷" },
  { code: "gu", name: "Gujarati", endonym: "ગુજરાતી", flag: "🇮🇳" },
  { code: "ha", name: "Hausa", endonym: "Hausa", flag: "🇳🇬" },
  { code: "he", name: "Hebrew", endonym: "עברית", flag: "🇮🇱", rtl: true },
  { code: "ig", name: "Igbo", endonym: "Igbo", flag: "🇳🇬" },
  { code: "it", name: "Italian", endonym: "Italiano", flag: "🇮🇹" },
  { code: "kn", name: "Kannada", endonym: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ko", name: "Korean", endonym: "한국어", flag: "🇰🇷" },
  { code: "ms", name: "Malay", endonym: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "mr", name: "Marathi", endonym: "मराठी", flag: "🇮🇳" },
  { code: "fa", name: "Persian", endonym: "فارسی", flag: "🇮🇷", rtl: true },
  { code: "pl", name: "Polish", endonym: "Polski", flag: "🇵🇱" },
  { code: "pa", name: "Punjabi", endonym: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ro", name: "Romanian", endonym: "Română", flag: "🇷🇴" },
  { code: "sw", name: "Swahili", endonym: "Kiswahili", flag: "🇰🇪" },
  { code: "sv", name: "Swedish", endonym: "Svenska", flag: "🇸🇪" },
  { code: "ta", name: "Tamil", endonym: "தமிழ்", flag: "🇮🇳" },
  { code: "te", name: "Telugu", endonym: "తెలుగు", flag: "🇮🇳" },
  { code: "th", name: "Thai", endonym: "ไทย", flag: "🇹🇭" },
  { code: "tr", name: "Turkish", endonym: "Türkçe", flag: "🇹🇷" },
  { code: "uk", name: "Ukrainian", endonym: "Українська", flag: "🇺🇦" },
  { code: "ur", name: "Urdu", endonym: "اردو", flag: "🇵🇰", rtl: true },
  { code: "vi", name: "Vietnamese", endonym: "Tiếng Việt", flag: "🇻🇳" },
  { code: "yo", name: "Yoruba", endonym: "Yorùbá", flag: "🇳🇬" },
  { code: "zu", name: "Zulu", endonym: "isiZulu", flag: "🇿🇦" },
];

const byName = (a: Language, b: Language) => a.name.localeCompare(b.name, "en");

export const languageByCode = (code: LanguageCode): Language =>
  LANGUAGES.find((language) => language.code === code) ??
  (LANGUAGES[0] as Language);

/** The ten popular languages, alphabetical. English is never included. */
export const popularLanguages = (): Language[] =>
  LANGUAGES.filter((language) => language.popular && language.code !== DEFAULT_LANGUAGE).sort(byName);

/** Everything the catalogue supports that is neither English nor popular. */
export const otherLanguages = (): Language[] =>
  LANGUAGES.filter((language) => !language.popular && language.code !== DEFAULT_LANGUAGE).sort(byName);

/**
 * The user's personal list: English is pinned first and permanent, then the
 * languages they chose in the order they chose them, never duplicated.
 */
export const myLanguageList = (codes: LanguageCode[]): Language[] => {
  const seen = new Set<LanguageCode>([DEFAULT_LANGUAGE]);
  const list: Language[] = [languageByCode(DEFAULT_LANGUAGE)];
  for (const code of codes) {
    if (seen.has(code)) continue;
    if (!LANGUAGES.some((language) => language.code === code)) continue;
    seen.add(code);
    list.push(languageByCode(code));
  }
  return list;
};

/**
 * Add one language to a personal list without ever creating a duplicate, and
 * without reordering the languages already there. English lives in the list
 * implicitly, so it is never stored.
 */
export const addLanguage = (codes: LanguageCode[], code: LanguageCode): LanguageCode[] => {
  const cleaned = codes.filter((entry) => entry !== DEFAULT_LANGUAGE);
  if (code === DEFAULT_LANGUAGE || cleaned.includes(code)) return cleaned;
  return [...cleaned, code];
};
