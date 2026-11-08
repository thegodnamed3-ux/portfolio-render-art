import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DELIVERY_BUCKET } from "@/lib/delivery.functions";
import { formatSize } from "@/lib/format";
import { hashDeliveryPassword } from "@/lib/delivery-hash";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ClientPicker, ClientsManager, clientLabel, fillTemplate, toTemplate, useClients, useTemplates, type Client } from "@/components/admin/ClientsPanel";
import { BRAND_DEFAULT, bakeBrand, brandedPathFor, brandedPreviewFor, placeLogo, type Brand, type Corner } from "@/lib/brand";

type DeliveryRow = {
  id: string; token: string; title: string; client_name: string | null; message: string | null; client_email?: string | null;
  is_active: boolean; created_at: string; client_delivery_files: { count: number }[];
  password_hash: string | null; expires_at: string | null; watermark?: boolean; brand?: Brand | null; cover_file?: string | null; client_id?: string | null;
};
type FileRow = {
  id: string; delivery_id: string; storage_path: string; preview_path: string | null;
  file_name: string; size: number; w: number | null; h: number | null; position: number;
  favorite: boolean; client_note: string | null; preview_wm_path?: string | null; branded_path?: string | null;
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
/** Draws the photo at ≤2048px; with `mark`, tiles a diagonal "thegodnamed" across it. */
function render(bmp: ImageBitmap, mark: boolean): Promise<Blob | null> {
  const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if (mark) {
    const cw = canvas.width, ch = canvas.height;
    const fs = Math.round(Math.max(cw, ch) / 18);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(-Math.PI / 9);
    ctx.font = `800 ${fs}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(1, fs / 40);
    const R = Math.hypot(cw, ch);
    const stepX = fs * 8, stepY = fs * 3;
    let row = 0;
    for (let y = -R; y < R; y += stepY, row++) {
      for (let x = -R + (row % 2) * (stepX / 2); x < R; x += stepX) {
        ctx.strokeText("thegodnamed", x, y);
        ctx.fillText("thegodnamed", x, y);
      }
    }
    ctx.restore();
  }
  return new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", mark ? 0.82 : 0.86));
}

/** Web-sized JPEG for the gallery grid and viewer (the original stays untouched for download). */
async function makePreview(file: File, withMark = false): Promise<{ blob: Blob | null; wm: Blob | null; w: number | null; h: number | null }> {
  try {
    const bmp = await createImageBitmap(file);
    const w = bmp.width, h = bmp.height;
    const blob = await render(bmp, false);
    const wm = withMark ? await render(bmp, true) : null;
    bmp.close();
    return { blob, wm, w, h };
  } catch {
    return { blob: null, wm: null, w: null, h: null };
  }
}

export function DeliveriesTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [showClients, setShowClients] = useState(false);
  const clients = useClients();
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
        <button onClick={() => { setShowClients(false); void create(); }} className={cn(btnPrimary, "mb-2 w-full")}>+ New client delivery</button>
        <button onClick={() => { setShowClients((v) => !v); setSelected(null); }} className={cn(btn, "mb-2 w-full", showClients && "border-paper/60 text-paper")}>Clients & message templates</button>
        <p className="mb-4 text-xs text-muted-foreground">Each delivery is a private page with its own secret link. It never appears on the website.</p>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => { setShowClients(false); setSelected(r.id); }}
                className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors", selected === r.id ? "border-paper/60 bg-card" : "border-border hover:border-paper/30")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-paper">{r.title}</p>
                  <p className="meta truncate text-muted-foreground">
                    {(() => { const c = clients.data?.find((x) => x.id === r.client_id); return c ? `${clientLabel(c)} · ` : r.client_name ? `${r.client_name} · ` : ""; })()}{r.client_delivery_files[0]?.count ?? 0} photos
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

      {showClients ? (
        <section className="min-w-0"><ClientsManager /></section>
      ) : current ? (
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
  const [email, setEmail] = useState(d.client_email ?? "");
  const [message, setMessage] = useState(d.message ?? "");
  const [clientId, setClientId] = useState<string | null>(d.client_id ?? null);
  const clientsQ = useClients();
  const clientObj = clientsQ.data?.find((c) => c.id === clientId) ?? null;
  // Choosing a saved client fills in the name and e-mail and ties the delivery to them.
  const pickClient = async (c: Client | null) => {
    setClientId(c?.id ?? null);
    if (c) { setClient(c.name); if (c.email) setEmail(c.email); }
    const r = await supabase.from("client_deliveries").update({ client_id: c?.id ?? null } as never).eq("id", d.id);
    if (r.error) toast.error(r.error.message); else await refresh();
  };
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<"delete" | "relink" | null>(null);
  const dirty = title !== d.title || client !== (d.client_name ?? "") || message !== (d.message ?? "") || email !== (d.client_email ?? "");
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

  // Autosave: every field is written shortly after you stop typing (and when you leave it),
  // so nothing is lost when switching deliveries or closing the studio.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const latest = useRef({ title, client, message, email });
  latest.current = { title, client, message, email };
  const savedRef = useRef({ title: d.title, client: d.client_name ?? "", message: d.message ?? "", email: d.client_email ?? "" });
  const save = async () => {
    const v = latest.current, was = savedRef.current;
    if (v.title === was.title && v.client === was.client && v.message === was.message && v.email === was.email) return;
    setSaveState("saving");
    try {
      check(await supabase.from("client_deliveries").update({
        title: v.title.trim() || "Untitled delivery",
        client_name: v.client.trim() || null,
        message: v.message.trim() || null,
      }).eq("id", d.id));
      if (v.email !== was.email) {
        const r = await supabase.from("client_deliveries").update({ client_email: v.email.trim() || null } as never).eq("id", d.id);
        if (r.error) toast.error("Client email needs migration 0028_review_requests — apply it in Lovable.");
      }
      savedRef.current = { ...v };
      setSaveState("saved");
      await refresh();
    } catch (e) { setSaveState("error"); toast.error((e as Error).message); }
  };
  useEffect(() => {
    const t = setTimeout(() => void save(), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, client, message, email]);
  // Leaving the delivery with a change still pending: write it straight away.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { void save(); }, []);

  // One link for this client: every active gallery sent to the same e-mail, on one page.
  const clientPage = async () => {
    const mail = (latest.current.email || "").trim().toLowerCase();
    if (!mail && !clientId) { toast.error("Choose a saved client or add the client's e-mail first — the client page collects all their galleries."); return; }
    try {
      const sb = supabase as any;
      const found = clientId
        ? await sb.from("client_portals").select("token").eq("client_id", clientId).maybeSingle()
        : await sb.from("client_portals").select("token").eq("email", mail).maybeSingle();
      if (found.error) throw new Error(/client_portals|relation|schema/i.test(found.error.message) ? `The client page needs its database update (migration ${"0032_client_portals"}) — apply it in Lovable first.` : found.error.message);
      let token = found.data?.token as string | undefined;
      if (!token) {
        token = newToken();
        const ins = await sb.from("client_portals").insert({ token, email: mail || null, name: latest.current.client.trim() || null, ...(clientId ? { client_id: clientId } : {}) });
        if (ins.error) throw new Error(ins.error.message);
      }
      const url = `${window.location.origin}/c/${token}`;
      try { await navigator.clipboard.writeText(url); toast.success("Client page link copied — all their galleries in one place"); }
      catch { window.prompt("Client page link", url); }
    } catch (e) { toast.error((e as Error).message); }
  };

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
    // Custom watermark on: new photos get their copy with the logo straight away.
    const brand = d.brand?.on ? d.brand : null;
    const logo = brand ? await loadLogo(brand.logo).catch(() => null) : null;
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
          const { blob, wm, w, h } = await makePreview(file, !!d.watermark);
          let preview: string | null = null;
          if (blob) {
            const p = `${folder}/preview.jpg`;
            const r = await bucket().upload(p, blob, { contentType: "image/jpeg", cacheControl: "86400" });
            if (!r.error) preview = p;
          }
          let previewWm: string | null = null;
          if (wm) {
            const p = `${folder}/preview-wm.jpg`;
            const r = await bucket().upload(p, wm, { contentType: "image/jpeg", cacheControl: "86400" });
            if (!r.error) previewWm = p;
          }
          const ins = await supabase.from("client_delivery_files").insert({
            delivery_id: d.id, storage_path: original, preview_path: preview, file_name: file.name,
            ...(previewWm ? { preview_wm_path: previewWm } : {}),
            size: file.size, w, h, position: start + i,
          }).select("id").single();
          if (ins.error) throw ins.error;
          if (brand && logo && ins.data) await bakeFile({ id: ins.data.id, storage_path: original, preview_path: preview }, brand, logo, file).catch((e) => console.error("brand", file.name, e));
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

  const pathsOf = (fs: FileRow[]) => fs.flatMap((f) => [f.storage_path, ...(f.preview_path ? [f.preview_path] : []), ...(f.preview_wm_path ? [f.preview_wm_path] : []), ...(f.branded_path ? [f.branded_path] : [])]);

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

  const [onlyFavs, setOnlyFavs] = useState(false);
  const favs = rows.filter((f) => f.favorite);
  const notes = rows.filter((f) => f.client_note);
  const copyPicks = async () => {
    try { await navigator.clipboard.writeText(favs.map((f) => f.file_name).join("\n")); toast.success(`${favs.length} file names copied`); }
    catch { toast.error("Could not copy"); }
  };

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="min-w-0">
      <button onClick={onClose} className="meta mb-4 text-muted-foreground hover:text-paper lg:hidden">← All deliveries</button>

      <div className="space-y-3">
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => void save()} placeholder="Title shown to the client, e.g. Pärnu mnt 12 — apartment" aria-label="Title" maxLength={120} />
        <ClientPicker value={clientId} onPick={(c) => void pickClient(c)} />
        <input className={input} value={client} onChange={(e) => setClient(e.target.value)} onBlur={() => void save()} placeholder="Client name (optional)" aria-label="Client name" maxLength={80} />
        <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => void save()} placeholder="Client email — for the review request 3 days after download (optional)" aria-label="Client email" maxLength={200} />
        <textarea className={cn(input, "min-h-24 resize-y")} value={message} onChange={(e) => setMessage(e.target.value)} onBlur={() => void save()} placeholder="Message to the client (optional)" aria-label="Message" maxLength={1000} />
        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={!email.trim() && !clientId} onClick={() => void clientPage()} title="One link with every gallery sent to this e-mail">Copy client page link</button>
          <span className="meta self-center pr-1 text-muted-foreground" aria-live="polite">{saveState === "saving" || dirty ? "Saving…" : saveState === "error" ? "Not saved — check your connection" : "Saved automatically"}</span>
          {d.is_active
            ? <button className={btn} disabled={busy} onClick={() => setActive(false)}>Switch link off</button>
            : <button className={btn} disabled={busy} onClick={() => setActive(true)}>Switch link on</button>}
          <button className={cn(btn, "text-destructive hover:border-destructive")} disabled={busy} onClick={() => setConfirm("delete")}>Delete</button>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card/30 p-5">
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

      <AccessAndStats d={d} rows={rows} refresh={reload} />
      <ClientMessage key={d.id} d={d} link={link} client={clientObj} />
      <BrandPanel d={d} rows={rows} {...(files.data ? { thumbs: files.data.thumbs } : {})} refresh={reload} picked={picked} onPickedDone={() => setPicked(new Set())} />

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
        {picked.size > 0 && picked.size < rows.length && <button className={btn} onClick={() => setPicked(new Set())}>Clear selection</button>}
        {picked.size === 1 && (
          <button className={btn} disabled={busy} onClick={async () => {
            const id = [...picked][0]!;
            const r = await supabase.from("client_deliveries").update({ cover_file: id } as never).eq("id", d.id);
            if (r.error) toast.error(/cover_file|column|schema/i.test(r.error.message) ? "Link preview needs its database update (migration “delivery_cover”) — apply it in Lovable first." : r.error.message);
            else { toast.success("This photo now shows when the link is shared"); setPicked(new Set()); await reload(); }
          }}>Use for link preview</button>
        )}
        {picked.size > 0 && (
          <button className={cn(btn, "text-destructive hover:border-destructive")} disabled={busy} onClick={removePicked}>
            Remove {picked.size}
          </button>
        )}
        {favs.length > 0 && (
          <>
            <button className={cn(btn, onlyFavs && "border-paper text-paper")} onClick={() => setOnlyFavs((v) => !v)}>
              ♥ Client picks {favs.length}{onlyFavs ? " · show all" : ""}
            </button>
            <button className={btn} onClick={copyPicks}>Copy file names</button>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Originals are delivered untouched (full size, original file names). Photos are shown in file-name order.</p>

      {notes.length > 0 && (
        <div className="mt-6 rounded-3xl border border-border/60 bg-card/30 p-5">
          <p className="meta mb-2 text-muted-foreground">Client notes</p>
          <ul className="space-y-1.5 text-sm">
            {notes.map((f) => <li key={f.id}><span className="text-paper">{f.file_name}</span><span className="text-muted-foreground"> — {f.client_note}</span></li>)}
          </ul>
        </div>
      )}

      {files.isLoading ? (
        <p className="meta mt-6 text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
          {(onlyFavs ? favs : rows).map((f) => {
            const on = picked.has(f.id);
            const src = files.data?.thumbs.get(f.id);
            return (
              <button key={f.id} type="button" onClick={() => toggle(f.id)} aria-pressed={on} title={f.file_name}
                className={cn("relative aspect-square overflow-hidden rounded-lg bg-charcoal ring-2 transition", on ? "ring-paper" : "ring-transparent")}>
                {src && <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                {(d.cover_file ? d.cover_file === f.id : f === rows[0]) && (
                  <span className="meta pointer-events-none absolute right-1 top-1 rounded-full bg-paper/90 px-1.5 text-[0.6rem] text-ink" title="Shown when the link is shared">Link preview</span>
                )}
                {d.brand?.on && f.branded_path && !d.brand.skip?.includes(f.id) && (
                  <span className="meta pointer-events-none absolute left-1 top-1 rounded-full bg-viewer/80 px-1.5 text-[0.6rem] text-paper" title="Downloads with the logo">Logo</span>
                )}
                {(f.favorite || f.client_note) && (
                  <span className="meta pointer-events-none absolute right-1 top-1 rounded-full bg-paper px-1.5 text-[0.6rem] text-ink">{f.favorite ? "♥" : ""}{f.client_note ? " ✎" : ""}</span>
                )}
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

type Stats = { views: number; lastView: string | null; zips: number; downloads: number; picksAt: string | null };

/** Password, expiry date and what the client has done with the link. */
function AccessAndStats({ d, rows, refresh }: { d: DeliveryRow; rows: FileRow[]; refresh: () => Promise<void> }) {
  const [pw, setPw] = useState("");
  const [expires, setExpires] = useState(d.expires_at ? d.expires_at.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const stats = useQuery({
    queryKey: ["admin", "delivery-stats", d.id],
    queryFn: async (): Promise<Stats | null> => {
      const { data, error } = await supabase.from("client_delivery_events").select("kind, created_at").eq("delivery_id", d.id).order("created_at", { ascending: false }).limit(1000);
      if (error) return null;
      const rows = data ?? [];
      return {
        views: rows.filter((r) => r.kind === "view").length,
        lastView: rows.find((r) => r.kind === "view")?.created_at ?? null,
        zips: rows.filter((r) => r.kind === "zip").length,
        downloads: rows.filter((r) => r.kind === "download").length,
        picksAt: rows.find((r) => r.kind === "picks")?.created_at ?? null,
      };
    },
    refetchInterval: 60_000,
  });

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ok);
    await refresh();
  };
  const setPassword = async () => {
    const hash = await hashDeliveryPassword(d.id, pw.trim());
    try { localStorage.setItem(`delivery-pw:${d.id}`, pw.trim()); } catch { /* ignore */ }
    await run(() => supabase.from("client_deliveries").update({ password_hash: hash }).eq("id", d.id), "Password set — send it to the client with the link");
    setPw("");
  };
  const clearPassword = () => { try { localStorage.removeItem(`delivery-pw:${d.id}`); } catch { /* ignore */ } return run(() => supabase.from("client_deliveries").update({ password_hash: null }).eq("id", d.id), "Password removed"); };
  const saveExpiry = (value: string) => run(
    async () => {
      const r = await supabase.from("client_deliveries").update({ expires_at: value ? new Date(`${value}T23:59:59`).toISOString() : null }).eq("id", d.id);
      // A new date means a new reminder (ignored if that column isn't there yet).
      if (!r.error) await supabase.from("client_deliveries").update({ expiry_reminded_at: null }).eq("id", d.id);
      return r;
    },
    value ? `Link works until ${new Date(`${value}T12:00:00`).toLocaleDateString()}` : "No expiry date",
  );
  const expired = d.expires_at && new Date(d.expires_at).getTime() < Date.now();

  // Watermark until paid: make sure every photo has a watermarked preview, then switch on.
  const [wmProgress, setWmProgress] = useState<{ done: number; total: number } | null>(null);
  const setWatermark = async (on: boolean) => {
    if (!on) return run(() => supabase.from("client_deliveries").update({ watermark: false }).eq("id", d.id), "Watermark off — downloads are open");
    const todo = rows.filter((f) => !f.preview_wm_path);
    setWmProgress({ done: 0, total: todo.length });
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      const f = todo[i]!;
      try {
        const src = await bucket().createSignedUrl(f.preview_path ?? f.storage_path, 600);
        if (src.error) throw src.error;
        const bmp = await createImageBitmap(await (await fetch(src.data.signedUrl)).blob());
        const blob = await render(bmp, true);
        bmp.close();
        if (!blob) throw new Error("render");
        const path = `${f.storage_path.slice(0, f.storage_path.lastIndexOf("/"))}/preview-wm.jpg`;
        const up = await bucket().upload(path, blob, { contentType: "image/jpeg", cacheControl: "86400", upsert: true });
        if (up.error) throw up.error;
        const u = await supabase.from("client_delivery_files").update({ preview_wm_path: path }).eq("id", f.id);
        if (u.error) throw u.error;
      } catch (e) {
        console.error(e);
        failed++;
      }
      setWmProgress({ done: i + 1, total: todo.length });
    }
    setWmProgress(null);
    if (failed) toast.error(`${failed} preview(s) could not be watermarked — they show a light overlay instead`);
    await run(() => supabase.from("client_deliveries").update({ watermark: true }).eq("id", d.id), "Watermark on — the client sees previews only, no downloads");
  };
  const s = stats.data;

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-3xl border border-border/60 bg-card/30 p-5">
        <p className="meta text-muted-foreground">Access</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={d.password_hash ? "Password is set — type a new one to change" : "Password (optional)"}
            aria-label="Password"
            className={cn(input, "min-w-0 flex-1 rounded-full")}
            maxLength={100}
          />
          <button className={btnPrimary} disabled={busy || pw.trim().length < 3} onClick={setPassword}>{d.password_hash ? "Change" : "Set"}</button>
          {d.password_hash && <button className={btn} disabled={busy} onClick={clearPassword}>Remove</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`exp-${d.id}`} className="meta text-muted-foreground">Works until</label>
          <input id={`exp-${d.id}`} type="date" value={expires} onChange={(e) => { setExpires(e.target.value); void saveExpiry(e.target.value); }} className={cn(input, "w-auto rounded-full [color-scheme:dark]")} />
          {expires && <button className={btn} disabled={busy} onClick={() => { setExpires(""); void saveExpiry(""); }}>No limit</button>}
        </div>
        {expired && <p className="text-xs text-destructive">This link has expired — the client sees “expired”.</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            role="switch"
            aria-checked={!!d.watermark}
            disabled={busy || !!wmProgress}
            onClick={() => void setWatermark(!d.watermark)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:opacity-50", d.watermark ? "bg-paper" : "bg-transparent")}
          >
            <span className={cn("absolute top-0.5 size-[1.125rem] rounded-full transition-all", d.watermark ? "left-[1.375rem] bg-ink" : "left-0.5 bg-paper/70")} />
          </button>
          <span className="text-sm text-paper/85">
            {wmProgress ? `Watermarking previews… ${wmProgress.done} / ${wmProgress.total}` : "Watermark until paid"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">While on, the client sees watermarked previews and can’t download originals. Switch off once paid — same link.</p>
      </div>
      <div className="space-y-2 rounded-3xl border border-border/60 bg-card/30 p-5">
        <p className="meta text-muted-foreground">Client activity</p>
        {s === null ? (
          <p className="text-xs text-muted-foreground">Stats will appear once the database update for them is applied.</p>
        ) : !s ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-1 text-sm text-paper/85">
            <li>Opened {s.views} {s.views === 1 ? "time" : "times"}{s.lastView ? ` · last ${new Date(s.lastView).toLocaleString()}` : " · not yet"}</li>
            <li>ZIP downloaded {s.zips} {s.zips === 1 ? "time" : "times"}</li>
            <li>Single photos downloaded {s.downloads}</li>
            <li>{s.picksAt ? `Selection sent ${new Date(s.picksAt).toLocaleString()}` : "Selection not sent yet"}</li>
          </ul>
        )}
      </div>
    </div>
  );
}

type MsgLang = "en" | "et" | "ru";
const MSG: Record<MsgLang, { hi: (n: string) => string; ready: string; pw: string; until: string; how: string; wm: string; sign: string }> = {
  en: { hi: (n) => (n ? `Hi ${n}!` : "Hi!"), ready: "Your photos are ready:", pw: "Password:", until: "The link works until", how: "You can download everything at once or one by one, and mark your favourites with a heart.", wm: "These are previews with a watermark — downloads open after payment.", sign: "— Gor" },
  et: { hi: (n) => (n ? `Tere, ${n}!` : "Tere!"), ready: "Sinu fotod on valmis:", pw: "Parool:", until: "Link töötab kuni", how: "Saad kõik korraga või ükshaaval alla laadida ning märkida lemmikud südamega.", wm: "Need on vesimärgiga eelvaated — allalaadimine avaneb pärast tasumist.", sign: "— Gor" },
  ru: { hi: (n) => (n ? `Здравствуйте, ${n}!` : "Здравствуйте!"), ready: "Ваши фото готовы:", pw: "Пароль:", until: "Ссылка работает до", how: "Можно скачать всё сразу или по одному и отметить понравившиеся сердечком.", wm: "Это превью с водяным знаком — скачивание откроется после оплаты.", sign: "— Гор" },
};

/** Ready-to-send message for the client in EN / ET / RU — copy, or open in WhatsApp / Telegram. */
function ClientMessage({ d, link, client }: { d: DeliveryRow; link: string; client: Client | null }) {
  const templates = useTemplates();
  // The chosen language and any edits are kept per delivery (in this browser), so they survive
  // closing the delivery or reloading the studio.
  const key = (k: string) => `delivery-msg:${d.id}:${k}`;
  const read = (k: string) => { try { return typeof window === "undefined" ? null : localStorage.getItem(key(k)); } catch { return null; } };
  const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(key(k)); else localStorage.setItem(key(k), v); } catch { /* private mode */ } };
  const [lang, setLangState] = useState<MsgLang>(() => { const l = read("lang"); return l === "et" || l === "ru" || l === "en" ? l : client?.lang ?? "en"; });
  const [edited, setEditedState] = useState<string | null>(() => read(`text:${(() => { const l = read("lang"); return l === "et" || l === "ru" ? l : "en"; })()}`));
  const setLang = (l: MsgLang) => { setLangState(l); write("lang", l); setEditedState(read(`text:${l}`)); };
  const setEdited = (v: string | null) => { setEditedState(v); write(`text:${lang}`, v); };
  let pw: string | null = null;
  try { pw = typeof window === "undefined" ? null : localStorage.getItem(`delivery-pw:${d.id}`); } catch { /* ignore */ }
  const m = MSG[lang];
  const date = d.expires_at ? new Date(d.expires_at).toLocaleDateString("en-GB").replace(/\//g, ".") : null;
  const text = [
    m.hi(d.client_name ?? ""),
    "",
    `${m.ready} ${d.title}`,
    `${link}?lang=${lang}`,
    d.password_hash ? `${m.pw} ${pw ?? "…"}` : null,
    date ? `${m.until} ${date}.` : null,
    "",
    d.watermark ? m.wm : m.how,
    "",
    m.sign,
  ].filter((l) => l !== null).join("\n");
  const vars: Record<string, string> = { name: d.client_name ?? "", company: client?.company ?? "", title: d.title, link: `${link}?lang=${lang}`, password: pw ?? "", until: date ?? "" };
  // The client's default template is used when nothing was written by hand for this delivery.
  const clientTpl = client?.template_id ? templates.data?.find((t) => t.id === client.template_id && t.lang === lang) : undefined;
  const value = edited ?? (clientTpl ? fillTemplate(clientTpl.body, vars) : text);
  const saveTemplate = async () => {
    const title = window.prompt("Template name", client ? `${clientLabel(client)} — ${lang.toUpperCase()}` : `Message — ${lang.toUpperCase()}`);
    if (!title?.trim()) return;
    const r = await (supabase as any).from("message_templates").insert({ title: title.trim(), lang, body: toTemplate(value, vars) });
    if (r.error) toast.error(/message_templates|relation|schema/i.test(r.error.message) ? "Templates need their database update (migration “clients_templates”) — apply it in Lovable first." : r.error.message);
    else { toast.success("Saved as a template"); await templates.refetch(); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast.success("Message copied"); } catch { toast.error("Could not copy"); }
  };
  return (
    <div className="mt-4 space-y-3 rounded-3xl border border-border/60 bg-card/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="meta text-muted-foreground">Message to the client</p>
        <div className="glass inline-flex rounded-full p-1">
          {(["en", "et", "ru"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cn("meta rounded-full px-3 py-1", lang === l ? "bg-paper text-ink" : "text-paper/75")}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      {!!templates.data?.length && (
        <select className={cn(input, "w-auto")} value="" aria-label="Use a template"
          onChange={(e) => { const t = templates.data?.find((x) => x.id === e.target.value); if (t) { const filled = fillTemplate(t.body, { ...vars, link: `${link}?lang=${t.lang}` }); setLangState(t.lang); write("lang", t.lang); setEditedState(filled); write(`text:${t.lang}`, filled); } }}>
          <option value="">Use a template…</option>
          {templates.data.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.lang.toUpperCase()})</option>)}
        </select>
      )}
      <textarea value={value} onChange={(e) => setEdited(e.target.value)} rows={9} className={cn(input, "resize-y font-sans text-sm leading-relaxed")} aria-label="Message to the client" />
      {d.password_hash && !pw && <p className="text-xs text-muted-foreground">The password isn’t known in this browser — type it in place of “…”, or set it again above.</p>}
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={copy}>Copy message</button>
        {edited !== null && <button className={btn} onClick={() => setEdited(null)} title="Back to the standard text for this language">Reset text</button>}
        <button className={btn} onClick={() => void saveTemplate()} title="Keep this text for other deliveries (details become placeholders)">Save as template</button>
        <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(value)}`} target="_blank" rel="noopener noreferrer">Send in WhatsApp</a>
        <a className={btn} href={`https://t.me/share/url?url=${encodeURIComponent(value)}`} /* the whole message goes in "url": with url + text Telegram printed the link twice */ target="_blank" rel="noopener noreferrer">Send in Telegram</a>
      </div>
    </div>
  );
}

