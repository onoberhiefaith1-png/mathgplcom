import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import adventureClouds from "@/assets/adventure-clouds.png.asset.json";

const Adventure = () => (
  <div className="relative min-h-screen w-full overflow-hidden">
    <img
      src={adventureClouds.url}
      alt="Sunset clouds over mountains with sacred geometry"
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
    />
    {/* Content goes on top of the background here */}
    <Link
      to="/teaching-hub"
      className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/50"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </Link>
  </div>
);

export default Adventure;
