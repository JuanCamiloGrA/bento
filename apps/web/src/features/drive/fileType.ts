export type FileTypeKind =
  | "archive"
  | "audio"
  | "docx"
  | "image"
  | "other"
  | "pdf"
  | "presentation"
  | "spreadsheet"
  | "text"
  | "video"
  | "folder";

const extensionKinds: Record<string, FileTypeKind> = {
  "7z": "archive",
  bz2: "archive",
  csv: "spreadsheet",
  doc: "docx",
  docx: "docx",
  gif: "image",
  gz: "archive",
  jpeg: "image",
  jpg: "image",
  json: "text",
  log: "text",
  markdown: "text",
  md: "text",
  mov: "video",
  mp3: "audio",
  mp4: "video",
  odp: "presentation",
  ods: "spreadsheet",
  odt: "docx",
  pdf: "pdf",
  png: "image",
  ppt: "presentation",
  pptx: "presentation",
  rar: "archive",
  rtf: "text",
  svg: "image",
  tar: "archive",
  txt: "text",
  wav: "audio",
  webm: "video",
  webp: "image",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  xml: "text",
  yaml: "text",
  yml: "text",
  zip: "archive",
};

const mimeKinds: Array<[string, FileTypeKind]> = [
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/msword", "docx"],
  ["application/vnd.oasis.opendocument.text", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "spreadsheet"],
  ["application/vnd.ms-excel", "spreadsheet"],
  ["application/vnd.oasis.opendocument.spreadsheet", "spreadsheet"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "presentation"],
  ["application/vnd.ms-powerpoint", "presentation"],
  ["application/vnd.oasis.opendocument.presentation", "presentation"],
  ["application/zip", "archive"],
  ["application/x-7z-compressed", "archive"],
  ["application/x-rar-compressed", "archive"],
  ["image/", "image"],
  ["video/", "video"],
  ["audio/", "audio"],
  ["text/", "text"],
];

export function getFileTypeKind(type: "asset" | "folder", name: string, mimeType?: string): FileTypeKind {
  if (type === "folder") {
    return "folder";
  }

  const normalizedMimeType = mimeType?.toLowerCase().split(";", 1)[0].trim();
  if (normalizedMimeType) {
    const mimeMatch = mimeKinds.find(([mime]) =>
      mime.endsWith("/") ? normalizedMimeType.startsWith(mime) : normalizedMimeType === mime,
    );
    if (mimeMatch) {
      return mimeMatch[1];
    }
  }

  const extension = name.toLowerCase().split(".").pop();
  return extension ? extensionKinds[extension] ?? "other" : "other";
}
