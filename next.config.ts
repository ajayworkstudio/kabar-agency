import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // resvg ships a native binary; keep it out of the bundle
  serverExternalPackages: ["@resvg/resvg-js", "linkedom"],
  // make sure the fonts used for card rendering are deployed with the functions
  outputFileTracingIncludes: {
    "/api/**": ["./assets/fonts/**"],
  },
};

export default nextConfig;
