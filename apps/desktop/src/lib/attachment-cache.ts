import { useEffect, useSyncExternalStore } from "react";
import type { Message } from "@wtb/parser";

import { getDesktopApi } from "@/lib/tauri-api";
import type { AttachmentResource } from "@/lib/types";

type AttachmentPhase = "idle" | "loading" | "loaded" | "error";

interface AttachmentCacheState {
  phase: AttachmentPhase;
  resource?: AttachmentResource;
  error?: string;
}

interface AttachmentCacheEntry extends AttachmentCacheState {
  promise?: Promise<void>;
}

const IDLE_STATE: AttachmentCacheState = { phase: "idle" };
const cache = new Map<string, AttachmentCacheEntry>();
const listeners = new Map<string, Set<() => void>>();

function getCacheKey(archivePath: string, entryName: string) {
  return `${archivePath}::${entryName}`;
}

function emitChange(cacheKey: string) {
  listeners.get(cacheKey)?.forEach((listener) => listener());
}

function subscribe(cacheKey: string, listener: () => void) {
  const subscribers = listeners.get(cacheKey) ?? new Set<() => void>();
  subscribers.add(listener);
  listeners.set(cacheKey, subscribers);

  return () => {
    const currentSubscribers = listeners.get(cacheKey);
    if (!currentSubscribers) {
      return;
    }

    currentSubscribers.delete(listener);
    if (currentSubscribers.size === 0) {
      listeners.delete(cacheKey);
    }
  };
}

function getEntrySnapshot(cacheKey: string | null): AttachmentCacheState {
  if (!cacheKey) {
    return IDLE_STATE;
  }

  return cache.get(cacheKey) ?? IDLE_STATE;
}

function ensureAttachmentLoaded(archivePath: string, attachment: Message["attachment"]) {
  if (!attachment) {
    return;
  }

  const cacheKey = getCacheKey(archivePath, attachment.entryName);
  const existing = cache.get(cacheKey);
  if (existing?.phase === "loaded" || existing?.phase === "loading") {
    return;
  }

  const nextEntry: AttachmentCacheEntry = {
    phase: "loading",
  };

  nextEntry.promise = getDesktopApi()
    .getAttachmentResource(archivePath, attachment.entryName)
    .then((resource) => {
      cache.set(cacheKey, {
        phase: "loaded",
        resource,
      });
      emitChange(cacheKey);
    })
    .catch((error: unknown) => {
      cache.set(cacheKey, {
        phase: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      emitChange(cacheKey);
    });

  cache.set(cacheKey, nextEntry);
  emitChange(cacheKey);
}

export function useAttachmentResource(archivePath: string, attachment: Message["attachment"]) {
  const cacheKey = attachment ? getCacheKey(archivePath, attachment.entryName) : null;

  const snapshot = useSyncExternalStore(
    (listener) => (cacheKey ? subscribe(cacheKey, listener) : () => undefined),
    () => getEntrySnapshot(cacheKey),
    () => getEntrySnapshot(cacheKey),
  );

  useEffect(() => {
    if (!attachment) {
      return;
    }

    ensureAttachmentLoaded(archivePath, attachment);
  }, [archivePath, attachment]);

  return snapshot;
}

export function resetAttachmentResourceCache() {
  for (const entry of cache.values()) {
    if (entry.resource?.kind === "blobUrl" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(entry.resource.url);
    }
  }

  cache.clear();
  listeners.clear();
}

