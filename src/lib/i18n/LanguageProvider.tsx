/**
 * One interface language for the whole platform.
 *
 * English is the permanent master language: it is always available, always
 * first, never removable, and it is the fallback for any key a translation
 * misses. Nothing here inspects location, IP or timezone — a new user starts in
 * English and chooses for themselves.
 *
 * The choice is remembered: signed-in users keep it on their account, and every
 * visitor keeps it in local storage so a reload never loses it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  DEFAULT_LANGUAGE,
  addLanguage,
  languageByCode,
  myLanguageList,
  type Language,
  type LanguageCode,
} from "./languages";
import { hasCatalogue, translate, type TranslationKey } from "./catalogues";

const ACTIVE_KEY = "mathgpl.language.active";
const LIST_KEY = "mathgpl.language.mine";

type LanguageContextValue = {
  /** The active language code. */
  language: LanguageCode;
  active: Language;
  /** English first, then every language this user has chosen. */
  myLanguages: Language[];
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
};

const noop = () => {};

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  active: languageByCode(DEFAULT_LANGUAGE),
  myLanguages: myLanguageList([]),
  setLanguage: noop,
  t: (key) => translate(DEFAULT_LANGUAGE, key),
});

const readLocal = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable — the account copy still holds the choice */
  }
};

const parseList = (raw: string | null): LanguageCode[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [mine, setMine] = useState<LanguageCode[]>([]);

  // Restore the visitor's own choice after hydration, so server and client
  // render the same markup on the first pass.
  useEffect(() => {
    const storedActive = readLocal(ACTIVE_KEY);
    const storedList = parseList(readLocal(LIST_KEY));
    if (storedList.length) setMine(storedList);
    if (storedActive && hasCatalogue(storedActive)) setLanguageState(storedActive);
  }, []);

  // A signed-in account is the durable home of the preference: it survives
  // logout, a new browser and another device. The columns arrive with the
  // staged migration; until then the local copy is authoritative.
  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      // The language columns arrive with the staged migration, so this query is
      // written against the profile table loosely on purpose.
      const table = supabase.from("profiles") as unknown as {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: { ui_language: string | null; ui_languages: string[] | null } | null;
              error: unknown;
            }>;
          };
        };
      };
      const { data, error } = await table
        .select("ui_language, ui_languages")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active || error || !data) return;
      const savedList = Array.isArray(data.ui_languages) ? data.ui_languages : [];
      setMine((current) => {
        const merged = [...savedList];
        for (const code of current) if (!merged.includes(code)) merged.push(code);
        return merged.filter((code) => code !== DEFAULT_LANGUAGE);
      });
      if (data.ui_language && hasCatalogue(data.ui_language)) setLanguageState(data.ui_language);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const persist = useCallback(
    (code: LanguageCode, list: LanguageCode[]) => {
      writeLocal(ACTIVE_KEY, code);
      writeLocal(LIST_KEY, JSON.stringify(list));
      if (!user) return;
      const table = supabase.from("profiles") as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => Promise<{ error: unknown }>;
        };
      };
      void table
        .update({ ui_language: code, ui_languages: list })
        .eq("user_id", user.id)
        .then(({ error }) => {
          // Before the staged migration is accepted the columns do not exist;
          // the local copy already holds the choice, so this is not fatal.
          if (error) console.warn("[i18n] language preference not stored on the account yet");
        });
    },
    [user],
  );


  const setLanguage = useCallback(
    (code: LanguageCode) => {
      const next = hasCatalogue(code) ? code : DEFAULT_LANGUAGE;
      setLanguageState(next);
      setMine((current) => {
        const list = addLanguage(current, next);
        persist(next, list);
        return list;
      });
    },
    [persist],
  );

  // The language changes the words, never the layout. `lang` is announced for
  // assistive technology and typography, but the document direction stays
  // left-to-right in every language: right-to-left scripts render correctly
  // inside their own labels without rearranging a single panel.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
  }, [language]);


  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      active: languageByCode(language),
      myLanguages: myLanguageList(mine),
      setLanguage,
      t: (key: TranslationKey) => translate(language, key),
    }),
    [language, mine, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** Shorthand for components that only need to read strings. */
export function useT() {
  return useContext(LanguageContext).t;
}
