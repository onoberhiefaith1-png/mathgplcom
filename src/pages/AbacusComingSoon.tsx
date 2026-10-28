import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft } from "lucide-react";
import SeamlessBackground from "@/components/SeamlessBackground";

const AbacusComingSoon = () => {
  const { mode } = useParams();
  const title = mode === "addition" ? "Addition" : mode === "subtraction" ? "Subtraction" : "Mode";
  return (
    <div className="relative min-h-screen text-foreground">
      <SeamlessBackground file="obsidian.png" repeat={6} />
      <div className="absolute inset-0 -z-10 bg-background/70" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
        <Link to="/subjects/algebra/numbers-and-numerals/abacus" className="absolute left-4 top-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-3xl font-black">Abacus – {title}</h1>
        <p className="text-muted-foreground max-w-md">
          This mode is coming soon. For now, try{" "}
          <Link to="/games/abacus/represent" className="text-primary underline">Represent Numbers</Link>{" "}
          to learn how the abacus works.
        </p>
      </div>
    </div>
  );
};

export default AbacusComingSoon;
