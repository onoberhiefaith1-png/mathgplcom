import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEVICES } from "@/components/site/DownloadAcademiaDialog";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the Academia app is named Academia again", () => {
  it("says Academia on the installed icon, page title and Home Screen title", () => {
    const m = JSON.parse(read("public/academia-app.webmanifest"));
    expect([m.name, m.short_name]).toEqual(["Academia", "Academia"]);
    const route = read("src/routes/academia-app.tsx");
    expect(route).toContain('{ title: "Academia — Learn offline" }');
    expect(route).toContain('{ name: "apple-mobile-web-app-title", content: "Academia" }');
    expect(route).not.toContain("Mathemagine");
  });

  it("keeps the same install identity, so existing Home Screen installs and the offline worker keep working", () => {
    const m = JSON.parse(read("public/academia-app.webmanifest"));
    expect({ id: m.id, start_url: m.start_url, scope: m.scope }).toEqual({ id: "/academia-app", start_url: "/academia-app", scope: "/" });
    expect(read("src/lib/offline/registerAcademiaSW.ts")).toContain('register("/sw.js", { scope: "/" })');
  });

  it("uses Academia in the app header, install buttons and install steps", () => {
    const app = read("src/pages/academiaApp/AcademiaApp.tsx");
    expect(app).toContain('tracking-tight">Academia</span>');
    expect(app).toContain("Install Academia on this device");
    expect(app).not.toMatch(/>\s*Install Mathemagine|"Install Mathemagine"|open Mathemagine\./);
    const steps = DEVICES.flatMap((d) => [...d.copy, ...d.download]).join(" ");
    expect(steps).toContain("Open Academia from its new icon");
    expect(steps).not.toContain("Open Mathemagine from");
    const ios = read("src/components/site/IosInstallGuide.tsx");
    expect(ios).toContain("Put Academia on your iPhone");
    expect(ios).not.toContain("Mathemagine");
    expect(read("src/pages/academiaApp/MyAccount.tsx")).toContain('"Sign in to Academia"');
  });
});

describe("the Academia desktop app changes only what people see", () => {
  const nsi = read("desktop/academia/installer.nsi");
  const main = read("desktop/academia/main.cjs");
  const pkg = JSON.parse(read("desktop/academia/package.json"));

  it("shows Academia as product, window title, shortcut and Apps & features name", () => {
    expect(pkg.productName).toBe("Academia");
    expect(main).toContain('const PRODUCT = "Academia"');
    expect(main).toContain("win.setTitle(PRODUCT)");
    expect(nsi).toContain('Name "Academia"');
    expect(nsi).toContain('"DisplayName" "Academia"');
    expect(nsi).toContain('CreateShortcut "$DESKTOP\\Academia.lnk"');
  });

  it("keeps install folder, uninstall key, app id and data folder, so upgrades keep progress", () => {
    expect(nsi).toContain('InstallDir "$LOCALAPPDATA\\Programs\\Mathemagine"');
    expect(nsi).toContain('!define UNKEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Mathemagine"');
    expect(nsi).toContain('RMDir /r "$APPDATA\\Mathemagine"');
    expect(main).toContain('path.join(app.getPath("appData"), "Mathemagine")');
    expect(main).toContain('app.setAppUserModelId("com.mathgpl.mathemagine")');
    // Old 1.0.1 shortcuts are replaced and an old running copy is closed.
    expect(nsi).toContain('Delete "$DESKTOP\\Mathemagine.lnk"');
    expect(nsi).toContain("taskkill /IM Mathemagine.exe /F");
  });

  it("never touches the Mathemagine platform app's shortcut, folder or exe", () => {
    const platform = read("desktop/mathemagine/installer.nsi");
    expect(platform).toContain('"$DESKTOP\\Mathemagine Platform.lnk"');
    const actions = nsi.split("\n").filter((l) => !l.trim().startsWith(";"));
    expect(actions.filter((l) => l.includes("Mathemagine Platform"))).toEqual([]);
  });
});