/** New client delivery from files picked in the media library; returns the client link. */
export async function createDeliveryFromFiles(title: string, files: File[], onProgress?: (done: number) => void) {
  const { data: d, error } = await supabase.from("client_deliveries").insert({ token: newToken(), title }).select("id, token").single();
  if (error || !d) throw new Error("Could not create the delivery");
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    try {
      const folder = `${d.id}/${crypto.randomUUID()}`;
      const original = `${folder}/${safeName(file.name)}`;
      const up = await bucket().upload(original, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw up.error;
      const { blob, w, h } = await makePreview(file, false);
      let preview: string | null = null;
      if (blob) {
        const p = `${folder}/preview.jpg`;
        const r = await bucket().upload(p, blob, { contentType: "image/jpeg", cacheControl: "86400" });
        if (!r.error) preview = p;
      }
      const ins = await supabase.from("client_delivery_files").insert({ delivery_id: d.id, storage_path: original, preview_path: preview, file_name: file.name, size: file.size, w, h, position: i });
      if (ins.error) throw ins.error;
    } catch { failed++; }
    onProgress?.(i + 1);
  }
  return { id: d.id as string, link: linkFor(d.token as string), failed };
}

/* ---------------- Custom watermark (logo) on downloads ---------------- */

async function loadLogo(path: string): Promise<ImageBitmap> {
  const r = await bucket().download(path);
  if (r.error || !r.data) throw new Error("The logo file could not be loaded");
  return createImageBitmap(r.data);
}

