/**
 * Minimal single-page PDF that embeds one JPEG image (DCTDecode). This is the
 * smallest subset of the PDF spec that Acrobat/Preview/Chrome accept, written
 * so we can export charts without pulling in a PDF dependency. The image is
 * centered and scaled to fit A4 with a 36pt margin.
 */
export type JpegPdfOptions = {
  /** Image width in pixels. */
  widthPx: number;
  /** Image height in pixels. */
  heightPx: number;
  /** Raw JPEG bytes (DCT stream). */
  jpegBytes: Uint8Array;
};

const ENCODER = new TextEncoder();

export function buildJpegPdf({ widthPx, heightPx, jpegBytes }: JpegPdfOptions): Uint8Array {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    throw new Error("Invalid image dimensions for PDF export");
  }

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;

  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? ENCODER.encode(data) : data;
    offsets.push(size);
    chunks.push(bytes);
    size += bytes.length;
  };

  // A4 in PostScript points; the long side is 842.
  const pageW = 842;
  const pageH = 595;
  const isLandscape = widthPx > heightPx;
  const pw = isLandscape ? pageW : pageH;
  const ph = isLandscape ? pageH : pageW;

  // Fit the image within the page, keeping a 36pt margin on every side.
  const maxW = pw - 72;
  const maxH = ph - 72;
  const scale = Math.min(maxW / widthPx, maxH / heightPx);
  const drawW = Math.max(1, Math.round(widthPx * scale));
  const drawH = Math.max(1, Math.round(heightPx * scale));
  const x = Math.round((pw - drawW) / 2);
  const y = Math.round((ph - drawH) / 2);

  const contents = `q ${drawW} 0 0 ${drawH} ${x} ${y} cm /Im0 Do Q`;

  push("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n");
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
  );
  push(`4 0 obj\n<< /Length ${contents.length} >>\nstream\n${contents}\nendstream\nendobj\n`);
  push(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  push(jpegBytes);
  push("\nendstream\nendobj\n");

  const xrefOffset = size;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    const offset = offsets[i] ?? 0;
    push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(size);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
