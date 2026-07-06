export async function register() {
  // Workers are started via a separate process: `pnpm worker`
  // The instrumentation hook is not suitable for BullMQ because
  // webpackIgnore doesn't work reliably at runtime with Next.js server bundles.
}
