import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const rootDir = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const outputDir = path.join(rootDir, pkg.build?.directories?.output || "dist-desktop");
const productName = pkg.build?.productName || "LegendsOS";
const version = pkg.version;

const SIGNING_ENV_KEYS = [
  "CSC_LINK",
  "CSC_NAME",
  "APPLE_ID",
  "APPLE_API_KEY",
];

function hasProductionSigningConfig() {
  return SIGNING_ENV_KEYS.some((key) => Boolean(process.env[key]));
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

function verifyApp(appPath) {
  run("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
}

function dmgNameForBuildDir(buildDirName) {
  if (buildDirName.includes("arm64")) {
    return `${productName}-${version}-arm64.dmg`;
  }

  return `${productName}-${version}.dmg`;
}

function repairAppBundle(appPath, tempRoot) {
  const cleanAppPath = path.join(
    tempRoot,
    `${path.basename(path.dirname(appPath))}-${path.basename(appPath)}`
  );

  run("/usr/bin/ditto", ["--norsrc", "--noextattr", appPath, cleanAppPath]);
  run("/usr/bin/codesign", [
    "--force",
    "--deep",
    "--sign",
    "-",
    "--timestamp=none",
    cleanAppPath,
  ]);
  verifyApp(cleanAppPath);

  rmSync(appPath, { recursive: true, force: true });
  run("/usr/bin/ditto", ["--norsrc", "--noextattr", cleanAppPath, appPath]);

  return cleanAppPath;
}

function rebuildDmg(cleanAppPath, dmgPath, tempRoot) {
  const stageDir = path.join(
    tempRoot,
    `${path.basename(dmgPath, ".dmg")}-stage`
  );
  const mountPoint = path.join(
    tempRoot,
    `${path.basename(dmgPath, ".dmg")}-mount`
  );

  mkdirSync(stageDir, { recursive: true });
  mkdirSync(mountPoint, { recursive: true });

  run("/usr/bin/ditto", [
    "--norsrc",
    "--noextattr",
    cleanAppPath,
    path.join(stageDir, `${productName}.app`),
  ]);
  symlinkSync("/Applications", path.join(stageDir, "Applications"));

  rmSync(dmgPath, { force: true });
  rmSync(`${dmgPath}.blockmap`, { force: true });
  rmSync(path.join(outputDir, "latest-mac.yml"), { force: true });

  run("/usr/bin/hdiutil", [
    "create",
    "-volname",
    productName,
    "-srcfolder",
    stageDir,
    "-ov",
    "-format",
    "UDZO",
    dmgPath,
  ]);

  try {
    run("/usr/bin/hdiutil", [
      "attach",
      "-readonly",
      "-nobrowse",
      "-mountpoint",
      mountPoint,
      dmgPath,
    ]);
    verifyApp(path.join(mountPoint, `${productName}.app`));
  } finally {
    try {
      run("/usr/bin/hdiutil", ["detach", mountPoint, "-quiet"]);
    } catch (_err) {
      run("/usr/bin/hdiutil", ["detach", mountPoint, "-force", "-quiet"]);
    }
  }
}

if (process.platform !== "darwin") {
  console.log("[desktop] Mac test-build repair skipped outside macOS.");
  process.exit(0);
}

if (hasProductionSigningConfig()) {
  console.log(
    "[desktop] Production signing config detected; skipped local ad-hoc repair."
  );
  process.exit(0);
}

if (!existsSync(outputDir)) {
  throw new Error(`Desktop output directory not found: ${outputDir}`);
}

const buildDirs = readdirSync(outputDir)
  .filter((entry) => entry.startsWith("mac"))
  .map((entry) => ({
    name: entry,
    appPath: path.join(outputDir, entry, `${productName}.app`),
    dmgPath: path.join(outputDir, dmgNameForBuildDir(entry)),
  }))
  .filter(({ appPath }) => existsSync(appPath));

if (buildDirs.length === 0) {
  throw new Error("No macOS app bundles found under dist-desktop/mac*.");
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "legendsos-mac-repair-"));

try {
  for (const build of buildDirs) {
    console.log(`[desktop] Repairing ${build.appPath}`);
    const cleanAppPath = repairAppBundle(build.appPath, tempRoot);

    if (existsSync(build.dmgPath)) {
      console.log(`[desktop] Rebuilding ${build.dmgPath}`);
      rebuildDmg(cleanAppPath, build.dmgPath, tempRoot);
    }
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("[desktop] Local Mac test build repaired and verified.");
