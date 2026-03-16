import type { ChatBackup, ChatBackupSummary } from "@wtb/parser";

export interface ArchiveFileSummary {
  archivePath: string;
  fileName: string;
  size: number;
}

export interface ArchiveContents {
  archivePath: string;
  chatText: string;
  attachments: Array<{
    entryName: string;
    size: number;
  }>;
}

export interface AttachmentResource {
  url: string;
  kind: "blobUrl" | "fileUrl";
  mimeType?: string;
  cacheKey?: string;
}

export interface ArchiveLoadIssue {
  archivePath: string;
  fileName: string;
  message: string;
}

export interface ScanBackupResult {
  archives: ArchiveFileSummary[];
  issues: ArchiveLoadIssue[];
}

export interface DesktopApi {
  getInitialBackupDirectory(): Promise<string>;
  chooseBackupDirectory(): Promise<string | null>;
  scanBackupDirectory(directoryPath: string): Promise<ArchiveFileSummary[]>;
  readArchiveContents(archivePath: string): Promise<ArchiveContents>;
  getAttachmentResource(archivePath: string, entryName: string): Promise<AttachmentResource>;
}

export interface DesktopState {
  backupDirectory: string;
  chats: ChatBackupSummary[];
  selectedChat: ChatBackup | null;
}
