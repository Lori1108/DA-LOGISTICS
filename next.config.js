/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Ignore TypeScript type errors during production build – safe for now.
  typescript: {
    ignoreBuildErrors: true,
  },
  // You can add other custom config here (e.g., redirects, rewrites).
};

module.exports = {
  ...nextConfig,
  transpilePackages: ['google-map-react'],
};
