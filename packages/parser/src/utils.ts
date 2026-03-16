import type { AttachmentManifestEntry, AttachmentType } from "./types";

const imageExtensions = new Set(["jpg", "jpeg", "png", "heic"]);
const videoExtensions = new Set(["mp4", "mov", "3gp", "mkv"]);
const audioExtensions = new Set(["opus", "ogg", "mp3", "m4a", "aac", "wav"]);
const documentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"]);

export function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function createChatId(archivePath: string): string {
  return archivePath.toLowerCase().replaceAll("\\", "/");
}

export function inferAttachmentType(entryName: string): AttachmentType {
  const extension = entryName.split(".").pop()?.toLowerCase() ?? "";

  if (entryName.toLowerCase().includes("sticker") || extension === "webp") {
    return "sticker";
  }

  if (imageExtensions.has(extension)) {
    return "image";
  }

  if (videoExtensions.has(extension)) {
    if (entryName.toLowerCase().includes("gif")) {
      return "gif";
    }

    return "video";
  }

  if (audioExtensions.has(extension)) {
    return "audio";
  }

  if (documentExtensions.has(extension)) {
    return "document";
  }

  return "unknown";
}

export function inferMimeType(entryName: string): string {
  const extension = entryName.split(".").pop()?.toLowerCase() ?? "";

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "webp":
      return "image/webp";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "3gp":
      return "video/3gpp";
    case "mkv":
      return "video/x-matroska";
    case "opus":
      return "audio/ogg; codecs=opus";
    case "ogg":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export function buildAttachmentMap(
  attachments: AttachmentManifestEntry[],
): Map<string, AttachmentManifestEntry> {
  return new Map(attachments.map((attachment) => [attachment.entryName, attachment]));
}

export function toIsoDate(day: string, month: string, year: string, time: string): string {
  const fullYear = Number(year) >= 70 ? `19${year}` : `20${year}`;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}`;
}
