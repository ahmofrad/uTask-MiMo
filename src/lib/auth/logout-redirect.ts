export function getLogoutRedirectUrl(origin: string): string {
  return new URL("/login", origin).toString();
}
