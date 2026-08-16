const FORGOT_PASSWORD_PATHS = new Set([
  "/forgot-password",
  "/en-US/forgot-password",
  "/fa-IR/forgot-password",
]);

export function isPublicAuthPage(pathname: string): boolean {
  return FORGOT_PASSWORD_PATHS.has(pathname)
    || pathname.startsWith("/reset-password/")
    || pathname.startsWith("/en-US/reset-password/")
    || pathname.startsWith("/fa-IR/reset-password/")
    || pathname.startsWith("/invite/")
    || pathname.startsWith("/en-US/invite/")
    || pathname.startsWith("/fa-IR/invite/");
}
