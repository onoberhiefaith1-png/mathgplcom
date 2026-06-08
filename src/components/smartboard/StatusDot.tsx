import { LineStatus } from "@/lib/smartboard/lineValidator";

export const StatusDot = ({ status }: { status: LineStatus }) => {
  if (status === "empty") return <span className="inline-block h-2.5 w-2.5" />;
  const color =
    status === "yellow" ? "var(--sb-yellow)" :
    status === "blue"   ? "var(--sb-blue)"   :
    status === "purple" ? "#b59aff" :
    "var(--sb-red)";
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full transition-all duration-300"
      style={{
        background: color,
        boxShadow: `0 0 calc(14px * var(--sb-glow)) ${color}`,
      }}
      aria-label={status}
    />
  );
};

export default StatusDot;
