import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ACADEMIA_MANIFEST_HREF,
  MATHEMAGINE_APP_ID,
  MATHEMAGINE_MANIFEST_HREF,
  MATHEMAGINE_START_URL,
  mathemagineInstallHead,
} from "../mathemagineApp";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const json = (p: string) => JSON.parse(read(p));
const mm = json("public/mathemagine.webmanifest");
const aca = json("public/academia-app.webmanifest");
const pngSize = (p: string) => {
  const b = readFileSync(join(root, "public", p));
  expect(b.subarray(1, 4).toString("ascii")).toBe("PNG");
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
};

describe("Mathemagine web app manifest", () => {
  it("is named Mathemagine and opens the main website", () => {
    expect(mm.name).toBe("Mathemagine");
    expect(mm.short_name).toBe("Mathemagine");
    expect(mm.id).toBe(MATHEMAGINE_APP_ID);
    expect(mm.start_url).toBe(MATHEMAGINE_START_URL);
    expect(new URL(mm.start_url, "https://mathgpl.com").pathname).toBe("/");
    expect(mm.display).toBe("standalone");
  });

  it("ships real icons at their declared sizes, including a maskable one", () => {
    for (const icon of mm.icons) {
      expect(icon.src.startsWith("/mathemagine-")).toBe(true);
      expect(pngSize(icon.src.slice(1))).toBe(icon.sizes);
    }
    expect(mm.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    expect(pngSize("mathemagine-apple-touch-icon.png")).toBe("180x180");
  });

  it("is a separate app from Academia: different id, start page and icons", () => {
    expect(mm.id).not.toBe(aca.id);
    expect(new URL(mm.id, "https://mathgpl.com").href).not.toBe(new URL(aca.id, "https://mathgpl.com").href);
    expect(mm.start_url).not.toBe(aca.start_url);
    expect(mm.start_url.startsWith("/academia-app")).toBe(false);
    const acaIcons = new Set(aca.icons.map((i: { src: string }) => i.src));
    expect(mm.icons.some((i: { src: string }) => acaIcons.has(i.src))).toBe(false);
    expect(MATHEMAGINE_MANIFEST_HREF).not.toBe(ACADEMIA_MANIFEST_HREF);
  });

  it("leaves Academia's manifest as it was", () => {
    expect(aca).toMatchObject({ name: "Mathemagine", short_name: "Mathemagine", id: "/academia-app", start_url: "/academia-app", scope: "/" });
  });
});

describe("no clash with Academia's offline worker", () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(root, dir)).flatMap((n) => {
      const p = `${dir}/${n}`;
      if (n === "__tests__" || n === "node_modules") return [];
      return statSync(join(root, p)).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });

  it("registers no new service worker; scope / stays Academia's sw.js", () => {
    const regs = walk("src").filter((f) => /serviceWorker\.register\(/.test(read(f)));
    expect(regs.sort()).toEqual(["src/lib/offline/registerAcademiaSW.ts", "src/pages/graphApp/GraphAppPage.tsx"]);
    expect(read("src/lib/offline/registerAcademiaSW.ts")).toContain('register("/sw.js", { scope: "/" })');
    expect(mm.serviceworker).toBeUndefined();
  });

  it("links the Mathemagine manifest only from the main website, never from /academia-app", () => {
    expect(mathemagineInstallHead.links).toContainEqual({ rel: "manifest", href: MATHEMAGINE_MANIFEST_HREF });
    expect(read("src/routes/index.tsx")).toContain("links: mathemagineInstallHead.links");
    expect(read("src/routes/welcome.tsx")).toContain("links: mathemagineInstallHead.links");
    const academiaRoute = read("src/routes/academia-app.tsx");
    expect(academiaRoute).toContain('href: "/academia-app.webmanifest"');
    expect(academiaRoute).not.toContain("mathemagine.webmanifest");
    expect(read("src/routes/__root.tsx")).not.toMatch(/rel:\s*"manifest"/);
  });
});

describe("desktop wrapper does not overwrite the Academia desktop app", () => {
  const nsiM = read("desktop/mathemagine/installer.nsi");
  const nsiA = read("desktop/academia/installer.nsi");
  const pick = (s: string, re: RegExp) => s.match(re)?.[1];

  it("uses its own package name, install folder, uninstall key, exe and shortcut", () => {
    expect(json("desktop/mathemagine/package.json").name).not.toBe(json("desktop/academia/package.json").name);
    for (const re of [/InstallDir "([^"]+)"/, /!define UNKEY "([^"]+)"/, /CreateShortcut "\$DESKTOP\\([^"]+)"/, /OutFile "([^"]+)"/]) {
      expect(pick(nsiM, re)).toBeTruthy();
      expect(pick(nsiM, re)).not.toBe(pick(nsiA, re));
    }
    expect(nsiM).toContain('!define EXE "Mathemagine Platform.exe"');
    expect(nsiM).not.toContain('RMDir /r "$APPDATA\\Mathemagine"\n');
  });

  it("opens the main website and keeps its data in its own folder", () => {
    const main = read("desktop/mathemagine/main.cjs");
    expect(main).toContain('const START = `${ORIGIN}/?source=mathemagine-desktop`');
    expect(main).toContain('const DATA_FOLDER = "Mathemagine Platform"');
    expect(main).toContain('"com.mathgpl.mathemagine.platform"');
    expect(read("desktop/academia/main.cjs")).toContain('const START = "https://mathgpl.com/academia-app"');
  });
});
