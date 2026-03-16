import type { ChatBackupSummary } from "@wtb/parser";

interface ChatSidebarProps {
  chats: ChatBackupSummary[];
  selectedChatId: string | null;
  onSelectChat: (chat: ChatBackupSummary) => void;
}

function formatRange(chat: ChatBackupSummary): string {
  if (!chat.startedAt || !chat.endedAt) {
    return "No valid messages";
  }

  const start = new Date(chat.startedAt).toLocaleDateString("en-US");
  const end = new Date(chat.endedAt).toLocaleDateString("en-US");
  return start === end ? start : `${start} - ${end}`;
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

export function ChatSidebar({ chats, selectedChatId, onSelectChat }: ChatSidebarProps) {
  if (!chats.length) {
    return (
      <aside className="sidebar empty-state-panel">
        <p className="eyebrow">Chat</p>
        <h2>No backups loaded</h2>
        <p>Choose a local folder and scan exported zip files to browse conversations.</p>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <p className="eyebrow">Chat</p>
        <h2>{chats.length} conversations</h2>
      </div>
      <div className="chat-list">
        {chats.map((chat) => {
          const isSelected = chat.id === selectedChatId;

          return (
            <button
              key={chat.id}
              type="button"
              className={`chat-list-item ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="chat-list-row">
                <strong>{chat.title}</strong>
                <span>{chat.messageCount}</span>
              </div>
              <p>{formatRange(chat)}</p>
              <small>{formatParticipants(chat.participants)}</small>
            </button>
          );
        })}
      </div>
    </aside>
  );
}


