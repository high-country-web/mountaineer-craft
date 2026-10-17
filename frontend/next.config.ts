import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
//import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // OpenNext selects Emotion's workerd exports; Next's Node trace otherwise
  // omits those files from the standalone server bundle used by Cloudflare.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@emotion/*/dist/**/*", "./node_modules/@emotion/react/**/dist/**/*"],
  },
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
};

// const withMDX = createMDX({
//   // Add markdown plugins here, as desired
// })

// export default withMDX(nextConfig)

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
