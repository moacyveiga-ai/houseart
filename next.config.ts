import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    turbopackMemoryLimit: 2 * 1024 * 1024 * 1024,
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: { root: path.resolve(__dirname) },
  // `tsc --noEmit` runs BEFORE, in its own process (`build:next`): same check,
  // same rigour, memory that does not add to the bundler's. A type error still
  // fails the deploy through the `&&` of the script.
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["pdf-lib", "sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
