import { useState } from "react";

import { cx } from "../../lib/cx";
import { getFileTypeKind, type FileTypeKind } from "./fileType";

type FileTypeIconProps = {
  className?: string;
  mimeType?: string;
  name: string;
  previewSrc?: string | null;
  size?: "grid" | "list";
  type: "asset" | "folder";
};

type FileTypePalette = {
  accent: string;
  badge: string;
  background: string;
  foreground: string;
};

const palettes: Record<FileTypeKind, FileTypePalette> = {
  archive: { accent: "#a855f7", background: "#faf5ff", badge: "ZIP", foreground: "#7e22ce" },
  audio: { accent: "#db2777", background: "#fdf2f8", badge: "AUD", foreground: "#be185d" },
  docx: { accent: "#2563eb", background: "#eff6ff", badge: "W", foreground: "#1d4ed8" },
  image: { accent: "#7c3aed", background: "#f5f3ff", badge: "IMG", foreground: "#6d28d9" },
  other: { accent: "#64748b", background: "#f8fafc", badge: "FILE", foreground: "#475569" },
  pdf: { accent: "#dc2626", background: "#fef2f2", badge: "PDF", foreground: "#b91c1c" },
  presentation: { accent: "#ea580c", background: "#fff7ed", badge: "PPT", foreground: "#c2410c" },
  spreadsheet: { accent: "#16a34a", background: "#f0fdf4", badge: "XLS", foreground: "#15803d" },
  text: { accent: "#64748b", background: "#f8fafc", badge: "TXT", foreground: "#475569" },
  video: { accent: "#0891b2", background: "#ecfeff", badge: "VID", foreground: "#0e7490" },
  folder: { accent: "#f59e0b", background: "#fffbeb", badge: "", foreground: "#d97706" },
};

export function FileTypeIcon({ className, mimeType, name, previewSrc, size = "grid", type }: FileTypeIconProps) {
  const kind = getFileTypeKind(type, name, mimeType);
  const palette = palettes[kind];
  const [failedPreviewSrc, setFailedPreviewSrc] = useState<string | null>(null);
  const showPreview = kind === "image" && Boolean(previewSrc) && previewSrc !== failedPreviewSrc;
  const iconSize = showPreview && size === "grid" ? "h-full w-full" : size === "grid" ? "h-16 w-16" : "h-8 w-8";

  return (
    <span
      aria-hidden="true"
      className={cx("inline-grid min-h-0 min-w-0 place-items-center", iconSize, className)}
      data-file-type={kind}
    >
      {showPreview ? (
        <img
          alt=""
          className="h-full w-full rounded-md object-cover"
          loading="lazy"
          onError={() => setFailedPreviewSrc(previewSrc ?? null)}
          src={previewSrc ?? undefined}
        />
      ) : kind === "folder" ? (
        <FolderGlyph palette={palette} />
      ) : (
        <DocumentGlyph kind={kind} palette={palette} />
      )}
    </span>
  );
}

function FolderGlyph({ palette }: { palette: FileTypePalette }) {
  return (
    <svg className="h-full w-full" fill="none" viewBox="0 0 64 64">
      <path d="M7 18.5c0-2.2 1.8-4 4-4h14l5 5h23c2.2 0 4 1.8 4 4v21c0 2.2-1.8 4-4 4H11c-2.2 0-4-1.8-4-4v-26Z" fill={palette.background} stroke={palette.accent} strokeWidth="2.5" />
      <path d="M7 24.5h50l-4.2 18.2c-.4 1.7-1.9 2.8-3.6 2.8H14.8c-1.7 0-3.2-1.1-3.6-2.8L7 24.5Z" fill={palette.accent} opacity=".16" />
      <path d="M8 24h48" stroke={palette.accent} strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function DocumentGlyph({ kind, palette }: { kind: FileTypeKind; palette: FileTypePalette }) {
  return (
    <svg className="h-full w-full" fill="none" viewBox="0 0 64 64">
      <path d="M14 5.5h23.5L49.5 17v41.5H14V5.5Z" fill={palette.background} stroke={palette.accent} strokeWidth="2.5" />
      <path d="M37.5 5.5V18h12" fill={palette.background} stroke={palette.accent} strokeLinejoin="round" strokeWidth="2.5" />
      <path d="M22 27h19M22 33h14" stroke={palette.accent} strokeLinecap="round" strokeWidth="2.5" />
      {kind === "image" ? <ImageMark color={palette.foreground} /> : null}
      {kind === "video" ? <VideoMark color={palette.foreground} /> : null}
      {kind === "audio" ? <AudioMark color={palette.foreground} /> : null}
      {kind === "spreadsheet" ? <SpreadsheetMark color={palette.foreground} /> : null}
      {kind === "presentation" ? <PresentationMark color={palette.foreground} /> : null}
      {kind !== "image" && kind !== "video" && kind !== "audio" && kind !== "spreadsheet" && kind !== "presentation" ? (
        <Badge color={palette.foreground} label={palette.badge} />
      ) : null}
    </svg>
  );
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <>
      <rect fill={color} height="15" rx="3" width={label.length > 3 ? "32" : "23"} x={label.length > 3 ? "16" : "20.5"} y="39" />
      <text fill="white" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize={label.length > 3 ? "6.5" : "9"} fontWeight="700" textAnchor="middle" x="32" y="49.5">
        {label}
      </text>
    </>
  );
}

function ImageMark({ color }: { color: string }) {
  return (
    <path d="m20 49 7.5-8 5.5 5 4-4 7 7H20Zm3.5-12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill={color} />
  );
}

function VideoMark({ color }: { color: string }) {
  return <path d="m26 39 11 7-11 7V39Z" fill={color} />;
}

function AudioMark({ color }: { color: string }) {
  return <path d="M26 45h4l6-5v13l-6-5h-4v-3Zm12.5-3.5a5.8 5.8 0 0 1 0 9" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />;
}

function SpreadsheetMark({ color }: { color: string }) {
  return (
    <>
      <rect fill={color} height="14" rx="2" width="23" x="20.5" y="39.5" />
      <path d="M28.2 40v13M36 40v13M21 46.5h22" stroke="white" strokeWidth="1.2" />
    </>
  );
}

function PresentationMark({ color }: { color: string }) {
  return (
    <>
      <rect fill={color} height="14" rx="2" width="24" x="20" y="39.5" />
      <path d="M24 49h16M32 42v7" stroke="white" strokeLinecap="round" strokeWidth="1.8" />
    </>
  );
}
