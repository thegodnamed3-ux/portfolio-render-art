import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Background uploads for the studio. Files go into one queue that lives outside any tab, so they
 * keep uploading while you switch between admin tabs (only closing or reloading the page stops
 * them — the browser warns first). Every file shows live progress in the dock (UploadDock).
 */
export type UploadItem = { id: string; name: string; size: number; loaded: number; status: "waiting" | "uploading" | "saving" | "done" | "skipped" | "failed"; note?: string; preview?: string };
type Job = { item: UploadItem; file: File; run: (file: File, progress: (loaded: number) => void) => Promise<"done" | "skipped" | string> };

let items: UploadItem[] = [];
const jobs: Job[] = [];
const listeners = new Set<() => void>();
const doneHooks = new Set<() => void>();
let active = 0;
const PARALLEL = 3;

const emit = () => { items = [...items]; listeners.forEach((l) => l()); };
const patch = (id: string, p: Partial<UploadItem>) => { items = items.map((i) => (i.id === id ? { ...i, ...p } : i)); listeners.forEach((l) => l()); };

function pump() {
  while (active < PARALLEL && jobs.length) {
    const job = jobs.shift()!;
    active++;
    patch(job.item.id, { status: "uploading" });
    job.run(job.file, (loaded) => patch(job.item.id, { loaded, ...(loaded >= job.item.size ? { status: "saving" } : {}) }))
      .then((r) => patch(job.item.id, r === "done" ? { status: "done", loaded: job.item.size } : r === "skipped" ? { status: "skipped", note: "already in the library" } : { status: "failed", note: r }))
      .catch((e) => patch(job.item.id, { status: "failed", note: (e as Error)?.message || "failed" }))
      .finally(() => {
        active--;
        if (!jobs.length && !active) doneHooks.forEach((h) => h());
        pump();
      });
  }
}

export function enqueueUploads(files: File[], run: Job["run"]) {
  for (const file of files) {
    const item: UploadItem = { id: crypto.randomUUID(), name: file.name, size: file.size, loaded: 0, status: "waiting", preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined };
    items = [...items, item];
    jobs.push({ item, file, run });
  }
  emit();
  pump();
}
export const clearFinished = () => { items.filter((i) => i.status !== "waiting" && i.status !== "uploading" && i.status !== "saving").forEach((i) => i.preview && URL.revokeObjectURL(i.preview)); items = items.filter((i) => i.status === "waiting" || i.status === "uploading" || i.status === "saving"); emit(); };
export const isUploading = () => items.some((i) => i.status === "waiting" || i.status === "uploading" || i.status === "saving");
/** Called once whenever the queue empties — e.g. to reload the library. */
export function onUploadsFinished(fn: () => void) { doneHooks.add(fn); return () => { doneHooks.delete(fn); }; }
export function useUploads() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => items, () => items);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => { if (isUploading()) { e.preventDefault(); e.returnValue = ""; } });
}

/** Uploads one file to Storage with real progress (XHR); falls back to the normal upload. */
export async function uploadWithProgress(bucket: string, path: string, file: File, onProgress: (loaded: number) => void, cacheControl = "31536000") {
  const base = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.replace(/\/+$/, "");
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (base && key && token) {
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${base}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
      xhr.setRequestHeader("apikey", key);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("cache-control", `max-age=${cacheControl}`);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    if (ok) { onProgress(file.size); return; }
  }
  const up = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl });
  if (up.error) throw up.error;
  onProgress(file.size);
}
