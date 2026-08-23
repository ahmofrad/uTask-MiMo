import createNextIntlPlugin from "next-intl/plugin";
import withSerwist from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");
const withSerwistInit = withSerwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default withSerwistInit(withNextIntl(nextConfig));