/** Makes (or remakes) one photo's copy with the logo and points the file at it. */
async function bakeFile(f: { id: string; storage_path: string; preview_path?: string | null; branded_path?: string | null }, b: Brand, logo: ImageBitmap, source?: Blob, previewOnly = false) {
  // The gallery preview gets the same logo, so what the client sees is what they download.
  const pv = f.preview_path ? await bucket().download(f.preview_path) : null;
  if (pv?.data) {
    const small = await bakeBrand(pv.data, logo, b, 0.86);
    const up = await bucket().upload(brandedPreviewFor(f.storage_path, b.v), small, { contentType: "image/jpeg", cacheControl: "86400" });
    if (up.error && !/exist|duplicate/i.test(up.error.message)) throw up.error;
  }
  if (previewOnly) return;
  let photo = source;
  if (!photo) {
    const r = await bucket().download(f.storage_path);
    if (r.error || !r.data) throw new Error(r.error?.message || "The original could not be downloaded");
    photo = r.data;
  }
  const blob = await bakeBrand(photo, logo, b);
  const path = brandedPathFor(f.storage_path, b.v);
  const up = await bucket().upload(path, blob, { contentType: blob.type });
  if (up.error && !/exist|duplicate/i.test(up.error.message)) throw up.error;
  const u = await supabase.from("client_delivery_files").update({ branded_path: path } as never).eq("id", f.id);
  if (u.error) throw u.error;
  if (f.branded_path && f.branded_path !== path) await bucket().remove([f.branded_path, `${f.branded_path.slice(0, f.branded_path.lastIndexOf("/"))}/__preview.jpg`]);
}

