/** The real Academia app files offered for download. Only listed files get a button. */
import win from "@/assets/downloads/academia-win32-x64.zip.asset.json";
import macArm from "@/assets/downloads/academia-darwin-arm64.zip.asset.json";
import macIntel from "@/assets/downloads/academia-darwin-x64.zip.asset.json";

export type Release = { platform: "android" | "windows" | "mac-arm" | "mac-intel"; label: string; url: string; file: string; bytes: number; version: string; builtAt: string };

const asset = (a: { url: string; original_filename: string; size: number; created_at: string }) => ({ url: a.url, file: a.original_filename, bytes: a.size, builtAt: a.created_at.slice(0, 10) });

export const RELEASES: Release[] = [
  { platform: "android", label: "Download APK", url: "/mathgpl-academia.apk", file: "mathgpl-academia.apk", bytes: 2_690_909, version: "1.0.0", builtAt: "2026-10-14" },
  { platform: "windows", label: "Download for Windows", version: "1.0.0", ...asset(win) },
  { platform: "mac-arm", label: "Download for macOS (Apple chip)", version: "1.0.0", ...asset(macArm) },
  { platform: "mac-intel", label: "Download for macOS (Intel)", version: "1.0.0", ...asset(macIntel) },
];

export const releasesFor = (prefix: string) => RELEASES.filter((r) => r.platform.startsWith(prefix) && r.url && r.bytes > 0);
export const sizeLabel = (b: number) => (b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.round(b / 1e3)} KB`);
