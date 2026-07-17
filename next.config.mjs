/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const identityProxyBase = (
  process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL ?? "https://www.suppercollective.org/.netlify/identity"
).replace(/\/+$/, "");

const functionsProxyBase = (
  process.env.NEXT_PUBLIC_NETLIFY_FUNCTIONS_URL ?? "https://www.suppercollective.org/.netlify/functions"
).replace(/\/+$/, "");

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: "/.netlify/identity/:path*",
        destination: `${identityProxyBase}/:path*`,
      },
      {
        source: "/.netlify/functions/:path*",
        destination: `${functionsProxyBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
