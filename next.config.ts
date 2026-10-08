import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // cliente HTTP com mTLS do Itaú: roda como pacote Node, sem bundle
  serverExternalPackages: ["undici"],
  experimental: {
    serverActions: {
      // fotos de produto/logo (o navegador já reduz antes de enviar)
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
