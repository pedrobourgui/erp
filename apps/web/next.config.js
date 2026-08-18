/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Os pacotes do workspace são publicados como TypeScript cru (main aponta para src/index.ts).
  // Sem isto só dá para usá-los em `import type`; qualquer valor em runtime quebra o build.
  transpilePackages: ["@erp/constants", "@erp/shared-types", "@erp/validators"],
  images: {
    domains: [
      "localhost",
      "api.erp.local",
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
};

module.exports = nextConfig;
