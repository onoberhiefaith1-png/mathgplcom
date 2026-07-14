// Shared "universal tools" block that appears at the bottom of every
// Smart Chart properties panel. Import/export CSV, reset, clear, duplicate,
// animate toggle, show/hide answers, lock, presentation mode.

import { useRef } from "react";
import { PanelGroup, PanelRow, PanelButton, PanelToggle } from "@/components/lessonnotes/panel/panelPrimitives";
import type { SmartChartAttrs } from "./types";

interface Props {
  attrs: SmartChartAttrs;
  onPatch: (patch: Partial<SmartChartAttrs>) => void;
  onClearData: () => void;
  onReset: () => void;
  onImportCSV: (text: string) => void;
  onExportCSV: () => string;
}

export function UniversalTools({ attrs, onPatch, onClearData, onReset, onImportCSV, onExportCSV }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const csv = onExportCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${attrs.kind}-chart.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    onImportCSV(txt);
    e.target.value = "";
  };

  return (
    <>
      <PanelGroup label="Data tools">
        <PanelRow label="Import CSV"><PanelButton onClick={doImport}>Import</PanelButton></PanelRow>
        <PanelRow label="Export CSV"><PanelButton onClick={doExport}>Export</PanelButton></PanelRow>
        <PanelRow label="Clear data"><PanelButton onClick={onClearData}>Clear</PanelButton></PanelRow>
        <PanelRow label="Reset chart"><PanelButton onClick={onReset}>Reset</PanelButton></PanelRow>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      </PanelGroup>
      <PanelGroup label="Classroom">
        <PanelRow label="Show answers"><PanelToggle value={attrs.showAnswers} onChange={(v) => onPatch({ showAnswers: v })} /></PanelRow>
        <PanelRow label="Lock editing"><PanelToggle value={attrs.locked} onChange={(v) => onPatch({ locked: v })} /></PanelRow>
        <PanelRow label="Presentation mode"><PanelToggle value={attrs.presentation} onChange={(v) => onPatch({ presentation: v })} /></PanelRow>
        <PanelRow label="Animate on change"><PanelToggle value={attrs.animateOnChange} onChange={(v) => onPatch({ animateOnChange: v })} /></PanelRow>
      </PanelGroup>
    </>
  );
}
