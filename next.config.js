"use client";
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    // Ignora errores de TypeScript en producción (no usamos TS extensivamente)
    ignoreBuildErrors: true,
  },
  // google-map-react ya no se usa; se eliminó la configuración de transpilePackages
};

module.exports = nextConfig;
