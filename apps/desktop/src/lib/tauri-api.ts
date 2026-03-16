import { invoke } from "@tauri-apps/api/core";

import type { ArchiveContents, ArchiveFileSummary, AttachmentResource, DesktopApi } from "./types";

declare global {
  interface Window {
    __WTB_DESKTOP_API__?: DesktopApi;
    __TAURI_INTERNALS__?: {
      invoke: (command: string, args?: unknown, options?: unknown) => Promise<unknown>;
    };
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  if (typeof payload === "object" && payload !== null && "error" in payload && payload.error) {
    throw new Error(payload.error);
  }

  return payload;
}

function base64ToBlobUrl(base64: string, mimeType?: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
}

const fallbackApi: DesktopApi = {
  async getInitialBackupDirectory() {
    const response = await fetch("/__wtb/initial-backup-directory");
    const payload = await parseJsonResponse<{ directoryPath: string }>(response);
    return payload.directoryPath;
  },
  async chooseBackupDirectory() {
    throw new Error("Folder selection is only available in the desktop app.");
  },
  async scanBackupDirectory(directoryPath: string) {
    const response = await fetch(
      `/__wtb/scan-backup-directory?directoryPath=${encodeURIComponent(directoryPath)}`,
    );
    return parseJsonResponse<ArchiveFileSummary[]>(response);
  },
  async readArchiveContents(archivePath: string) {
    const response = await fetch(
      `/__wtb/read-archive-contents?archivePath=${encodeURIComponent(archivePath)}`,
    );
    return parseJsonResponse<ArchiveContents>(response);
  },
  async getAttachmentResource(archivePath: string, entryName: string) {
    const response = await fetch(
      `/__wtb/attachment-binary?archivePath=${encodeURIComponent(archivePath)}&entryName=${encodeURIComponent(entryName)}`,
    );

    if (!response.ok) {
      let message = `Request failed (${response.status})`;

      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        // Ignore JSON parsing failures and keep the generic status error.
      }

      throw new Error(message);
    }

    const mimeType = response.headers.get("Content-Type") || undefined;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return {
      url: objectUrl,
      kind: "blobUrl" as const,
      mimeType,
      cacheKey: `${archivePath}::${entryName}`,
    } satisfies AttachmentResource;
  },
};

const tauriApi: DesktopApi = {
  async getInitialBackupDirectory() {
    return invoke<string>("get_initial_backup_directory");
  },
  async chooseBackupDirectory() {
    return invoke<string | null>("choose_backup_directory");
  },
  async scanBackupDirectory(directoryPath: string) {
    return invoke<ArchiveFileSummary[]>("scan_backup_directory", { directoryPath });
  },
  async readArchiveContents(archivePath: string) {
    return invoke<ArchiveContents>("read_archive_contents", { archivePath });
  },
  async getAttachmentResource(archivePath: string, entryName: string) {
    const resource = await invoke<AttachmentResource>("get_attachment_resource", {
      archivePath,
      entryName,
    });

    if (resource.kind !== "blobUrl") {
      return resource;
    }

    return {
      ...resource,
      url: base64ToBlobUrl(resource.url, resource.mimeType),
    };
  },
};

export function getDesktopApi(): DesktopApi {
  if (typeof window !== "undefined" && window.__WTB_DESKTOP_API__) {
    return window.__WTB_DESKTOP_API__;
  }

  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    return tauriApi;
  }

  return fallbackApi;
}

