// Conversion tool for Lesson Notes — a two-panel unit converter.
// Left: value + source unit. Right: destination unit. The result updates
// instantly and can be inserted into the note as plain text.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORIES, UNITS, convert, findUnit, formatResult,
  loadCurrencyRates, saveCurrencyRates,
  type ConversionCategory,
} from "@/lib/lessonnotes/conversions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert?: (text: string) => void;
}

export function ConversionPanel({ open, onOpenChange, onInsert }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conversion</DialogTitle>
        </DialogHeader>
        <ConversionBody onInsert={onInsert} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** The converter itself, with no dialog chrome — reused by the Smartboard's
 *  floating Conversion workspace so both surfaces behave identically. */
export function ConversionBody({
  onInsert,
  onDone,
}: {
  onInsert?: (text: string) => void;
  onDone?: () => void;
}) {
  const [category, setCategory] = useState<ConversionCategory>("Length");
  const [fromId, setFromId] = useState("cm");
  const [toId, setToId] = useState("m");
  const [raw, setRaw] = useState("50");
  const [rates, setRates] = useState<Record<string, number>>(() => loadCurrencyRates());

  useEffect(() => {
    const units = UNITS[category];
    if (!units.some((u) => u.id === fromId)) setFromId(units[0].id);
    if (!units.some((u) => u.id === toId)) setToId(units[1]?.id ?? units[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const value = Number(raw);
  const from = findUnit(category, fromId);
  const to = findUnit(category, toId);

  const result = useMemo(
    () => convert(value, category, fromId, toId, rates),
    [value, category, fromId, toId, rates],
  );

  const line =
    from && to && result !== null && raw.trim() !== ""
      ? `${formatResult(value)} ${from.symbol} = ${formatResult(result)} ${to.symbol}`
      : "Enter a value to convert";

  const swap = () => { setFromId(toId); setToId(fromId); };

  const updateRate = (id: string, next: number) => {
    const merged = { ...rates, [id]: next };
    setRates(merged);
    saveCurrencyRates(merged);
  };

  return (
    <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          {/* Left panel */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From</div>
            <input
              type="number"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold"
              placeholder="Value"
              aria-label="Value to convert"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ConversionCategory)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-label="Category"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-label="Convert from unit"
            >
              {UNITS[category].map((u) => (
                <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={swap}
            title="Swap units"
            aria-label="Swap units"
            className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-foreground/10"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>

          {/* Right panel */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Convert to</div>
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-lg font-semibold text-muted-foreground">
              {result !== null && raw.trim() !== "" ? formatResult(result) : "—"}
            </div>
            <div className="rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground">
              {category}
            </div>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              aria-label="Convert to unit"
            >
              {UNITS[category].map((u) => (
                <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center text-xl font-semibold">
          {line}
        </div>

        {category === "Currency" && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exchange rates (units per £1) — editable, saved on this device
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {UNITS.Currency.map((u) => (
                <label key={u.id} className="text-xs">
                  <span className="block text-muted-foreground">{u.symbol} {u.id.toUpperCase()}</span>
                  <input
                    type="number"
                    value={rates[u.id] ?? 1}
                    disabled={u.id === "gbp"}
                    onChange={(e) => updateRate(u.id, Number(e.target.value))}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {onInsert && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={result === null || raw.trim() === ""}
              onClick={() => { onInsert(line); onDone?.(); }}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Insert into note
            </button>
          </div>
        )}
    </div>
  );
}

export default ConversionPanel;
