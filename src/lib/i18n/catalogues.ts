import { en, type Catalogue, type TranslationKey } from "./locales/en";
import { ar } from "./locales/ar";
import { bn } from "./locales/bn";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { hi } from "./locales/hi";
import { id } from "./locales/id";
import { ja } from "./locales/ja";
import { pt } from "./locales/pt";
import { ru } from "./locales/ru";
import { zh } from "./locales/zh";
import type { LanguageCode } from "./languages";

export type { Catalogue, TranslationKey };

/**
 * The stored translations. English is the master catalogue and the fallback for
 * every key: a language without an entry shows English, never a raw key.
 */
export const CATALOGUES: Record<LanguageCode, Catalogue> = {
  en,
  ar,
  bn,
  es,
  fr,
  hi,
  id,
  ja,
  pt,
  ru,
  zh,
};

export const hasCatalogue = (code: LanguageCode): boolean => Boolean(CATALOGUES[code]);

export const translate = (code: LanguageCode, key: TranslationKey): string => {
  const catalogue = CATALOGUES[code];
  return catalogue?.[key] ?? en[key];
};
