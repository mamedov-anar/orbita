import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH ?? "/orbita";
const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: basePath,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
