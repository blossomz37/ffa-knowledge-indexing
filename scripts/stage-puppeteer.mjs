// Stages the ONE Chromium build that the installed `puppeteer` pins into a
// project-relative folder so electron-builder can bundle it via a *relative*
// extraResources path.
//
// Why this exists: electron-builder keeps a raw-absolute `from:` string as-is,
// but treats a macro-expanded one (e.g. "${env.HOME}/...") as project-relative
// and prepends the project dir — producing a broken "<proj>//Users/..." path.
// Hardcoding an absolute path is not portable across machines/CI. Copying into
// ./.puppeteer-bundle and referencing it relatively is electron-builder's
// supported happy path and works for whoever runs the build.
//
// Why only one build: ~/.cache/puppeteer/chrome can hold many Chromium
// versions. Copying them all bloated the .app to ~3 GB and broke `hdiutil`
// DMG creation. We ask puppeteer for the exact build it will launch
// (executablePath() — version-accurate, host-platform only) and stage just
// that. macOS staging only covers mac_arm; win/linux bundles would need
// `npx puppeteer browsers install chrome` for those platforms + a richer
// script (out of scope — see electron-builder.yml note).

import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// puppeteer.executablePath() returns e.g.
//   ~/.cache/puppeteer/chrome/mac_arm-141.0.7390.76/chrome-mac-arm64/...
// The segment right under ".../chrome/" is the build dir we must stage.
const puppeteer = (await import('puppeteer')).default;
let execPath;
try {
    execPath = puppeteer.executablePath();
} catch (err) {
    console.error(`[stage-puppeteer] puppeteer.executablePath() failed: ${err.message}`);
    process.exit(1);
}

const marker = `${path.sep}chrome${path.sep}`;
const idx = execPath.indexOf(marker);
if (idx === -1) {
    console.error(`[stage-puppeteer] unexpected executablePath layout: ${execPath}`);
    process.exit(1);
}
const cacheChromeDir = execPath.slice(0, idx + marker.length - 1); // .../chrome
const buildId = execPath.slice(idx + marker.length).split(path.sep)[0]; // e.g. mac_arm-141.0.7390.76
const srcBuild = path.join(cacheChromeDir, buildId);

if (!existsSync(srcBuild)) {
    console.error(
        `[stage-puppeteer] Chromium build not found: ${srcBuild}\n` +
        '  Run `npx puppeteer browsers install chrome` (or reinstall deps) first.'
    );
    process.exit(1);
}

const destRoot = path.join(projectRoot, '.puppeteer-bundle');
const destBuild = path.join(destRoot, 'chrome', buildId);

rmSync(destRoot, { recursive: true, force: true });
mkdirSync(destBuild, { recursive: true });
cpSync(srcBuild, destBuild, { recursive: true });

console.log(`[stage-puppeteer] staged ${buildId} → .puppeteer-bundle/chrome/${buildId}`);
