/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint warnings.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
