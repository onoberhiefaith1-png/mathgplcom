type Props = {
  /** Filename inside /public/assets/backgrounds/ */
  file: string;
  /** Number of vertical repeats (default 20) */
  repeat?: number;
};

/**
 * Fixed, seamless vertical infinite-scroll background.
 * Stacks the same image N times so the page scrolls "deep" with no breaks.
 */
const SeamlessBackground = ({ file, repeat = 20 }: Props) => (
  <div aria-hidden className="absolute inset-x-0 top-0 -z-10 flex flex-col">
    {Array.from({ length: repeat }).map((_, i) => (
      <img
        key={i}
        src={`/assets/backgrounds/${file}`}
        alt=""
        className="block w-full select-none"
        style={{ marginTop: i === 0 ? 0 : "-1px" }}
        draggable={false}
      />
    ))}
  </div>
);

export default SeamlessBackground;
