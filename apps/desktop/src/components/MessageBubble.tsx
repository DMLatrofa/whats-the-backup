import type { Message } from "@wtb/parser";

import { useAttachmentResource } from "@/lib/attachment-cache";

type AttachmentPhase = "idle" | "loading" | "loaded" | "error";

interface MessageBubbleProps {
  archivePath: string;
  message: Message;
  selfSender: string | null;
}

export function MessageBubble({ archivePath, message, selfSender }: MessageBubbleProps) {
  const attachmentState = useAttachmentResource(archivePath, message.attachment);

  if (message.isSystem) {
    return <div className="system-message">{cleanMessageText(message.text)}</div>;
  }

  const isSelf = selfSender !== null && message.sender === selfSender;
  const timestamp = new Date(message.timestamp).toLocaleString("en-US");

  return (
    <article className={`message-row ${isSelf ? "self" : "other"}`}>
      <div className={`message-bubble ${isSelf ? "self" : "other"}`}>
        <div className="message-meta">
          <span>{message.sender}</span>
          <time>{timestamp}</time>
        </div>
        <AttachmentContent attachmentState={attachmentState} message={message} />
      </div>
    </article>
  );
}

function AttachmentContent({
  attachmentState,
  message,
}: {
  attachmentState: {
    phase: AttachmentPhase;
    resource?: { url: string };
  };
  message: Message;
}) {
  const labelText = cleanAttachmentText(message.text);

  if (!message.attachment) {
    return <p className="message-text">{cleanMessageText(message.text)}</p>;
  }

  if (attachmentState.phase === "error") {
    return (
      <div className="attachment-block">
        {isVisualAttachment(message) ? (
          <div className="attachment-visual-shell attachment-visual-shell-error" data-phase="error">
            <div className="attachment-shell-copy">
              <strong>Unable to load media</strong>
              <div>{message.attachment.entryName}</div>
            </div>
          </div>
        ) : (
          <div className="attachment-error">
            <strong>Unable to load media</strong>
            <div>{message.attachment.entryName}</div>
          </div>
        )}
        {labelText ? <p className="message-text">{labelText}</p> : null}
      </div>
    );
  }

  if (isVisualAttachment(message)) {
    return (
      <div className="attachment-block">
        <div className="attachment-visual-shell" data-phase={attachmentState.phase}>
          {attachmentState.phase === "loaded" && attachmentState.resource ? (
            <VisualAttachment message={message} url={attachmentState.resource.url} />
          ) : (
            <div className="attachment-shell-placeholder">
              <span>Loading {attachmentLabel(message.attachment.type)}...</span>
            </div>
          )}
        </div>
        {labelText ? <p className="message-text">{labelText}</p> : null}
      </div>
    );
  }

  if (message.attachment.type === "document") {
    return (
      <div className="attachment-block">
        {attachmentState.phase === "loaded" && attachmentState.resource ? (
          <a
            className="attachment-document attachment-document-link"
            href={attachmentState.resource.url}
            target="_blank"
            rel="noreferrer"
          >
            <strong>Document</strong>
            <span>{message.attachment.entryName}</span>
          </a>
        ) : (
          <div className="attachment-placeholder">Loading document...</div>
        )}
        {labelText ? <p className="message-text">{labelText}</p> : null}
      </div>
    );
  }

  if (attachmentState.phase !== "loaded" || !attachmentState.resource) {
    return (
      <div className="attachment-block">
        <div className="attachment-placeholder">Loading {attachmentLabel(message.attachment.type)}...</div>
        {labelText ? <p className="message-text">{labelText}</p> : null}
      </div>
    );
  }

  return (
    <div className="attachment-block">
      {message.attachment.type === "audio" ? (
        <audio className="attachment-audio" controls preload="metadata" src={attachmentState.resource.url} />
      ) : null}
      {message.attachment.type === "unknown" ? (
        <div className="attachment-document">
          <strong>Attachment</strong>
          <span>{message.attachment.entryName}</span>
        </div>
      ) : null}
      {labelText ? <p className="message-text">{labelText}</p> : null}
    </div>
  );
}

function VisualAttachment({ message, url }: { message: Message; url: string }) {
  if (message.attachment?.type === "video" || message.attachment?.type === "gif") {
    return <video className="attachment-video" controls preload="metadata" src={url} />;
  }

  return <img className="attachment-image" loading="lazy" src={url} alt={message.attachment?.entryName ?? "Media"} />;
}

function isVisualAttachment(message: Message): boolean {
  return (
    message.attachment?.type === "image" ||
    message.attachment?.type === "sticker" ||
    message.attachment?.type === "video" ||
    message.attachment?.type === "gif"
  );
}

function cleanAttachmentText(value: string): string {
  return value.replace(/<attached: [^>]+>/gi, "").replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim();
}

function cleanMessageText(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim();
}

function attachmentLabel(type: Message["type"]): string {
  switch (type) {
    case "audio":
      return "audio";
    case "image":
    case "sticker":
      return "image";
    case "video":
    case "gif":
      return "video";
    case "document":
      return "document";
    default:
      return "attachment";
  }
}

