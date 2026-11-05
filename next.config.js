const fs = require('fs');
const path = require('path');

// One codebase, several companies: set BRAND (e.g. "cdc") on a Vercel project and any file in
// public/brands/<BRAND>/ is served in place of the file of the same name in public/.
const brand = process.env.BRAND;
const brandDir = brand ? path.join(__dirname, 'public', 'brands', brand) : null;
const brandFiles = brandDir && fs.existsSync(brandDir) ? fs.readdirSync(brandDir) : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: brandFiles.map((file) => ({ source: `/${file}`, destination: `/brands/${brand}/${file}` })),
    };
  },
};

module.exports = nextConfig;