const CORNERS: { id: Corner; label: string }[] = [
  { id: "tl", label: "↖" }, { id: "tr", label: "↗" }, { id: "bl", label: "↙" }, { id: "br", label: "↘" },
];
type BrandLook = Omit<Brand, "on" | "v">;
const sameLook = (a: BrandLook | null, b: BrandLook | null) => !!a && !!b && a.logo === b.logo && a.corner === b.corner && a.size === b.size && a.margin === b.margin && a.opacity === b.opacity;
const lookOf = (b: Brand): BrandLook => ({ logo: b.logo, corner: b.corner, size: b.size, margin: b.margin, opacity: b.opacity });

/**
 * Custom watermark: upload a logo, pick a corner, size, margin and opacity with a live preview on the
 * delivery's own photos, then "Apply" bakes it into full-size copies the client downloads. Not tied to payment.
 */
function BrandPanel({ d, rows, thumbs, refresh, picked, onPickedDone }: { d: DeliveryRow; rows: FileRow[]; thumbs?: Map<string, string>; refresh: () => Promise<void>; picked: Set<string>; onPickedDone: () => void }) {
  const saved = d.brand ?? null;
  const skip = new Set(saved?.skip ?? []);
  const logoRows = rows.filter((f) => !skip.has(f.id));
  // A new delivery starts from the last logo setup used.
  const last = useQuery({
    queryKey: ["admin", "brand-last"],
    enabled: !saved,
    queryFn: async () => {
      const r = await supabase.from("client_deliveries").select("brand" as never).not("brand" as never, "is", null).order("created_at", { ascending: false }).limit(1);
      return r.error ? null : (((r.data as unknown as { brand: Brand | null }[] | null)?.[0]?.brand) ?? null);
    },
  });
  const base: BrandLook | null = saved ? lookOf(saved) : last.data ? lookOf(last.data) : null;
  const [draft, setDraft] = useState<BrandLook | null>(null);
  const look = draft ?? base;
  const changed = !!draft && !sameLook(draft, saved ? lookOf(saved) : null);
  const logoUrl = useQuery({
    queryKey: ["admin", "brand-logo", look?.logo],
    enabled: !!look?.logo,
    queryFn: async () => (await bucket().createSignedUrl(look!.logo, 3600)).data?.signedUrl ?? null,
    staleTime: 50 * 60_000,
  });
  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);
  const [sample, setSample] = useState(0);
  const [run, setRun] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const upToDate = saved ? logoRows.filter((f) => f.branded_path === brandedPathFor(f.storage_path, saved.v)).length : 0;
  const s = rows.length ? rows[((sample % rows.length) + rows.length) % rows.length]! : null;
  const W = s?.w ?? 3000, H = s?.h ?? 2000;

  const set = (patch: Partial<BrandLook>) => look && setDraft({ ...look, ...patch });
  const needsDb = (m: string) => /brand|column|schema/i.test(m)
    ? "Custom watermark needs its database update (migration “delivery_brand”) — apply it in Lovable first."
    : m;

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `brand/${crypto.randomUUID()}.${ext}`;
      const up = await bucket().upload(path, file, { contentType: file.type || "image/png" });
      if (up.error) throw up.error;
      setLogoDims(null);
      setDraft(look ? { ...look, logo: path } : { logo: path, corner: BRAND_DEFAULT.corner, size: BRAND_DEFAULT.size, margin: BRAND_DEFAULT.margin, opacity: BRAND_DEFAULT.opacity });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const bakeAll = async (b: Brand, again = false, only?: FileRow[]) => {
    // "Apply again" also redoes photos that already have their copy (only their gallery preview is remade).
    // Photos marked "no logo" are skipped.
    const pool = (only ?? rows).filter((f) => !(b.skip ?? []).includes(f.id));
    const todo = again ? pool : pool.filter((f) => f.branded_path !== brandedPathFor(f.storage_path, b.v));
    if (!todo.length) return;
    const logo = await loadLogo(b.logo);
    let done = 0, failed = 0;
    let firstError = "";
    setRun({ done: 0, total: todo.length, failed: 0 });
    const queue = [...todo];
    const work = async () => {
      while (queue.length) {
        const f = queue.shift()!;
        try { await bakeFile(f, b, logo, undefined, again && f.branded_path === brandedPathFor(f.storage_path, b.v)); } catch (e) { failed++; if (!firstError) firstError = (e as Error)?.message || String(e); console.error("brand", f.file_name, e); }
        done++;
        setRun({ done, total: todo.length, failed });
      }
    };
    await Promise.all([work(), work()]);
    logo.close();
    setRun(null);
    if (failed) toast.error(`${failed} of ${todo.length} photos could not get the logo: ${needsDb(firstError)}`);
    else toast.success(`Logo added to ${todo.length} photo${todo.length > 1 ? "s" : ""} — the client downloads these`);
  };

  const apply = async () => {
    if (!look?.logo) return;
    setBusy(true);
    try {
      const b: Brand = { ...look, on: true, v: changed || !saved ? Date.now() : saved.v, ...(saved?.skip?.length ? { skip: saved.skip } : {}) };
      const r = await supabase.from("client_deliveries").update({ brand: b } as never).eq("id", d.id);
      if (r.error) throw new Error(needsDb(r.error.message));
      setDraft(null);
      await bakeAll(b, !!saved && saved.on && !changed && upToDate === logoRows.length);
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
    await refresh();
  };
  const switchOff = async () => {
    if (!saved) return;
    setBusy(true);
    const r = await supabase.from("client_deliveries").update({ brand: { ...saved, on: false } } as never).eq("id", d.id);
    setBusy(false);
    if (r.error) toast.error(r.error.message); else toast.success("Custom watermark off — the client downloads the originals");
    await refresh();
  };

  // Choose per photo: the selected photos get the logo, or go without it (same delivery).
  const pickedRows = rows.filter((f) => picked.has(f.id));
  const setLogoFor = async (withLogo: boolean) => {
    if (!saved || !pickedRows.length) return;
    setBusy(true);
    try {
      const ids = new Set(pickedRows.map((f) => f.id));
      const next = withLogo ? [...skip].filter((id) => !ids.has(id)) : [...new Set([...skip, ...ids])];
      const b: Brand = { ...saved, skip: next };
      const r = await supabase.from("client_deliveries").update({ brand: b } as never).eq("id", d.id);
      if (r.error) throw new Error(needsDb(r.error.message));
      if (withLogo && saved.on) await bakeAll(b, false, pickedRows);
      else toast.success(withLogo ? `${ids.size} photo${ids.size > 1 ? "s" : ""} will get the logo — press Apply` : `${ids.size} photo${ids.size > 1 ? "s" : ""} delivered without the logo`);
      onPickedDone();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
    await refresh();
  };

  // Logo position on the preview, in % of the photo — the same maths as the baked copies.
  const pos = look && logoDims ? placeLogo(W, H, logoDims.w, logoDims.h, look) : null;
  const on = !!saved?.on;

  return (
    <div className="mt-4 space-y-4 rounded-3xl border border-border/60 bg-card/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="meta text-muted-foreground">Custom watermark on downloads{on ? ` · on · ${upToDate} / ${logoRows.length} photos${skip.size ? ` · ${skip.size} without` : ""}` : " · off"}</p>
        <label className={cn(btn, "cursor-pointer", busy && "pointer-events-none opacity-50")}>
          {look?.logo ? "Change logo" : "+ Upload logo"}
          <input type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" className="hidden" onChange={(e) => { void uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {!look?.logo ? (
        <p className="text-xs text-muted-foreground">Upload your logo (PNG with a transparent background works best). It goes into the corner you choose, at the same relative size on every photo, and the client downloads the photos with it. Not related to payment.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            {/* Live preview on this delivery's own photos. */}
            <div className="relative overflow-hidden rounded-xl bg-charcoal" style={{ aspectRatio: `${W} / ${H}`, maxHeight: "26rem" }}>
              {s && thumbs?.get(s.id) && <img src={thumbs.get(s.id)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              {logoUrl.data && (
                <img
                  src={logoUrl.data}
                  alt=""
                  onLoad={(e) => setLogoDims({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 })}
                  className="pointer-events-none absolute transition-all duration-200"
                  style={pos ? { left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%`, width: `${(pos.width / W) * 100}%`, opacity: look.opacity } : { opacity: 0 }}
                />
              )}
            </div>
            {rows.length > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <button className={btn} onClick={() => setSample((v) => v - 1)} aria-label="Previous photo">←</button>
                <button className={btn} onClick={() => setSample((v) => v + 1)} aria-label="Next photo">→</button>
                <span className="meta truncate text-muted-foreground">{s?.file_name}</span>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="meta mb-2 text-muted-foreground">Corner</p>
              <div className="grid w-28 grid-cols-2 gap-2">
                {CORNERS.map((c) => (
                  <button key={c.id} type="button" onClick={() => set({ corner: c.id })} aria-pressed={look.corner === c.id}
                    className={cn("aspect-square rounded-xl border text-lg transition", look.corner === c.id ? "border-paper bg-paper text-ink" : "border-border text-paper/80 hover:border-paper/60")}>{c.label}</button>
                ))}
              </div>
            </div>
            {([["size", "Size", 4, 40, "% of the short side"], ["margin", "Distance from edge", 0, 15, "%"], ["opacity", "Opacity", 10, 100, "%"]] as const).map(([k, label, min, max, unit]) => {
              const value = k === "opacity" ? Math.round(look.opacity * 100) : look[k];
              return (
                <label key={k} className="block">
                  <span className="meta flex justify-between text-muted-foreground"><span>{label}</span><span className="text-paper/85">{value}{unit.startsWith("%") ? "%" : ""}</span></span>
                  <input type="range" min={min} max={max} step={1} value={value} className="mt-1 w-full accent-[var(--paper)]"
                    onChange={(e) => { const n = Number(e.target.value); set(k === "opacity" ? { opacity: n / 100 } : { [k]: n } as Partial<BrandLook>); }} />
                </label>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary} disabled={busy || !!run || !rows.length} onClick={() => void apply()}>
                {run ? `Adding logo ${run.done} / ${run.total}…` : on && !changed && upToDate < logoRows.length ? `Add to ${logoRows.length - upToDate} new` : on && !changed ? "Apply again" : `Apply to ${logoRows.length} photo${logoRows.length === 1 ? "" : "s"}`}
              </button>
              {draft && <button className={btn} disabled={busy || !!run} onClick={() => setDraft(null)}>Reset</button>}
              {on && <button className={btn} disabled={busy || !!run} onClick={() => void switchOff()}>Switch off</button>}
            </div>
            {saved && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                {pickedRows.length ? (
                  <>
                    <span className="meta text-muted-foreground">{pickedRows.length} selected:</span>
                    <button className={btn} disabled={busy || !!run} onClick={() => void setLogoFor(true)}>With logo</button>
                    <button className={btn} disabled={busy || !!run} onClick={() => void setLogoFor(false)}>Without logo</button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Select photos below to choose which ones get the logo — photos marked “Logo” download with it.</span>
                )}
              </div>
            )}
            {run && <span className="block h-1 overflow-hidden rounded-full bg-paper/15"><span className="block h-full bg-paper transition-[width] duration-300" style={{ width: `${Math.round((run.done / run.total) * 100)}%` }} /></span>}
            <p className="text-xs text-muted-foreground">
              {changed && on ? "Changes are not applied yet — press Apply. " : ""}
              Full-size copies with the logo are made in this browser (a computer is faster for big files); your originals stay untouched. New photos uploaded here get the logo automatically while it’s on.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
