/**
 * Utility functions for file attachments and type formatting in KNOT.
 */

export function getFileExtension(fileName) {
  if (!fileName || typeof fileName !== "string") return "";
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function getFileCategory(fileName, mimeType = "") {
  const ext = getFileExtension(fileName);
  const mime = (mimeType || "").toLowerCase();

  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext)
  ) {
    return "image";
  }

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    ["xlsx", "xls", "csv", "ods", "tsv"].includes(ext)
  ) {
    return "excel";
  }

  if (mime.includes("pdf") || ext === "pdf") {
    return "pdf";
  }

  if (
    mime.includes("word") ||
    mime.includes("wordprocessingml") ||
    mime.includes("rtf") ||
    ["doc", "docx", "odt", "rtf"].includes(ext)
  ) {
    return "word";
  }

  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("tar") ||
    mime.includes("gzip") ||
    ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)
  ) {
    return "archive";
  }

  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    ["ppt", "pptx", "odp"].includes(ext)
  ) {
    return "presentation";
  }

  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)
  ) {
    return "audio";
  }

  if (
    mime.startsWith("video/") ||
    ["mp4", "mkv", "mov", "avi", "webm", "wmv"].includes(ext)
  ) {
    return "video";
  }

  if (
    mime.startsWith("text/") ||
    [
      "txt",
      "md",
      "json",
      "js",
      "jsx",
      "ts",
      "tsx",
      "html",
      "css",
      "py",
      "java",
      "c",
      "cpp",
      "sh",
      "sql",
      "xml",
      "yaml",
      "yml",
      "log",
    ].includes(ext)
  ) {
    return "code";
  }

  return "generic";
}

export function getFileBadgeText(fileName) {
  const ext = getFileExtension(fileName);
  if (!ext) return "FILE";

  if (["xlsx", "xls"].includes(ext)) return "XLSX";
  if (ext === "csv") return "CSV";
  if (ext === "pdf") return "PDF";
  if (["docx", "doc"].includes(ext)) return "DOCX";
  if (["zip", "7z", "rar", "tar", "gz"].includes(ext)) return ext.toUpperCase();
  if (["txt", "json", "md", "log", "sql"].includes(ext)) return ext.toUpperCase();
  if (["pptx", "ppt"].includes(ext)) return "PPTX";

  return ext.toUpperCase().slice(0, 4);
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function isImageMimeOrExt(mimeType, fileName) {
  if (mimeType && mimeType.startsWith("image/")) return true;
  const ext = getFileExtension(fileName);
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
}
