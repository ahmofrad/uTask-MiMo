function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match?.[1] ?? null;
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  // Attach CSRF token on state-changing requests
  if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
    const token = getCsrfToken();
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    if (token && !headers.has("x-csrf-token")) {
      headers.set("x-csrf-token", token);
    }
    if (!headers.has("Content-Type") && options.body && !isFormData) {
      headers.set("Content-Type", "application/json");
    }

    if (
      method === "POST" &&
      !headers.has("Idempotency-Key") &&
      /\/api\/v1\/(?:(?:public\/)?tasks(?:\/[^/]+\/comments)?|groups\/[^/]+\/members)$/.test(
        new URL(url, window.location.origin).pathname,
      )
    ) {
      headers.set("Idempotency-Key", crypto.randomUUID());
    }
  }

  return fetch(url, { ...options, headers });
}
