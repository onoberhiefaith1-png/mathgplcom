export const BidmasKeyPanel = () => (
  <div className="rounded-2xl border-2 border-primary/30 bg-card/60 p-3 backdrop-blur">
    <div className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-2">BIDMAS Key</div>
    <ul className="space-y-1 text-xs">
      {[
        ["B", "Brackets", "text-sky-300"],
        ["I", "Indices", "text-violet-300"],
        ["D", "Division", "text-emerald-300"],
        ["M", "Multiplication", "text-amber-300"],
        ["A", "Addition", "text-rose-300"],
        ["S", "Subtraction", "text-fuchsia-300"],
      ].map(([l, n, c]) => (
        <li key={l} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-md border border-primary/30 font-black ${c}`}>{l}</span>
          <span className="text-foreground/80">{n}</span>
        </li>
      ))}
    </ul>
  </div>
);
