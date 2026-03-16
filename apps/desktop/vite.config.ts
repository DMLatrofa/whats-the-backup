import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";
import type { IncomingMessage, ServerResponse } from "node:http";

const repoRoot = path.resolve(__dirname, "../..");
const defaultBackupDirectory = path.join(repoRoot, "backup");
const zipArchiveCache = new Map<string, Promise<JSZip>>();

function inferMimeType(entryName: string): string {
  const extension = entryName.split(".").pop()?.toLowerCase() ?? "";

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "3gp":
      return "video/3gpp";
    case "mkv":
      return "video/x-matroska";
    case "opus":
      return "audio/ogg;codecs=opus";
    case "ogg":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function sendJson(response: ServerResponse<IncomingMessage>, payload: unknown, statusCode = 200) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

async function loadZipArchive(archivePath: string) {
  let pendingArchive = zipArchiveCache.get(archivePath);
  if (!pendingArchive) {
    pendingArchive = fs.readFile(archivePath).then((buffer) => JSZip.loadAsync(buffer));
    zipArchiveCache.set(archivePath, pendingArchive);
  }

  return pendingArchive;
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "wtb-dev-api",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith("/__wtb/")) {
            next();
            return;
          }

          try {
            const requestUrl = new URL(request.url, "http://localhost:1420");

            if (requestUrl.pathname === "/__wtb/initial-backup-directory") {
              await fs.mkdir(defaultBackupDirectory, { recursive: true });
              sendJson(response, { directoryPath: defaultBackupDirectory });
              return;
            }

            if (requestUrl.pathname === "/__wtb/scan-backup-directory") {
              const requestedDirectory = requestUrl.searchParams.get("directoryPath") || defaultBackupDirectory;

              let directoryStat;
              try {
                directoryStat = await fs.stat(requestedDirectory);
              } catch {
                sendJson(response, { error: `Backup folder not found: ${requestedDirectory}` }, 404);
                return;
              }

              if (!directoryStat.isDirectory()) {
                sendJson(response, { error: `The selected path is not a folder: ${requestedDirectory}` }, 400);
                return;
              }

              const entries = await fs.readdir(requestedDirectory, { withFileTypes: true });
              const files = await Promise.all(
                entries
                  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
                  .map(async (entry) => {
                    const archivePath = path.join(requestedDirectory, entry.name);
                    const stat = await fs.stat(archivePath);
                    return {
                      archivePath,
                      fileName: entry.name,
                      size: stat.size,
                    };
                  }),
              );

              sendJson(response, files.sort((a, b) => a.fileName.localeCompare(b.fileName)));
              return;
            }

            if (requestUrl.pathname === "/__wtb/read-archive-contents") {
              const archivePath = requestUrl.searchParams.get("archivePath");
              if (!archivePath) {
                sendJson(response, { error: "Missing archivePath" }, 400);
                return;
              }

              const zip = await loadZipArchive(archivePath);
              const chatFile = zip.file("_chat.txt");
              if (!chatFile) {
                sendJson(response, { error: `_chat.txt not found in ${archivePath}` }, 404);
                return;
              }

              const chatText = await chatFile.async("string");
              const attachments = Object.values(zip.files)
                .filter((entry) => !entry.dir && entry.name !== "_chat.txt")
                .map((entry) => ({
                  entryName: entry.name,
                  size: 0,
                }));

              sendJson(response, {
                archivePath,
                chatText,
                attachments,
              });
              return;
            }

            if (requestUrl.pathname === "/__wtb/attachment-binary") {
              const archivePath = requestUrl.searchParams.get("archivePath");
              const entryName = requestUrl.searchParams.get("entryName");
              if (!archivePath || !entryName) {
                sendJson(response, { error: "Missing archivePath or entryName" }, 400);
                return;
              }

              const zip = await loadZipArchive(archivePath);
              const entry = zip.file(entryName);
              if (!entry) {
                sendJson(response, { error: `Attachment not found: ${entryName}` }, 404);
                return;
              }

              const content = await entry.async("nodebuffer");
              response.statusCode = 200;
              response.setHeader("Content-Type", inferMimeType(entryName));
              response.setHeader("Cache-Control", "private, max-age=3600");
              response.end(content);
              return;
            }

            sendJson(response, { error: "Endpoint not found" }, 404);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            sendJson(response, { error: message }, 500);
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@wtb/parser": path.resolve(__dirname, "../../packages/parser/src/index.ts"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});


