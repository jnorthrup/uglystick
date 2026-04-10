/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages requires basePath matching the repo name
  basePath: '/uglystick',
  
  // Always use static export for GitHub Pages deployment
  output: 'export',
  distDir: process.env.BUILD_DIR || '../docs',
  
  // GitHub Pages requires trailing slashes for proper routing
  trailingSlash: true,
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
    domains: [
      "source.unsplash.com",
      "images.unsplash.com",
      "ext.same-assets.com",
      "ugc.same-assets.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "source.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ext.same-assets.com",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;