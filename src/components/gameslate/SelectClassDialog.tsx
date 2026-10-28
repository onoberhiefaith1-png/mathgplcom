// A Game is a reusable container. Class + Game is the playable instance, so a
// teacher who owns several classes chooses which instance to open.

interface Option {
  assignmentId: string;
  classId: string;
  className: string;
}

interface Props {
  options: Option[];
  onPick: (option: Option) => void;
  /** Opens the Game's own pool with nothing recorded. */
  onPickTest: () => void;
  onClose: () => void;
}

export const SelectClassDialog = ({ options, onPick, onPickTest, onClose }: Props) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
      <h2 className="text-base font-semibold">Which class are you opening?</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Each class has its own questions and its own Level order.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.assignmentId}
            type="button"
            onClick={() => onPick(option)}
            className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-accent"
          >
            {option.className}
          </button>
        ))}
        <button
          type="button"
          onClick={onPickTest}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
        >
          Just test the Game (nothing recorded)
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        Cancel
      </button>
    </div>
  </div>
);

export default SelectClassDialog;
