import { describe, it, expect } from "vitest";
import { buildJpegPdf, type JpegPdfOptions } from "@/lib/pdf/simple";

function makeFakeJpeg(width: number, height: number): Uint8Array {
  // Minimal JPEG-like bytes — the builder only needs the array length to be valid.
  // Real JPEGs start with 0xFF 0xD8 and end with 0xFF 0xD9.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(Math.max(width * height, 10)).fill(0), 0xff, 0xd9]);
}

describe("buildJpegPdf", () => {
  it("produces a valid PDF header", () => {
    const pdf = buildJpegPdf({ widthPx: 100, heightPx: 100, jpegBytes: makeFakeJpeg(100, 100) });
    const header = new TextDecoder().decode(pdf.slice(0, 8));
    expect(header).toBe("%PDF-1.4");
  });

  it("produces a PDF that ends with %%EOF", () => {
    const pdf = buildJpegPdf({ widthPx: 100, heightPx: 100, jpegBytes: makeFakeJpeg(100, 100) });
    const tail = new TextDecoder().decode(pdf.slice(-10));
    expect(tail).toContain("%%EOF");
  });

  it("handles landscape orientation (width > height)", () => {
    const pdf = buildJpegPdf({ widthPx: 800, heightPx: 400, jpegBytes: makeFakeJpeg(800, 400) });
    expect(pdf.length).toBeGreaterThan(0);
    // Landscape: media box should be [0 0 842 595] with swapped dimensions
    const content = new TextDecoder().decode(pdf);
    expect(content).toContain("/MediaBox [0 0 842 595]");
  });

  it("handles portrait orientation (height > width)", () => {
    const pdf = buildJpegPdf({ widthPx: 400, heightPx: 800, jpegBytes: makeFakeJpeg(400, 800) });
    const content = new TextDecoder().decode(pdf);
    expect(content).toContain("/MediaBox [0 0 595 842]");
  });

  it("throws on invalid dimensions", () => {
    expect(() => buildJpegPdf({ widthPx: 0, heightPx: 100, jpegBytes: makeFakeJpeg(0, 100) })).toThrow("Invalid image dimensions");
    expect(() => buildJpegPdf({ widthPx: 100, heightPx: -1, jpegBytes: makeFakeJpeg(100, -1) })).toThrow("Invalid image dimensions");
    expect(() => buildJpegPdf({ widthPx: NaN, heightPx: 100, jpegBytes: makeFakeJpeg(100, 100) })).toThrow("Invalid image dimensions");
  });

  it("includes the JPEG image data in the output", () => {
    const jpeg = makeFakeJpeg(100, 100);
    const pdf = buildJpegPdf({ widthPx: 100, heightPx: 100, jpegBytes: jpeg });
    // The JPEG bytes should be embedded somewhere in the PDF
    const pdfBytes = new Uint8Array(pdf);
    const jpegStart = jpeg[0]!;
    let found = false;
    for (let i = 0; i < pdfBytes.length - jpeg.length; i++) {
      if (pdfBytes[i] === jpegStart && pdfBytes.slice(i, i + Math.min(jpeg.length, 4)).every((b, j) => b === jpeg[j])) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
