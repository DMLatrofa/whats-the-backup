import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatBackup, Message } from "@wtb/parser";

import { MessageBubble } from "./MessageBubble";

interface ChatViewProps {
  chat: ChatBackup | null;
  messageQuery: string;
  authorQuery: string;
  selfMark: string;
}

export function ChatView({ chat, messageQuery, authorQuery, selfMark }: ChatViewProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const autoScrollKeyRef = useRef<string | null>(null);
  const isPinnedToBottomRef = useRef<boolean>(true);

  const visibleMessages = useMemo(() => {
    if (!chat) {
      return [];
    }

    return filterMessages(chat.messages, messageQuery, authorQuery);
  }, [authorQuery, chat, messageQuery]);

  const rowVirtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateMessageHeight(visibleMessages[index]),
    overscan: 8,
  });

  const chatScrollKey = `${chat?.id ?? "empty"}::${messageQuery}::${authorQuery}::${visibleMessages.length}`;

  useEffect(() => {
    if (!chat || visibleMessages.length === 0) {
      autoScrollKeyRef.current = null;
      isPinnedToBottomRef.current = true;
      return;
    }

    if (autoScrollKeyRef.current === chatScrollKey) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const targetIndex = visibleMessages.length - 1;

    const alignToBottom = () => {
      if (cancelled || !parentRef.current) {
        return;
      }

      rowVirtualizer.scrollToIndex(targetIndex, { align: "end" });

      const scrollElement = parentRef.current;
      const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
      const isNearBottom = maxScrollTop === 0 || scrollElement.scrollTop >= maxScrollTop - 24;

      if (isNearBottom || attempts >= 8) {
        autoScrollKeyRef.current = chatScrollKey;
        isPinnedToBottomRef.current = true;
        return;
      }

      attempts += 1;
      requestAnimationFrame(alignToBottom);
    };

    requestAnimationFrame(alignToBottom);

    return () => {
      cancelled = true;
    };
  }, [chat, chatScrollKey, rowVirtualizer, visibleMessages.length]);

  useEffect(() => {
    const scrollElement = parentRef.current;

    if (!scrollElement || !chat || visibleMessages.length === 0 || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!isPinnedToBottomRef.current) {
        return;
      }

      rowVirtualizer.scrollToIndex(visibleMessages.length - 1, { align: "end" });
    });

    observer.observe(scrollElement);

    return () => {
      observer.disconnect();
    };
  }, [chat, rowVirtualizer, visibleMessages.length]);

  if (!chat) {
    return (
      <section className="chat-view empty-state-panel">
        <h2>Select a conversation</h2>
        <p>The app shows a timeline, inline media, and search for the selected backup.</p>
      </section>
    );
  }

  const normalizedSelfMark = selfMark.trim();
  const selfSender = normalizedSelfMark || chat.participants[1] || chat.participants[0] || null;

  return (
    <section className="chat-view">
      <header className="chat-header compact">
        <h1>{chat.title}</h1>
        <p className="subtle chat-meta-inline">
          {chat.messageCount} messages · {formatParticipants(chat.participants)}
        </p>
      </header>
      <div
        ref={parentRef}
        className="chat-scroll-region"
        onScroll={(event) => {
          const scrollElement = event.currentTarget;
          const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
          isPinnedToBottomRef.current =
            maxScrollTop === 0 || scrollElement.scrollTop >= maxScrollTop - 24;
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = visibleMessages[virtualRow.index];
            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageBubble archivePath={chat.archivePath} message={message} selfSender={selfSender} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function formatParticipants(participants: string[]): string {
  if (participants.length === 0) {
    return "Participants not detected";
  }

  if (participants.length <= 3) {
    return participants.join(", ");
  }

  const visibleParticipants = participants.slice(0, 3).join(", ");
  const remainingCount = participants.length - 3;
  return `${visibleParticipants} + ${remainingCount} members`;
}

function filterMessages(messages: Message[], messageQuery: string, authorQuery: string): Message[] {
  const normalizedMessageQuery = messageQuery.trim().toLowerCase();
  const normalizedAuthorQuery = authorQuery.trim().toLowerCase();

  if (!normalizedMessageQuery && !normalizedAuthorQuery) {
    return messages;
  }

  return messages.filter((message) => {
    const matchesMessage =
      normalizedMessageQuery.length === 0 || message.text.toLowerCase().includes(normalizedMessageQuery);
    const matchesAuthor =
      normalizedAuthorQuery.length === 0 || message.sender.toLowerCase().includes(normalizedAuthorQuery);

    return matchesMessage && matchesAuthor;
  });
}

function estimateMessageHeight(message: Message | undefined): number {
  if (!message) {
    return 148;
  }

  if (message.isSystem) {
    return 56;
  }

  if (
    message.attachment?.type === "image" ||
    message.attachment?.type === "sticker" ||
    message.attachment?.type === "video" ||
    message.attachment?.type === "gif"
  ) {
    return 460;
  }

  if (message.attachment?.type === "audio") {
    return 168;
  }

  if (message.attachment?.type === "document" || message.attachment?.type === "unknown") {
    return 184;
  }

  return 132;
}

