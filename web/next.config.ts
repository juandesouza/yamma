import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@yamma/design-system'],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@yamma/design-system': path.resolve(__dirname, '../design-system/src'),
    };
    return config;
  },
};

export default nextConfig;
