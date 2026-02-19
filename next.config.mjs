/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Turbopack is the default in Next.js 16. Adding an empty config
  // here satisfies the check and avoids the "webpack config but no
  // turbopack config" error. No custom resolve aliases are needed
  // because the Solana/Anchor browser packages handle Node built-ins
  // internally (they ship browser-safe builds).
  turbopack: {},
};

export default nextConfig;
