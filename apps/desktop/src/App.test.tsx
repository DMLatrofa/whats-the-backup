import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { DesktopApi } from "./lib/types";

function createMockApi(overrides: Partial<DesktopApi> = {}): DesktopApi {
  return {
    async getInitialBackupDirectory() {
      return "C:/backup";
    },
    async chooseBackupDirectory() {
      return "D:/exports";
    },
    async scanBackupDirectory() {
      return [
        {
          archivePath: "C:/backup/WhatsApp Chat - Alice Example.zip",
          fileName: "WhatsApp Chat - Alice Example.zip",
          size: 123,
        },
      ];
    },
    async readArchiveContents() {
      return {
        archivePath: "C:/backup/WhatsApp Chat - Alice Example.zip",
        chatText:
          "[22/11/19, 08:31:08] Alice Example: Hello\n[22/11/19, 08:31:09] Bob Example: World",
        attachments: [],
      };
    },
    async getAttachmentResource() {
      return {
        url: "blob:test-audio",
        kind: "blobUrl" as const,
        mimeType: "audio/ogg;codecs=opus",
      };
    },
    ...overrides,
  };
}

describe("App", () => {
  beforeEach(() => {
    window.__WTB_DESKTOP_API__ = createMockApi();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the shell and auto-loads the initial backup directory", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("1 backups loaded")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open backup import" }));
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByText("C:/backup")).toBeInTheDocument();
    expect(screen.getByText(/The selected folder is remembered/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Leave empty to keep the current detection logic")).toBeInTheDocument();
  });

  it("runs the initial auto-scan once on mount", async () => {
    const scanBackupDirectory = vi.fn<DesktopApi["scanBackupDirectory"]>().mockResolvedValue([]);
    window.__WTB_DESKTOP_API__ = createMockApi({ scanBackupDirectory });

    render(<App />);

    await waitFor(() => {
      expect(scanBackupDirectory).toHaveBeenCalledTimes(1);
    });

    expect(scanBackupDirectory).toHaveBeenCalledWith("C:/backup");
  });

  it("updates the selected backup directory when the picker returns a path", async () => {
    window.__WTB_DESKTOP_API__ = createMockApi({
      chooseBackupDirectory: vi.fn<DesktopApi["chooseBackupDirectory"]>().mockResolvedValue("D:/exports"),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open backup import" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open backup import" }));
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose folder" }));

    await waitFor(() => {
      expect(screen.getByText("D:/exports")).toBeInTheDocument();
    });

    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
  });

  it("keeps the current backup directory when the picker is cancelled", async () => {
    window.__WTB_DESKTOP_API__ = createMockApi({
      chooseBackupDirectory: vi.fn<DesktopApi["chooseBackupDirectory"]>().mockResolvedValue(null),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open backup import" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open backup import" }));
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose folder" }));

    await waitFor(() => {
      expect(screen.getByText("C:/backup")).toBeInTheDocument();
    });
  });

  it("keeps valid chats when one archive cannot be read", async () => {
    const readArchiveContents = vi
      .fn<DesktopApi["readArchiveContents"]>()
      .mockImplementation(async (archivePath) => {
        if (archivePath.includes("broken")) {
          throw new Error("_chat.txt not found");
        }

        return {
          archivePath,
          chatText:
            "[22/11/19, 08:31:08] Alice Example: Hello\n[22/11/19, 08:31:09] Bob Example: World",
          attachments: [],
        };
      });

    window.__WTB_DESKTOP_API__ = createMockApi({
      async scanBackupDirectory() {
        return [
          {
            archivePath: "C:/backup/WhatsApp Chat - valid.zip",
            fileName: "WhatsApp Chat - valid.zip",
            size: 123,
          },
          {
            archivePath: "C:/backup/WhatsApp Chat - broken.zip",
            fileName: "WhatsApp Chat - broken.zip",
            size: 456,
          },
        ];
      },
      readArchiveContents,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("1 backups loaded, 1 skipped")).toBeInTheDocument();
    });

    expect(screen.getAllByText("valid")).toHaveLength(2);
    expect(screen.queryByText(/_chat\.txt not found/i)).not.toBeInTheDocument();
  });

  it("keeps the selected directory visible when the initial auto-scan fails", async () => {
    window.__WTB_DESKTOP_API__ = createMockApi({
      scanBackupDirectory: vi.fn<DesktopApi["scanBackupDirectory"]>().mockRejectedValue(new Error("Folder not found")),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Folder not found")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByText("C:/backup")).toBeInTheDocument();
  });
});
