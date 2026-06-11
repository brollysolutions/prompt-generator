import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/prompt_generator",
  trailingSlash: true,
};

export default nextConfig;
