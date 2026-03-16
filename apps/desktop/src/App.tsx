import { useEffect, useMemo, useState } from "react";
import type { ChatBackup, ChatBackupSummary } from "@wtb/parser";
import { loadChat, summarizeChat } from "@wtb/parser";

import { ChatSidebar } from "./components/ChatSidebar";
import { ChatView } from "./components/ChatView";
import type { ArchiveLoadIssue } from "./lib/types";
import { getDesktopApi } from "./lib/tauri-api";

type ScanStatus = "idle" | "loading" | "ready" | "error";
type PanelTab = "search" | "settings";

interface LoadedChatEntry {
  chat: ChatBackup;
  summary: ChatBackupSummary;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export default function App() {
  const [backupDirectory, setBackupDirectory] = useState<string>("");
  const [allChats, setAllChats] = useState<ChatBackupSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatBackup | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [messageSearchQuery, setMessageSearchQuery] = useState<string>("");
  const [authorSearchQuery, setAuthorSearchQuery] = useState<string>("");
  const [selfMark, setSelfMark] = useState<string>("");
  const [isImportPanelOpen, setIsImportPanelOpen] = useState<boolean>(true);
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>("search");
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState<boolean>(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [scanIssues, setScanIssues] = useState<ArchiveLoadIssue[]>([]);

  const canChooseBackupDirectory = typeof window !== "undefined" && !!(window.__WTB_DESKTOP_API__ || window.__TAURI_INTERNALS__);

  useEffect(() => {
    let isMounted = true;

    async function initializeDirectory() {
      try {
        const initialDirectory = await getDesktopApi().getInitialBackupDirectory();
        if (!isMounted) {
          return;
        }

        setBackupDirectory(initialDirectory);
        await handleScan(initialDirectory);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setErrorMessage(getErrorMessage(error));
      }
    }

    void initializeDirectory();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleScan(directoryOverride?: string) {
    const directoryToScan = directoryOverride ?? backupDirectory;
    if (!directoryToScan) {
      setStatus("error");
      setErrorMessage("Choose a backup folder before scanning.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    setScanIssues([]);

    try {
      const archives = await getDesktopApi().scanBackupDirectory(directoryToScan);
      const settledChats = await Promise.all(
        archives.map(async (archive) => {
          try {
            const rawContents = await getDesktopApi().readArchiveContents(archive.archivePath);
            return {
              kind: "loaded" as const,
              value: {
                chat: loadChat(rawContents),
                summary: summarizeChat(rawContents),
              },
            };
          } catch (error) {
            return {
              kind: "issue" as const,
              value: {
                archivePath: archive.archivePath,
                fileName: archive.fileName,
                message: getErrorMessage(error),
              },
            };
          }
        }),
      );

      const loadedChats: LoadedChatEntry[] = [];
      const issues: ArchiveLoadIssue[] = [];

      for (const result of settledChats) {
        if (result.kind === "loaded") {
          loadedChats.push(result.value);
        } else {
          issues.push(result.value);
        }
      }

      const sortedChats = loadedChats.sort((left, right) =>
        (right.summary.endedAt ?? "").localeCompare(left.summary.endedAt ?? ""),
      );
      const summaries = sortedChats.map((entry) => entry.summary);

      setAllChats(summaries);
      setSelectedChat(sortedChats[0]?.chat ?? null);
      setScanIssues(issues);
      setStatus("ready");
      setHasCompletedInitialSync(true);
      setLastSyncAt(new Date().toISOString());
      if (summaries.length > 0) {
        setIsImportPanelOpen(false);
      }

      if (summaries.length === 0 && issues.length > 0) {
        throw new Error(issues[0]?.message ?? "No readable backups found");
      }
    } catch (error) {
      setStatus("error");
      setAllChats([]);
      setSelectedChat(null);
      setScanIssues([]);
      setHasCompletedInitialSync(true);
      setErrorMessage(getErrorMessage(error));
      setIsImportPanelOpen(true);
    }
  }

  async function handleChooseDirectory() {
    try {
      const selectedDirectory = await getDesktopApi().chooseBackupDirectory();
      if (!selectedDirectory) {
        return;
      }

      setBackupDirectory(selectedDirectory);
      setAllChats([]);
      setSelectedChat(null);
      setScanIssues([]);
      setStatus("idle");
      setErrorMessage("");
      setHasCompletedInitialSync(false);
      setLastSyncAt(null);
      setIsImportPanelOpen(true);
      setActivePanelTab("settings");
    } catch (error) {
      setStatus("error");
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleSelectChat(chatSummary: ChatBackupSummary) {
    const rawContents = await getDesktopApi().readArchiveContents(chatSummary.archivePath);
    setSelectedChat(loadChat(rawContents));
  }

  const statusLabel = useMemo(() => {
    switch (status) {
      case "loading":
        return "Scanning backups...";
      case "ready":
        return scanIssues.length > 0
          ? `${allChats.length} backups loaded, ${scanIssues.length} skipped`
          : `${allChats.length} backups loaded`;
      case "error":
        return errorMessage || "Backup scan failed";
      default:
        return backupDirectory ? "Ready to scan" : "Choose a backup folder";
    }
  }, [allChats.length, backupDirectory, errorMessage, scanIssues.length, status]);

  const lastSyncLabel = useMemo(() => {
    if (!lastSyncAt) {
      return hasCompletedInitialSync ? "Initial sync complete" : "No sync run yet";
    }

    return `Last sync ${new Date(lastSyncAt).toLocaleString("en-US")}`;
  }, [hasCompletedInitialSync, lastSyncAt]);

  const importToggleLabel = isImportPanelOpen ? "Collapse backup import" : "Open backup import";

  return (
    <main className={`app-shell ${isImportPanelOpen ? "import-open" : "import-closed"}`}>
      <section className="app-header">
        <div className="app-header-copy">
          <p className="eyebrow">Whats The Backup</p>
          <h1>Browse WhatsApp exports as a real chat timeline</h1>
        </div>
        <small className="subtle">{lastSyncLabel}</small>
        <div className="header-actions">
          <div className={`status-pill ${status}`}>{statusLabel}</div>
          <button
            type="button"
            className="icon-button"
            aria-label={importToggleLabel}
            title={importToggleLabel}
            onClick={() => setIsImportPanelOpen((currentValue) => !currentValue)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                d={isImportPanelOpen ? "M3.5 10L8 5.5 12.5 10" : "M3.5 6L8 10.5 12.5 6"}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </div>
      </section>

      {isImportPanelOpen ? (
        <section className="chrome-panel expanded">
          <div className="panel-summary">
            <div>
              <div className="panel-tabs" role="tablist" aria-label="Toolbar">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "search"}
                  className={`panel-tab ${activePanelTab === "search" ? "active" : ""}`}
                  onClick={() => setActivePanelTab("search")}
                >
                  Search
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanelTab === "settings"}
                  className={`panel-tab ${activePanelTab === "settings" ? "active" : ""}`}
                  onClick={() => setActivePanelTab("settings")}
                >
                  Settings
                </button>
              </div>
            </div>
          </div>

          {activePanelTab === "search" ? (
            <div className="toolbar">
              <label className="field">
                <span>Search message</span>
                <input
                  name="messageSearch"
                  placeholder="Message text"
                  value={messageSearchQuery}
                  onChange={(event) => setMessageSearchQuery(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Search author</span>
                <input
                  name="authorSearch"
                  placeholder="Author name"
                  value={authorSearchQuery}
                  onChange={(event) => setAuthorSearchQuery(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="settings-shell">
              <section className="settings-card settings-card-primary">
                <div className="settings-card-head">
                  <div>
                    <p className="eyebrow">Backup source</p>
                    <div className="settings-title-row"><h2>Choose the backup folder</h2><span className="info-tooltip" tabIndex={0} role="img" aria-label="The selected folder is remembered in the desktop app and loaded automatically on the next launch." title="The selected folder is remembered in the desktop app and loaded automatically on the next launch."><span className="info-tooltip-icon" aria-hidden="true">i</span><span className="info-tooltip-bubble" role="tooltip">The selected folder is remembered in the desktop app and loaded automatically on the next launch.</span></span></div>
                  </div>
                  <span className="settings-badge">Persistent</span>
                </div>
                
                <div className="settings-path-box" aria-label="Current backup folder path">
                  <strong>Current path</strong>
                  <span>{backupDirectory || "No folder selected"}</span>
                </div>
                <div className="settings-actions-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleChooseDirectory()}
                    disabled={!canChooseBackupDirectory}
                    title={canChooseBackupDirectory ? "Choose a folder from the file explorer" : "Available in the desktop app"}
                  >
                    Choose folder
                  </button>
                  <button type="button" className="primary-button" onClick={() => void handleScan()}>
                    Scan backups
                  </button>
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-head compact">
                  <div>
                    <p className="eyebrow">Chat parsing</p>
                    <div className="settings-title-row"><h2>Sender identity</h2><span className="info-tooltip" tabIndex={0} role="img" aria-label="Use a manual override only if the chat does not correctly recognize messages sent by you." title="Use a manual override only if the chat does not correctly recognize messages sent by you."><span className="info-tooltip-icon" aria-hidden="true">i</span><span className="info-tooltip-bubble" role="tooltip">Use a manual override only if the chat does not correctly recognize messages sent by you.</span></span></div>
                  </div>
                </div>
                
                <label className="field">
                  <span>Self name</span>
                  <input
                    name="selfMark"
                    placeholder="Leave empty to keep the current detection logic"
                    value={selfMark}
                    onChange={(event) => setSelfMark(event.target.value)}
                  />
                </label>
              </section>
            </div>
          )}
        </section>
      ) : null}

      <section className="workspace">
        <ChatSidebar
          chats={allChats}
          selectedChatId={selectedChat?.id ?? null}
          onSelectChat={(chat) => void handleSelectChat(chat)}
        />
        <ChatView
          chat={selectedChat}
          messageQuery={messageSearchQuery}
          authorQuery={authorSearchQuery}
          selfMark={selfMark}
        />
      </section>
    </main>
  );
}


