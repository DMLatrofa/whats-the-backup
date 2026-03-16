import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@wtb/parser";

import { MessageBubble } from "./MessageBubble";
import type { DesktopApi } from "@/lib/types";

function createDesktopApiMock(fetchResource: DesktopApi["getAttachmentResource"]): DesktopApi {
  return {
    async getInitialBackupDirectory() {
      return "C:/backup";
    },
    async chooseBackupDirectory() {
      return null;
    },
    async scanBackupDirectory() {
      return [];
    },
    async readArchiveContents() {
      return {
        archivePath: "C:/backup/chat.zip",
        chatText: "",
        attachments: [],
      };
    },
    getAttachmentResource: fetchResource,
  };
}

const imageMessage = {
  id: "message-1",
  sender: "Alice Example",
  timestamp: "2026-02-26T12:52:52.000Z",
  text: "<attached: 00001180-PHOTO-2026-02-26-12-52-52.jpg>",
  isSystem: false,
  type: "image",
  attachment: {
    entryName: "00001180-PHOTO-2026-02-26-12-52-52.jpg",
    mimeType: "image/jpeg",
    type: "image",
    size: 123,
  },
} as unknown as Message;

const pdfMessage = {
  id: "message-2",
  sender: "Bob Example",
  timestamp: "2026-03-14T12:07:29.000Z",
  text: "<attached: invoice.pdf>",
  isSystem: false,
  type: "document",
  attachment: {
    entryName: "invoice.pdf",
    mimeType: "application/pdf",
    type: "document",
    size: 456,
  },
} as unknown as Message;

const unknownMessage = {
  id: "message-3",
  sender: "Bob Example",
  timestamp: "2026-03-14T12:07:29.000Z",
  text: "<attached: archive.bin>",
  isSystem: false,
  type: "unknown",
  attachment: {
    entryName: "archive.bin",
    mimeType: "application/octet-stream",
    type: "unknown",
    size: 789,
  },
} as unknown as Message;

describe("MessageBubble", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses cached visual media across remounts", async () => {
    const getAttachmentResource = vi.fn(async () => ({
      url: "blob:test-image",
      kind: "blobUrl" as const,
      mimeType: "image/jpeg",
    }));

    window.__WTB_DESKTOP_API__ = createDesktopApiMock(getAttachmentResource);

    const firstRender = render(
      <MessageBubble archivePath="C:/backup/chat.zip" message={imageMessage} selfSender={null} />,
    );

    expect(screen.getByText("Loading image...")).toBeInTheDocument();
    expect(document.querySelector('.attachment-visual-shell[data-phase="loading"]')).not.toBeNull();

    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("src", "blob:test-image");
    });

    expect(document.querySelector('.attachment-visual-shell[data-phase="loaded"]')).not.toBeNull();
    expect(getAttachmentResource).toHaveBeenCalledTimes(1);

    firstRender.unmount();

    render(<MessageBubble archivePath="C:/backup/chat.zip" message={imageMessage} selfSender={null} />);

    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:test-image");
    expect(screen.queryByText("Loading image...")).not.toBeInTheDocument();
    expect(getAttachmentResource).toHaveBeenCalledTimes(1);
  });

  it("renders document attachments as links when the resource is ready", async () => {
    const getAttachmentResource = vi.fn(async () => ({
      url: "blob:test-pdf",
      kind: "blobUrl" as const,
      mimeType: "application/pdf",
    }));

    window.__WTB_DESKTOP_API__ = createDesktopApiMock(getAttachmentResource);

    render(<MessageBubble archivePath="C:/backup/chat.zip" message={pdfMessage} selfSender={null} />);

    expect(screen.getByText("Loading document...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /document/i })).toHaveAttribute("href", "blob:test-pdf");
    });

    const link = screen.getByRole("link", { name: /document/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  it("keeps unknown attachments non-clickable", async () => {
    const getAttachmentResource = vi.fn(async () => ({
      url: "blob:test-unknown",
      kind: "blobUrl" as const,
      mimeType: "application/octet-stream",
    }));

    window.__WTB_DESKTOP_API__ = createDesktopApiMock(getAttachmentResource);

    render(<MessageBubble archivePath="C:/backup/chat.zip" message={unknownMessage} selfSender={null} />);

    await waitFor(() => {
      expect(screen.getByText("Attachment")).toBeInTheDocument();
    });

    expect(screen.queryByRole("link", { name: /attachment/i })).not.toBeInTheDocument();
    expect(screen.getByText("archive.bin")).toBeInTheDocument();
  });
});
