import type { NextConfig } from "next";
import path from "node:path";
//import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  outputFileTracingIncludes: { "/wiki": ["../wiki/**/*.md"], "/wiki/**": ["../wiki/**/*.md"] },
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
};

// const withMDX = createMDX({
//   // Add markdown plugins here, as desired
// })

// export default withMDX(nextConfig)

export default nextConfig;
