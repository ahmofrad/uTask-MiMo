import createNextIntlPlugin from "next-intl/plugin";
import withSerwist from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");
const withSerwistInit = withSerwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default withSerwistInit(withNextIntl(nextConfig));
