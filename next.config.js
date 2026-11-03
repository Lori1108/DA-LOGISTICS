"use client";
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    // Ignora errores de TypeScript en producción (no usamos TS extensivamente)
    ignoreBuildErrors: true,
  },
  // Necesario para transpilar paquetes que no están pre‑compilados (google‑map‑react)
  transpilePackages: ['google-map-react'],
};

module.exports = nextConfig;
