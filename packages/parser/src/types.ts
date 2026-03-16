import { z } from "zod";

export type AttachmentType =
  | "audio"
  | "document"
  | "gif"
  | "image"
  | "sticker"
  | "text"
  | "unknown"
  | "video";

export interface AttachmentManifestEntry {
  entryName: string;
  size: number;
}

export interface AttachmentRef {
  entryName: string;
  size: number | null;
  mimeType: string;
  type: AttachmentType;
}

export interface Message {
  id: string;
  timestamp: string;
  sender: string;
  text: string;
  type: AttachmentType;
  attachment: AttachmentRef | null;
  isSystem: boolean;
}

export interface ChatBackupSummary {
  id: string;
  title: string;
  archivePath: string;
  participants: string[];
  messageCount: number;
  startedAt: string | null;
  endedAt: string | null;
}

export interface ChatBackup extends ChatBackupSummary {
  messages: Message[];
}

export interface RawArchiveContents {
  archivePath: string;
  chatText: string;
  attachments: AttachmentManifestEntry[];
}

export const attachmentManifestEntrySchema = z.object({
  entryName: z.string(),
  size: z.number().int().nonnegative(),
});

export const rawArchiveContentsSchema = z.object({
  archivePath: z.string(),
  chatText: z.string(),
  attachments: z.array(attachmentManifestEntrySchema),
});
