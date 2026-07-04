import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // Allow cross-origin dev requests from network IPs
  allowedDevOrigins: ["172.31.252.14"],
};

export default withNextIntl(nextConfig);
