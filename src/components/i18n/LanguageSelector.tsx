/**
 * The language selector: a globe button with three sections — the user's own
 * languages (English pinned first and permanent), the ten popular languages,
 * then every other supported language. Choosing a language switches the
 * interface at once, adds it to the personal list without duplicating it, and
 * saves the choice.
 */
import { Check, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { otherLanguages, popularLanguages, type Language } from "@/lib/i18n/languages";

type Props = { className?: string; compact?: boolean };

const LanguageSelector = ({ className, compact }: Props) => {
  const { active, myLanguages, language, setLanguage, t } = useLanguage();
  // A language already in My Languages is never listed a second time below.
  const chosen = new Set(myLanguages.map((item) => item.code));
  const popular = popularLanguages().filter((item) => !chosen.has(item.code));
  const others = otherLanguages().filter((item) => !chosen.has(item.code));

  const Row = ({ item }: { item: Language }) => (
    <button
      type="button"
      onClick={() => setLanguage(item.code)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-primary/10"
    >
      <span aria-hidden="true">{item.flag}</span>
      <span className="flex-1 truncate text-foreground">{item.endonym}</span>
      <span className="truncate text-xs text-muted-foreground">{item.name}</span>
      {language === item.code ? (
        <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      ) : null}
    </button>
  );

  const Section = ({ title, items }: { title: string; items: Language[] }) =>
    items.length === 0 ? null : (
    <div className="space-y-1">
      <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      {items.map((item) => (
        <Row key={`${title}-${item.code}`} item={item} />
      ))}
    </div>
  );


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("sys_choose_language")}
          className={cn("gap-2 rounded-full bg-background/60 backdrop-blur", className)}
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          <span className={compact ? "sr-only" : undefined}>{active.endonym}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <ScrollArea className="max-h-[60vh] pr-1">
          <Section title={t("sys_my_languages")} items={myLanguages} />
          <Section title={t("sys_popular_languages")} items={popular} />
          <Section title={t("sys_all_languages")} items={others} />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default LanguageSelector;
