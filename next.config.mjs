/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? '/project-chronorift/' : '',
  basePath: isProd ? '/project-chronorift' : '',
  trailingSlash: true,
};

export default nextConfig;
