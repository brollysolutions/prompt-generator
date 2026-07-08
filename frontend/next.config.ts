import type { NextConfig } from "next";

const useBasePath = process.env.USE_BASE_PATH === 'true';

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: useBasePath ? '/prompt_generator' : '',
  trailingSlash: useBasePath,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
