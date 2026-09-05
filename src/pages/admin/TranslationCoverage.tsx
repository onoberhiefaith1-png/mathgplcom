/**
 * Update translations — the Administrator's translation coverage board.
 *
 * The English catalogue is the master. This page compares every other language
 * against it and reports exactly two things per language: keys that are missing
 * entirely, and keys that still read as the English text (untranslated). When
 * new platform strings are added tomorrow, "Update translations" recalculates
 * the report so the gaps are visible immediately.
 *
 * Nothing here touches teacher-created content: only platform-owned strings
 * live in the catalogue.
 */
import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Languages, RefreshCw } from "lucide-react";
import { CATALOGUES } from "@/lib/i18n/catalogues";
import { en } from "@/lib/i18n/locales/en";
import { LANGUAGES, DEFAULT_LANGUAGE, type LanguageCode } from "@/lib/i18n/languages";

type Report = {
  code: LanguageCode;
  name: string;
  endonym: string;
  total: number;
  translated: number;
  missing: string[];
  untranslated: string[];
};

const KEYS = Object.keys(en) as (keyof typeof en)[];

const buildReports = (): Report[] =>
  LANGUAGES.filter((language) => language.code !== DEFAULT_LANGUAGE)
    .map((language) => {
      const catalogue = CATALOGUES[language.code] as Record<string, string> | undefined;
      const missing: string[] = [];
      const untranslated: string[] = [];
      for (const key of KEYS) {
        const value = catalogue?.[key];
        if (!value) missing.push(key);
        else if (value.trim() === en[key].trim()) untranslated.push(key);
      }
      return {
        code: language.code,
        name: language.name,
        endonym: language.endonym,
        total: KEYS.length,
        translated: KEYS.length - missing.length - untranslated.length,
        missing,
        untranslated,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

const TranslationCoverage = () => {
  const [stamp, setStamp] = useState(() => new Date());
  const [open, setOpen] = useState<LanguageCode | null>(null);
  const reports = useMemo(() => buildReports(), [stamp]);

  const supported = reports.filter((report) => report.missing.length < report.total);
  const complete = supported.filter((r) => r.missing.length === 0 && r.untranslated.length === 0).length;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Update translations</span>
        <button
          type="button"
          onClick={() => setStamp(new Date())}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" /> Update translations
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16">
        <h1 className="text-2xl font-semibold">Interface translations</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          English is the master language. {KEYS.length} platform strings are tracked. {complete} of{" "}
          {supported.length} translated languages are fully covered. Last checked{" "}
          {stamp.toLocaleTimeString()}.
        </p>

        <div className="mt-6 space-y-3">
          {supported.map((report) => {
            const pct = Math.round((report.translated / report.total) * 100);
            return (
              <div key={report.code} className="rounded-2xl border border-border bg-card/40 p-4">
                <button
                  type="button"
                  onClick={() => setOpen(open === report.code ? null : report.code)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {report.name} <span className="text-muted-foreground">· {report.endonym}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {report.translated}/{report.total} translated · {report.missing.length} missing ·{" "}
                      {report.untranslated.length} still English
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{pct}%</span>
                </button>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>

                {open === report.code && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <KeyList title="Missing" keys={report.missing} />
                    <KeyList title="Still English" keys={report.untranslated} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

const KeyList = ({ title, keys }: { title: string; keys: string[] }) => (
  <div>
    <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {title} ({keys.length})
    </p>
    {keys.length === 0 ? (
      <p className="text-xs text-muted-foreground">Nothing outstanding.</p>
    ) : (
      <ul className="max-h-56 overflow-y-auto space-y-0.5 font-mono text-[11px] text-foreground/80">
        {keys.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    )}
  </div>
);

export default TranslationCoverage;
