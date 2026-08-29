/**
 * Spoken LANGUAGES the generation engine can produce.
 *
 * A language is a language — never an accent. Accents (British English,
 * Nigerian English, Brazilian Portuguese …) are a separate choice made next to
 * the voice, see `voice-catalog.ts`.
 */
export const SPEECH_LANGUAGES: string[] = [
  "English", "French", "Spanish", "Portuguese", "German", "Italian", "Dutch",
  "Danish", "Swedish", "Norwegian", "Finnish", "Icelandic", "Polish", "Czech",
  "Slovak", "Slovenian", "Hungarian", "Romanian", "Bulgarian", "Croatian",
  "Serbian", "Bosnian", "Macedonian", "Albanian", "Greek", "Turkish", "Russian",
  "Ukrainian", "Belarusian", "Lithuanian", "Latvian", "Estonian", "Georgian",
  "Armenian", "Azerbaijani", "Kazakh", "Uzbek", "Arabic", "Hebrew", "Persian",
  "Pashto", "Urdu", "Hindi", "Bengali", "Punjabi", "Gujarati", "Marathi",
  "Tamil", "Telugu", "Kannada", "Malayalam", "Odia", "Assamese", "Nepali",
  "Sinhala", "Thai", "Lao", "Khmer", "Burmese", "Vietnamese", "Indonesian",
  "Malay", "Filipino", "Javanese", "Sundanese", "Chinese (Mandarin)",
  "Chinese (Cantonese)", "Japanese", "Korean", "Mongolian",
  // Africa
  "Nigerian Pidgin", "Yoruba", "Igbo", "Hausa", "Fulfulde", "Kanuri", "Efik",
  "Tiv", "Ibibio", "Edo", "Twi (Akan)", "Ga", "Ewe", "Dagbani", "Swahili",
  "Amharic", "Tigrinya", "Oromo", "Somali", "Zulu", "Xhosa", "Sesotho",
  "Setswana", "Shona", "Ndebele", "Chichewa", "Kinyarwanda", "Kirundi",
  "Luganda", "Lingala", "Kikongo", "Wolof", "Bambara", "Mooré", "Malagasy",
  "Afrikaans",
  // Rest of the world
  "Maori", "Hawaiian", "Samoan", "Fijian", "Welsh", "Irish", "Scottish Gaelic",
  "Basque", "Catalan", "Galician", "Maltese", "Luxembourgish", "Haitian Creole",
  "Quechua", "Guarani", "Esperanto", "Latin",
];

export function searchLanguages(query: string, limit = 60): string[] {
  const q = query.trim().toLowerCase();
  const list = q ? SPEECH_LANGUAGES.filter((l) => l.toLowerCase().includes(q)) : SPEECH_LANGUAGES;
  return list.slice(0, limit);
}

/** The language the uploaded lesson is spoken in, before any translation. */
export const DEFAULT_SOURCE_LANGUAGE = "English";
