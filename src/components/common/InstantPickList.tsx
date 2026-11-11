/** A tap-to-choose list. Native <select> and some menu widgets eat the first
 *  pointer on a phone or inside a dialog; these buttons apply on pointer down. */
export type InstantPickItem = { id: string; name: string };

export const InstantPickList = ({
  label,
  value,
  onChange,
  items,
  empty,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  items: InstantPickItem[];
  empty: string;
  disabled?: boolean;
}) => (
  <div className="space-y-1">
    <div className="text-sm font-medium leading-none">{label}</div>
    {disabled || items.length === 0 ? (
      <p className="rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground">
        {disabled ? empty : empty}
      </p>
    ) : (
      <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-input p-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-pressed={item.id === value}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                onChange(item.id);
              }}
              onClick={() => onChange(item.id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                item.id === value ? "bg-primary/15 font-medium text-foreground" : "hover:bg-muted"
              }`}
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);
