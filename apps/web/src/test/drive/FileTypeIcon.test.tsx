import { describe, expect, it } from "vitest";

import { getFileTypeKind } from "../../features/drive/fileType";

describe("getFileTypeKind", () => {
  it("uses distinct icons for folders, text, Word, PDF and other common files", () => {
    expect(getFileTypeKind("folder", "Documentos")).toBe("folder");
    expect(getFileTypeKind("asset", "notas.txt", "text/plain")).toBe("text");
    expect(getFileTypeKind("asset", "contrato.docx")).toBe("docx");
    expect(getFileTypeKind("asset", "factura.pdf", "application/pdf")).toBe("pdf");
    expect(getFileTypeKind("asset", "backup.zip")).toBe("archive");
    expect(getFileTypeKind("asset", "sin-extension")).toBe("other");
  });

  it("prefers a known MIME type over a misleading filename extension", () => {
    expect(getFileTypeKind("asset", "documento.bin", "application/pdf")).toBe("pdf");
    expect(getFileTypeKind("asset", "foto.pdf", "image/jpeg")).toBe("image");
  });
});
