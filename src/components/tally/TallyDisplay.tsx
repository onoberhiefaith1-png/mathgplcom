interface Props {
  value: number;
}

// Renders tally marks: groups of 5 with diagonal slash
export const TallyDisplay = ({ value }: Props) => {
  const groups = Math.floor(value / 5);
  const rem = value % 5;
  return (
    <div className="flex flex-wrap items-end gap-3">
      {Array.from({ length: groups }).map((_, i) => (
        <Group key={i} count={5} />
      ))}
      {rem > 0 && <Group count={rem} />}
      {value === 0 && <span className="text-sm text-muted-foreground">No tally yet</span>}
    </div>
  );
};

const Group = ({ count }: { count: number }) => (
  <div className="relative h-10 w-12">
    {Array.from({ length: Math.min(4, count) }).map((_, i) => (
      <span
        key={i}
        className="absolute top-0 h-10 w-1 rounded-full bg-primary"
        style={{ left: `${i * 8}px` }}
      />
    ))}
    {count === 5 && (
      <span className="absolute left-[-4px] top-1/2 h-1 w-12 -translate-y-1/2 rotate-[-20deg] rounded-full bg-primary" />
    )}
  </div>
);
