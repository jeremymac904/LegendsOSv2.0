import { execSync } from "node:child_process";

// Bake deploy provenance into the bundle so /api/goat/repo/status can report
// exactly what is running. Netlify provides COMMIT_REF/BRANCH at build time;
// local builds fall back to git (best-effort — empty strings off-repo).
function gitFallback(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
const buildCommit = process.env.COMMIT_REF || gitFallback("git rev-parse HEAD");
const buildBranch = process.env.BRANCH || gitFallback("git rev-parse --abbrev-ref HEAD");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    GOAT_BUILD_COMMIT: buildCommit,
    GOAT_BUILD_BRANCH: buildBranch,
    GOAT_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "v3.fal.media" },
    ],
  },
};

export default nextConfig;
