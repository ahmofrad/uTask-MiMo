import { describe, it, expect } from "vitest";
import { buildJpegPdf } from "@/lib/pdf/simple";

// A tiny valid JPEG header is enough: the writer embeds the bytes verbatim.
const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0xff, 0xd9,
]);

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("buildJpegPdf", () => {
  it("produces a structurally valid single-page PDF", () => {
    const pdf = buildJpegPdf({ widthPx: 800, heightPx: 600, jpegBytes: JPEG_BYTES });
    const head = text(pdf.slice(0, 8));
    expect(head).toBe("%PDF-1.4");
    const tail = text(pdf.slice(-8));
    expect(tail.endsWith("%%EOF\n")).toBe(true);
  });

  it("writes correct xref offsets for every object", () => {
    const pdf = buildJpegPdf({ widthPx: 800, heightPx: 600, jpegBytes: JPEG_BYTES });
    // Byte-level scan (decoding to a string can change index arithmetic
    // because the embedded JPEG stream is binary).
    const marker = new TextEncoder().encode("startxref");
    let start = -1;
    for (let i = 0; i <= pdf.length - marker.length; i++) {
      if (pdf[i] === marker[0] && pdf.slice(i, i + marker.length).every((b, j) => b === marker[j])) {
        start = i;
        break;
      }
    }
    expect(start).toBeGreaterThan(0);
    let i = start + marker.length;
    while (i < pdf.length && (pdf[i] === 10 || pdf[i] === 13 || pdf[i] === 32)) i++;
    let numberStr = "";
    for (; i < pdf.length && pdf[i] !== 10; i++) {
      numberStr += String.fromCharCode(pdf[i]!);
    }
    const xrefOffset = Number(numberStr.trim());
    expect(Number.isFinite(xrefOffset)).toBe(true);
    // The xref table starts at the recorded offset.
    const xref = new TextEncoder().encode("xref");
    expect(pdf.slice(xrefOffset, xrefOffset + 4).every((b, j) => b === xref[j])).toBe(true);
  });

  it("embeds the JPEG stream with its exact length", () => {
    const pdf = buildJpegPdf({ widthPx: 800, heightPx: 600, jpegBytes: JPEG_BYTES });
    const content = text(pdf);
    expect(content).toContain(`/Length ${JPEG_BYTES.length}`);
    // The stream content itself must appear verbatim.
    let found = -1;
    for (let i = 0; i <= pdf.length - JPEG_BYTES.length; i++) {
      if (pdf[i] === JPEG_BYTES[0] && pdf.slice(i, i + JPEG_BYTES.length).every((b, j) => b === JPEG_BYTES[j])) {
        found = i;
        break;
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it("rejects non-positive dimensions", () => {
    expect(() => buildJpegPdf({ widthPx: 0, heightPx: 600, jpegBytes: JPEG_BYTES })).toThrow();
    expect(() => buildJpegPdf({ widthPx: 800, heightPx: -1, jpegBytes: JPEG_BYTES })).toThrow();
  });

  it("declares the image dimensions in the XObject", () => {
    const pdf = buildJpegPdf({ widthPx: 640, heightPx: 480, jpegBytes: JPEG_BYTES });
    const content = text(pdf);
    expect(content).toContain("/Width 640");
    expect(content).toContain("/Height 480");
    expect(content).toContain("/Filter /DCTDecode");
  });
});
