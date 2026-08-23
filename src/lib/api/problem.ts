import { NextResponse } from "next/server";

type ProblemOptions = {
  field?: string;
  instance?: string;
};

const TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

export function problemResponse(
  request: Request,
  status: number,
  code: string,
  detail: string,
  options: ProblemOptions = {},
): NextResponse {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const body = {
    type: `https://taskapp.local/problems/${code.toLowerCase()}`,
    title: TITLES[status] ?? "Request Error",
    status,
    detail,
    instance: options.instance ?? new URL(request.url).pathname,
    requestId,
    code,
    error: {
      code,
      message: detail,
      ...(options.field ? { field: options.field } : {}),
    },
    ...(options.field ? { field: options.field } : {}),
  };

  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/problem+json",
      "X-Request-ID": requestId,
    },
  });
}
