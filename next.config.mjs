import createNextIntlPlugin from "next-intl/plugin";
import withSerwist from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");
const withSerwistInit = withSerwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
});

function getConfiguredDevOrigins() {
  const configuredValues = [
    process.env.NEXT_ALLOWED_DEV_ORIGINS,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  return [...new Set(
    configuredValues
      .flatMap((value) => (value ?? "").split(","))
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        try {
          return new URL(value.includes("://") ? value : `http://${value}`).hostname;
        } catch {
          return null;
        }
      })
      .filter((value) => value !== null),
  )];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds write to `.next-prod`, development to `.next`. Keeping
  // them apart means `next build` can never clobber the dev artifacts a
  // running `next dev` process is serving (the cause of "JS/CSS 404 in dev"
  // after a production build), and vice versa.
  distDir: process.env.NODE_ENV === "production" ? ".next-prod" : ".next",
  // Next 15 blocks cross-origin /_next requests in development. Keep this
  // host-only and opt-in so production does not gain a broader origin policy.
  allowedDevOrigins: getConfiguredDevOrigins(),
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
