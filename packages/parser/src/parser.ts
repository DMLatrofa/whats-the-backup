import {
  rawArchiveContentsSchema,
  type AttachmentRef,
  type ChatBackup,
  type ChatBackupSummary,
  type Message,
  type RawArchiveContents,
} from "./types";
import {
  buildAttachmentMap,
  createChatId,
  inferAttachmentType,
  inferMimeType,
  normalizeLineEndings,
  toIsoDate,
} from "./utils";

const messageStartPattern =
  /^[\u200e\u200f\u202a-\u202e]*\[(\d{1,2})\/(\d{1,2})\/(\d{2}), (\d{1,2}:\d{2}:\d{2})\] (.*)$/;

const attachmentPattern = /<attached: ([^>]+)>/i;

interface PendingMessage {
  timestamp: string;
  content: string;
}

function isLikelySystemContent(content: string): boolean {
  return !content.includes(": ");
}

function finalizeMessage(
  pending: PendingMessage | null,
  index: number,
  archivePath: string,
  attachmentMap: Map<string, { entryName: string; size: number }>,
): Message | null {
  if (!pending) {
    return null;
  }

  const attachmentMatch = pending.content.match(attachmentPattern);
  const isSystem = isLikelySystemContent(pending.content);

  if (isSystem) {
    return {
      id: `${archivePath}::${index}`,
      timestamp: pending.timestamp,
      sender: "system",
      text: pending.content.trim(),
      type: "text",
      attachment: null,
      isSystem: true,
    };
  }

  const separatorIndex = pending.content.indexOf(": ");
  const sender = pending.content.slice(0, separatorIndex).trim();
  const text = pending.content.slice(separatorIndex + 2).trim();

  let attachment: AttachmentRef | null = null;
  if (attachmentMatch) {
    const entryName = attachmentMatch[1].trim();
    const attachmentEntry = attachmentMap.get(entryName);
    attachment = {
      entryName,
      size: attachmentEntry?.size ?? null,
      mimeType: inferMimeType(entryName),
      type: inferAttachmentType(entryName),
    };
  }

  return {
    id: `${archivePath}::${index}`,
    timestamp: pending.timestamp,
    sender,
    text,
    type: attachment?.type ?? "text",
    attachment,
    isSystem: false,
  };
}

function parseMessages(contents: RawArchiveContents): Message[] {
  const attachmentMap = buildAttachmentMap(contents.attachments);
  const lines = normalizeLineEndings(contents.chatText).split("\n");
  const messages: Message[] = [];
  let pending: PendingMessage | null = null;

  lines.forEach((line) => {
    const normalizedLine = line.replace(/^\u200e/, "");
    const match = normalizedLine.match(messageStartPattern);

    if (match) {
      const finalized = finalizeMessage(pending, messages.length, contents.archivePath, attachmentMap);
      if (finalized) {
        messages.push(finalized);
      }

      pending = {
        timestamp: toIsoDate(match[1], match[2], match[3], match[4]),
        content: match[5],
      };
      return;
    }

    if (!pending) {
      return;
    }

    pending = {
      ...pending,
      content: `${pending.content}\n${line}`.trimEnd(),
    };
  });

  const finalized = finalizeMessage(pending, messages.length, contents.archivePath, attachmentMap);
  if (finalized) {
    messages.push(finalized);
  }

  return messages;
}

function deriveTitle(archivePath: string): string {
  const normalized = archivePath.replaceAll("\\", "/");
  const fileName = normalized.split("/").pop() ?? archivePath;
  return fileName.replace(/\.zip$/i, "").replace(/^WhatsApp Chat - /i, "");
}

export function loadChat(rawContents: RawArchiveContents): ChatBackup {
  const contents = rawArchiveContentsSchema.parse(rawContents);
  const messages = parseMessages(contents);
  const participants = Array.from(
    new Set(messages.filter((message) => !message.isSystem).map((message) => message.sender)),
  );

  return {
    id: createChatId(contents.archivePath),
    title: deriveTitle(contents.archivePath),
    archivePath: contents.archivePath,
    participants,
    messageCount: messages.length,
    startedAt: messages[0]?.timestamp ?? null,
    endedAt: messages.at(-1)?.timestamp ?? null,
    messages,
  };
}

export function summarizeChat(rawContents: RawArchiveContents): ChatBackupSummary {
  const chat = loadChat(rawContents);
  return {
    id: chat.id,
    title: chat.title,
    archivePath: chat.archivePath,
    participants: chat.participants,
    messageCount: chat.messageCount,
    startedAt: chat.startedAt,
    endedAt: chat.endedAt,
  };
}

export function filterMessages(messages: Message[], query: string): Message[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return messages;
  }

  return messages.filter((message) => {
    return (
      message.sender.toLowerCase().includes(normalizedQuery) ||
      message.text.toLowerCase().includes(normalizedQuery)
    );
  });
}
