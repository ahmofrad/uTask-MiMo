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
