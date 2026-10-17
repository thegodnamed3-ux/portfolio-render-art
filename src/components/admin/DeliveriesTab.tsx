import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DELIVERY_BUCKET } from "@/lib/delivery.functions";
import { formatSize } from "@/lib/format";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type DeliveryRow = {
  id: string; token: string; title: string; client_name: string | null; message: string | null;
  is_active: boolean; created_at: string; client_delivery_files: { count: number }[];
};
type FileRow = {
  id: string; delivery_id: string; storage_path: string; preview_path: string | null;
  file_name: string; size: number; w: number | null; h: number | null; position: number;
};

const btn = "meta inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40";
const btnPrimary = "meta inline-flex items-center justify-center gap-2 rounded-full bg-paper px-4 py-2 text-ink transition-opacity hover:opacity-90 disabled:opacity-40";
const input = "w-full rounded-2xl border border-border bg-transparent px-4 py-2.5 text-sm text-paper outline-none placeholder:text-muted-foreground focus:border-paper/60";

const bucket = () => supabase.storage.from(DELIVERY_BUCKET);

/** 24-character URL-safe secret; the only thing that opens a delivery. */
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const linkFor = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/g/${token}`;

/** Storage keys only take plain ASCII; the original name is kept in the database. */
function safeName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "photo";
  const ext = dot > 0 ? name.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").toLowerCase() : "";
  return ext ? `${base.slice(0, 80)}.${ext}` : base.slice(0, 80);
}

/** Web-sized JPEG for the gallery grid and viewer (the original stays untouched for download). */
async function makePreview(file: File): Promise<{ blob: Blob | null; w: number | null; h: number | null }> {
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width, h = bmp.height;
    const scale = Math.min(1, 2048 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return { blob, w, h };
  } catch {
    return { blob: null, w: null, h: null };
  }
}

export function DeliveriesTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin", "deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_deliveries")
        .select("*, client_delivery_files(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DeliveryRow[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "deliveries"] });

  const create = async () => {
    const { data, error } = await supabase
      .from("client_deliveries")
      .insert({ token: newToken(), title: "Untitled delivery" })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    await refresh();
    setSelected(data.id);
  };

  if (list.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  if (list.error) {
    return (
      <p className="text-sm text-destructive">
        Could not load client deliveries. If this is the first time, the database update for this feature may not be applied yet.
      </p>
    );
  }
  const rows = list.data ?? [];
  const current = rows.find((r) => r.id === selected);

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <aside className={cn(current && "hidden lg:block")}>
        <button onClick={create} className={cn(btnPrimary, "mb-2 w-full")}>+ New client delivery</button>
        <p className="mb-4 text-xs text-muted-foreground">Each delivery is a private page with its own secret link. It never appears on the website.</p>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r.id)}
                className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors", selected === r.id ? "border-paper/60 bg-card" : "border-border hover:border-paper/30")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-paper">{r.title}</p>
                  <p className="meta truncate text-muted-foreground">
                    {r.client_name ? `${r.client_name} · ` : ""}{r.client_delivery_files[0]?.count ?? 0} photos
                  </p>
                </div>
                <span className={cn("meta shrink-0 rounded-full px-2.5 py-1 text-[0.6rem]", r.is_active ? "bg-paper text-ink" : "border border-border text-muted-foreground")}>
                  {r.is_active ? "Link on" : "Off"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No deliveries yet.</p>}
      </aside>

      {current ? (
        <DeliveryEditor key={current.id} d={current} refresh={refresh} onClose={() => setSelected(null)} />
      ) : (
        <p className="hidden text-sm text-muted-foreground lg:block">Select a delivery or create a new one.</p>
      )}
    </div>
  );
}

function DeliveryEditor({ d, refresh, onClose }: { d: DeliveryRow; refresh: () => Promise<void>; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(d.title);
  const [client, setClient] = useState(d.client_name ?? "");
  const [message, setMessage] = useState(d.message ?? "");
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"delete" | "relink" | null>(null);
  const dirty = title !== d.title || client !== (d.client_name ?? "") || message !== (d.message ?? "");
  const link = linkFor(d.token);

  const files = useQuery({
    queryKey: ["admin", "delivery-files", d.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_delivery_files")
        .select("*")
        .eq("delivery_id", d.id)
        .order("position")
        .order("file_name");
      if (error) throw error;
      const rows = data as FileRow[];
      const thumbs = new Map<string, string>();
      if (rows.length) {
        const signed = await bucket().createSignedUrls(rows.map((f) => f.preview_path ?? f.storage_path), 60 * 60);
        signed.data?.forEach((s, i) => { if (s.signedUrl) thumbs.set(rows[i]!.id, s.signedUrl); });
      }
      return { rows, thumbs };
    },
  });
  const rows = files.data?.rows ?? [];
  const total = useMemo(() => rows.reduce((n, f) => n + Number(f.size || 0), 0), [rows]);
  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "delivery-files", d.id] });
    await refresh();
  };

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
    await reload();
  };
  const check = <T,>(r: { error: { message: string } | null; data?: T | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };

  const save = () => act(async () => {
    check(await supabase.from("client_deliveries").update({
      title: title.trim() || "Untitled delivery",
      client_name: client.trim() || null,
      message: message.trim() || null,
    }).eq("id", d.id));
  }, "Saved");

  const setActive = (is_active: boolean) => act(async () => {
    check(await supabase.from("client_deliveries").update({ is_active }).eq("id", d.id));
  }, is_active ? "Link switched on" : "Link switched off — the page now shows “no longer active”");

  const relink = () => act(async () => {
    check(await supabase.from("client_deliveries").update({ token: newToken() }).eq("id", d.id));
  }, "New link created — the old one no longer works");

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Link copied"); }
    catch { toast.error("Could not copy — select the link and copy it manually"); }
  };

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const queue = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const start = rows.length ? Math.max(...rows.map((f) => f.position)) + 1 : 0;
    setUpload({ done: 0, total: queue.length });
    const failed: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const i = next++;
        const file = queue[i]!;
        try {
          const folder = `${d.id}/${crypto.randomUUID()}`;
          const original = `${folder}/${safeName(file.name)}`;
          const up = await bucket().upload(original, file, { contentType: file.type || "application/octet-stream" });
          if (up.error) throw up.error;
          const { blob, w, h } = await makePreview(file);
          let preview: string | null = null;
          if (blob) {
            const p = `${folder}/preview.jpg`;
            const r = await bucket().upload(p, blob, { contentType: "image/jpeg", cacheControl: "86400" });
            if (!r.error) preview = p;
          }
          const ins = await supabase.from("client_delivery_files").insert({
            delivery_id: d.id, storage_path: original, preview_path: preview, file_name: file.name,
            size: file.size, w, h, position: start + i,
          });
          if (ins.error) throw ins.error;
        } catch (e) {
          console.error(e);
          failed.push(file.name);
        }
        setUpload((u) => u && { ...u, done: u.done + 1 });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setUpload(null);
    if (failed.length) toast.error(`${failed.length} file(s) failed: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`);
    else toast.success(`${queue.length} photo${queue.length > 1 ? "s" : ""} uploaded`);
    await reload();
  };

  const pathsOf = (fs: FileRow[]) => fs.flatMap((f) => [f.storage_path, ...(f.preview_path ? [f.preview_path] : [])]);

  const removePicked = () => act(async () => {
    const sel = rows.filter((f) => picked.has(f.id));
    const paths = pathsOf(sel);
    if (paths.length) check(await bucket().remove(paths));
    check(await supabase.from("client_delivery_files").delete().in("id", sel.map((f) => f.id)));
    setPicked(new Set());
  }, "Photos removed");

  const removeDelivery = () => act(async () => {
    const paths = pathsOf(rows);
    for (let i = 0; i < paths.length; i += 500) check(await bucket().remove(paths.slice(i, i + 500)));
    check(await supabase.from("client_deliveries").delete().eq("id", d.id));
    onClose();
  }, "Delivery deleted");

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="min-w-0">
      <button onClick={onClose} className="meta mb-4 text-muted-foreground hover:text-paper lg:hidden">← All deliveries</button>

      <div className="space-y-3">
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title shown to the client, e.g. Pärnu mnt 12 — apartment" aria-label="Title" maxLength={120} />
        <input className={input} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name (optional)" aria-label="Client name" maxLength={80} />
        <textarea className={cn(input, "min-h-24 resize-y")} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message to the client (optional)" aria-label="Message" maxLength={1000} />
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={busy || !dirty} onClick={save}>Save</button>
          {d.is_active
            ? <button className={btn} disabled={busy} onClick={() => setActive(false)}>Switch link off</button>
            : <button className={btn} disabled={busy} onClick={() => setActive(true)}>Switch link on</button>}
          <button className={cn(btn, "text-destructive hover:border-destructive")} disabled={busy} onClick={() => setConfirm("delete")}>Delete</button>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border p-4">
        <p className="meta mb-3 text-muted-foreground">
          Client link · {d.is_active ? "working" : "switched off"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={cn(input, "min-w-0 flex-1 rounded-full font-mono text-xs")} aria-label="Client link" />
          <button className={btnPrimary} onClick={copy}>Copy</button>
          <a className={btn} href={link} target="_blank" rel="noopener noreferrer">Open</a>
          <button className={btn} disabled={busy} onClick={() => setConfirm("relink")}>New link</button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <label className={cn(btnPrimary, "cursor-pointer", upload && "pointer-events-none opacity-60")}>
          {upload ? `Uploading ${upload.done} / ${upload.total}…` : "+ Upload photos"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={!!upload} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <span className="meta text-muted-foreground">{rows.length} photos{total ? ` · ${formatSize(total)}` : ""}</span>
        {rows.length > 0 && (
          <button className={btn} onClick={() => setPicked(picked.size === rows.length ? new Set() : new Set(rows.map((f) => f.id)))}>
            {picked.size === rows.length ? "Clear selection" : "Select all"}
          </button>
        )}
        {picked.size > 0 && (
          <button className={cn(btn, "text-destructive hover:border-destructive")} disabled={busy} onClick={removePicked}>
            Remove {picked.size}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Originals are delivered untouched (full size, original file names). Photos are shown in file-name order.</p>

      {files.isLoading ? (
        <p className="meta mt-6 text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
          {rows.map((f) => {
            const on = picked.has(f.id);
            const src = files.data?.thumbs.get(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.id)} aria-pressed={on} title={f.file_name}
                className={cn("relative aspect-square overflow-hidden rounded-lg bg-charcoal ring-2 transition", on ? "ring-paper" : "ring-transparent")}>
                {src && <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                <span className="meta pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-full bg-viewer/75 px-1.5 text-[0.55rem] text-paper/80">{f.file_name}</span>
              </button>
            );
          })}
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? `Delete “${d.title}”?` : "Create a new link?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? `The page and all ${rows.length} photos are removed permanently. The client link stops working.`
                : "The current link stops working immediately. Send the new link to the client."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = confirm; setConfirm(null); if (c === "delete") void removeDelivery(); else void relink(); }}>
              {confirm === "delete" ? "Delete" : "New link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
