import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".html": "text/html",
};

export async function GET(
  _request: Request,
  { params }: { params: { file: string[] } },
) {
  const filePath = params.file.join("/");
  const swaggerDir = path.join(
    process.cwd(),
    "node_modules",
    "swagger-ui-dist",
  );
  const fullPath = path.join(swaggerDir, filePath);

  if (!fullPath.startsWith(swaggerDir)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const content = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    return new NextResponse(content, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
