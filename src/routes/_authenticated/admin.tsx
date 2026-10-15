import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { discoverWfolioAlbums, importWfolioAlbum, IMPORT_BATCH, type AlbumResult } from "@/lib/wfolio-import.functions";
import { importWfolio, type HomeImage } from "@/lib/portfolio.functions";
import { defaultHero, defaultAbout } from "@/content/home";
import { useLightbox } from "@/components/Lightbox";
import { SessionStack } from "@/components/Gallery";
import { categories } from "@/content/categories";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Studio — thegodnamed" },
      { name: "description", content: "Private portfolio management for thegodnamed." },
      { property: "og:title", content: "Studio — thegodnamed" },
      { property: "og:description", content: "Private portfolio management for thegodnamed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Media = { id: string; sm: string; src: string; full_src: string; w: number; h: number; album: string | null; origin_category: string | null; storage_path: string | null };
type Shoot = { id: string; category: string; title: string; album: string | null; cover_media_id: string | null; status: string; sort_order: number; source_url: string | null; source_album: string | null; import_batch: string | null; review_status: string | null };
type Link_ = { photoshoot_id: string; media_id: string; position: number };

const photoCats = categories.filter((c) => !c.external && c.videos.length === 0);
const catTitle = (slug: string) => categories.find((c) => c.slug === slug)?.title ?? slug;

const btn = "meta inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40";
const btnPrimary = "meta inline-flex items-center justify-center gap-2 rounded-full bg-paper px-4 py-2 text-ink transition-opacity hover:opacity-90 disabled:opacity-40";
const input = "w-full rounded-full border border-border bg-transparent px-4 py-2.5 text-sm text-paper outline-none focus:border-paper/60";

/** Reads every row past the 1000-row API page limit. */
async function all(page: (a: number, b: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await page(a, a + 999);
    if (error) return { data: null, error };
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: out, error: null };
  }
}

function useData() {
  return useQuery({
    queryKey: ["admin", "portfolio"],
    queryFn: async () => {
      const [m, s, l] = await Promise.all([
        all((a, b) => supabase.from("media").select("*").order("created_at").order("id").range(a, b)),
        supabase.from("photoshoots").select("*").order("sort_order"),
        all((a, b) => supabase.from("photoshoot_images").select("*").order("photoshoot_id").order("position").range(a, b)),
      ]);
      const err = m.error ?? s.error ?? l.error;
      if (err) throw err;
      return { media: m.data as Media[], shoots: s.data as Shoot[], links: l.data as Link_[] };
    },
  });
}

function useIsAdmin() {
  return useQuery({
    queryKey: ["admin", "role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return !!data;
    },
  });
}

async function readSize(file: File) {
  const bmp = await createImageBitmap(file);
  const r = { w: bmp.width, h: bmp.height };
  bmp.close();
  return r;
}

/** Uploads files to private storage; returns inserted media rows. */
async function uploadFiles(files: File[]): Promise<Media[]> {
  const out: Media[] = [];
  for (const file of files) {
    const { w, h } = await readSize(file);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `uploads/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("portfolio").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (up.error) throw up.error;
    const signed = await supabase.storage.from("portfolio").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error) throw signed.error;
    const url = signed.data.signedUrl;
    const { data, error } = await supabase.from("media").insert({ sm: url, src: url, full_src: url, w, h, storage_path: path }).select("*").single();
    if (error) throw error;
    out.push(data as Media);
  }
  return out;
}

function AdminPage() {
  const role = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (role.isLoading) return <Shell onSignOut={signOut}><p className="meta text-muted-foreground">Loading…</p></Shell>;
  if (!role.data) return <Shell onSignOut={signOut}><p className="text-sm text-muted-foreground">This account has no access to the studio.</p></Shell>;
  return <Shell onSignOut={signOut}><Studio /></Shell>;
}

function Shell({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  return (
    <main className="min-h-[100svh] px-4 pb-24 md:px-10">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-baseline gap-3">
          <Link to="/" className="wordmark text-paper">thegodnamed</Link>
          <span className="meta text-muted-foreground">Studio</span>
        </div>
        <button onClick={onSignOut} className={btn}>Sign out</button>
      </header>
      {children}
    </main>
  );
}

function Studio() {
  const q = useData();
  const qc = useQueryClient();
  const runImport = useServerFn(importWfolio);
  const [tab, setTab] = useState<"shoots" | "library" | "home" | "review">("shoots");
  const [cat, setCat] = useState(photoCats[0]!.slug);
  const [selected, setSelected] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "portfolio"] });

  const imp = useMutation({
    mutationFn: () => runImport(),
    onSuccess: (r) => { toast.success(r.skipped ? "Already imported" : `Imported ${r.imported} photos into ${r.sessions} draft photoshoots`); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Could not load the portfolio.</p>;
  const { media, shoots, links } = q.data;
  const hasImport = media.some((m) => m.origin_category);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="glass flex rounded-full p-1">
          {(["shoots", "review", "library", "home"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("meta rounded-full px-4 py-2", tab === t ? "bg-paper text-ink" : "text-paper/75")}>
              {t === "shoots" ? "Photoshoots" : t === "review" ? "Import review" : t === "library" ? "Media library" : "Homepage"}
            </button>
          ))}
        </div>
        {!hasImport && (
          <button className={btnPrimary} disabled={imp.isPending} onClick={() => imp.mutate()}>
            {imp.isPending ? "Importing…" : "Import original Wfolio photos"}
          </button>
        )}
      </div>

      <WhatsAppSetting />
      {tab === "review" ? (
        <ReviewTab shoots={shoots} links={links} media={media} refresh={refresh} onEdit={(sh) => { setTab("shoots"); setCat(sh.category); setSelected(sh.id); }} />
      ) : tab === "home" ? (
        <HomeTab media={media} refresh={refresh} />
      ) : tab === "shoots" ? (
        <ShootsTab
          cat={cat} setCat={(c) => { setCat(c); setSelected(null); }}
          shoots={shoots} links={links} media={media}
          selected={selected} setSelected={setSelected} refresh={refresh}
        />
      ) : (
        <LibraryTab shoots={shoots} links={links} media={media} refresh={refresh} />
      )}
    </div>
  );
}

function WhatsAppSetting() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: async () => (await supabase.from("site_settings").select("whatsapp_url").eq("id", 1).maybeSingle()).data });
  const [val, setVal] = useState<string | null>(null);
  const value = val ?? q.data?.whatsapp_url ?? "";
  const save = useMutation({
    mutationFn: async () => {
      const v = value.trim();
      if (v && !/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(v)) throw new Error("Use a link like https://wa.me/372…");
      const { error } = await supabase.from("site_settings").upsert({ id: 1, whatsapp_url: v || null, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("WhatsApp link saved"); qc.invalidateQueries({ queryKey: ["site-settings"] }); qc.invalidateQueries({ queryKey: ["admin", "settings"] }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mb-8 flex flex-wrap items-center gap-3">
      <label htmlFor="wa" className="meta text-muted-foreground">WhatsApp link</label>
      <input id="wa" value={value} onChange={(e) => setVal(e.target.value)} placeholder="https://wa.me/372…" maxLength={200}
        className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 py-2 text-sm text-paper placeholder:text-muted-foreground sm:max-w-sm" />
      <button className={btn} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
    </form>
  );
}

/* ---------------- Import review ---------------- */

function ReviewTab({ shoots, links, media, refresh, onEdit }: { shoots: Shoot[]; links: Link_[]; media: Media[]; refresh: () => void; onEdit: (s: Shoot) => void }) {
  const discover = useServerFn(discoverWfolioAlbums);
  const importOne = useServerFn(importWfolioAlbum);
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<{ results: AlbumResult[]; failedPages: string[] } | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const byId = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const batch = shoots.filter((s) => s.import_batch === IMPORT_BATCH);
  const usage = useMemo(() => {
    const u = new Map<string, number>();
    links.forEach((l) => u.set(l.media_id, (u.get(l.media_id) ?? 0) + 1));
    return u;
  }, [links]);
  const list = batch.filter((s) => filter === "all" || (s.review_status ?? "pending") === filter).sort((a, b) => a.sort_order - b.sort_order);

  const run = async () => {
    try {
      const { albums, failedPages } = await discover();
      setRunning({ done: 0, total: albums.length });
      const results: AlbumResult[] = [];
      let i = 0;
      const worker = async () => {
        while (i < albums.length) {
          const a = albums[i++]!;
          try { results.push(await importOne({ data: a })); }
          catch (e) { results.push({ slug: a.slug, url: `https://thegodnamed.wfolio.pro/${a.slug}`, title: a.slug, status: "failed", photos: 0, newMedia: 0, reused: 0, error: (e as Error).message }); }
          setRunning((r) => r && { ...r, done: r.done + 1 });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      setReport({ results, failedPages });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
    setRunning(null);
  };

  const setStatus = async (id: string, review_status: string) => {
    const { error } = await supabase.from("photoshoots").update({ review_status }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<string, number>;
  batch.forEach((s) => { counts[s.review_status ?? "pending"] = (counts[s.review_status ?? "pending"] ?? 0) + 1; });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} disabled={!!running} onClick={run}>
          {running ? `Importing ${running.done} / ${running.total}…` : batch.length ? "Check Wfolio for missing albums" : "Import albums from Wfolio"}
        </button>
        <p className="meta text-muted-foreground">One original album = one draft photoshoot. Nothing is published automatically.</p>
      </div>

      {report && (
        <div className="rounded-2xl border border-border p-4 text-sm text-paper/80">
          <p className="meta mb-2 text-paper">Last run</p>
          <p>
            {report.results.filter((r) => r.status === "imported").length} imported ·{" "}
            {report.results.filter((r) => r.status === "exists").length} already imported ·{" "}
            {report.results.reduce((n, r) => n + r.newMedia, 0)} new photos ·{" "}
            {report.results.reduce((n, r) => n + r.reused, 0)} photos already in library (reused, not copied)
          </p>
          {[...report.results.filter((r) => r.status === "failed" || r.status === "empty")].map((r) => (
            <p key={r.slug} className="text-destructive">{r.slug}: {r.status}{r.error ? ` — ${r.error}` : ""}</p>
          ))}
          {report.failedPages.map((p) => <p key={p} className="text-destructive">Category page unavailable: {p}</p>)}
        </div>
      )}

      <div className="glass inline-flex rounded-full p-1">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("meta rounded-full px-3 py-1.5", filter === f ? "bg-paper text-ink" : "text-paper/75")}>
            {f}{f !== "all" ? ` ${counts[f] ?? 0}` : ` ${batch.length}`}
          </button>
        ))}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const ids = links.filter((l) => l.photoshoot_id === s.id).map((l) => l.media_id);
          const dupes = ids.filter((id) => (usage.get(id) ?? 0) > 1).length;
          const cover = byId.get(s.cover_media_id ?? ids[0] ?? "");
          const st = s.review_status ?? "pending";
          return (
            <li key={s.id} className="flex gap-3 rounded-2xl border border-border p-3">
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-charcoal">
                {cover && <img src={cover.sm} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="truncate text-paper">{s.source_album ?? s.title}{s.title !== s.source_album && <span className="text-muted-foreground"> → {s.title}</span>}</p>
                <p className="meta text-muted-foreground">{catTitle(s.category)} · {ids.length} photos · {st} · {s.status}</p>
                {s.source_url && <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="meta block truncate text-muted-foreground underline">{s.source_url.replace("https://", "")}</a>}
                {dupes > 0 && <p className="meta text-destructive">{dupes} photos also in other stacks</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {st !== "approved" && <button className={btn} onClick={() => setStatus(s.id, "approved")}>Approve</button>}
                  {st !== "rejected" && <button className={btn} onClick={() => setStatus(s.id, "rejected")}>Reject</button>}
                  {st !== "pending" && <button className={btn} onClick={() => setStatus(s.id, "pending")}>Reset</button>}
                  <button className={btn} onClick={() => onEdit(s)}>Edit</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {!list.length && <p className="meta text-muted-foreground">Nothing here.</p>}
    </div>
  );
}

/* ---------------- Photoshoots ---------------- */

function ShootsTab({ cat, setCat, shoots, links, media, selected, setSelected, refresh }: {
  cat: string; setCat: (c: string) => void; shoots: Shoot[]; links: Link_[]; media: Media[];
  selected: string | null; setSelected: (id: string | null) => void; refresh: () => void;
}) {
  const list = shoots.filter((s) => s.category === cat);
  const byId = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));
  const current = shoots.find((s) => s.id === selected);

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = list.map((s) => s.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    await Promise.all(next.map((id, i) => supabase.from("photoshoots").update({ sort_order: i }).eq("id", id)));
    refresh();
  };

  const create = async () => {
    const { data, error } = await supabase.from("photoshoots").insert({ category: cat, title: "Untitled session", status: "draft", sort_order: list.length }).select("id").single();
    if (error) { toast.error(error.message); return; }
    refresh();
    setSelected(data.id);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <aside className={cn(current && "hidden lg:block")}>
        <div className="mb-4 flex flex-wrap gap-2">
          {photoCats.map((c) => (
            <button key={c.slug} onClick={() => setCat(c.slug)} className={cn("meta rounded-full border px-3 py-1.5", cat === c.slug ? "border-paper bg-paper text-ink" : "border-border text-paper/70")}>
              {c.title}
            </button>
          ))}
        </div>
        <button onClick={create} className={cn(btnPrimary, "mb-4 w-full")}>+ New photoshoot</button>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={list.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {list.map((s) => {
                const count = links.filter((l) => l.photoshoot_id === s.id).length;
                const first = links.find((l) => l.photoshoot_id === s.id)?.media_id;
                const cover = byId.get(s.cover_media_id ?? "") ?? byId.get(first ?? "");
                return (
                  <SortableRow key={s.id} id={s.id}>
                    <button onClick={() => setSelected(s.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors", selected === s.id ? "border-paper/60 bg-card" : "border-border hover:border-paper/30")}>
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-charcoal">{cover && <img src={cover.sm} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-paper">{s.title}</p>
                        <p className="meta text-muted-foreground">{String(count).padStart(2, "0")} frames</p>
                      </div>
                      <StatusPill status={s.status} />
                    </button>
                  </SortableRow>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
        {list.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No photoshoots in {catTitle(cat)} yet.</p>}
      </aside>

      {current ? (
        <ShootEditor key={current.id} shoot={current} shoots={shoots} links={links} byId={byId} refresh={refresh} onClose={() => setSelected(null)} onSelect={setSelected} />
      ) : (
        <p className="hidden text-sm text-muted-foreground lg:block">Select a photoshoot to edit, or drag to reorder.</p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={cn("meta shrink-0 rounded-full px-2.5 py-1 text-[0.6rem]", status === "published" ? "bg-paper text-ink" : "border border-border text-muted-foreground")}>{status === "published" ? "Live" : "Draft"}</span>;
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn("touch-manipulation", isDragging && "relative z-10 opacity-80")} {...attributes} {...listeners}>
      {children}
    </li>
  );
}

function ShootEditor({ shoot, shoots, links, byId, refresh, onClose, onSelect }: {
  shoot: Shoot; shoots: Shoot[]; links: Link_[]; byId: Map<string, Media>; refresh: () => void; onClose: () => void; onSelect: (id: string | null) => void;
}) {
  const { open } = useLightbox();
  const [title, setTitle] = useState(shoot.title);
  const [album, setAlbum] = useState(shoot.album ?? "");
  const [category, setCategory] = useState(shoot.category);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));

  const ordered = links.filter((l) => l.photoshoot_id === shoot.id).sort((a, b) => a.position - b.position).map((l) => byId.get(l.media_id)).filter((m): m is Media => !!m);
  const coverId = shoot.cover_media_id && ordered.some((m) => m.id === shoot.cover_media_id) ? shoot.cover_media_id : ordered[0]?.id;
  const dirty = title !== shoot.title || album !== (shoot.album ?? "") || category !== shoot.category;

  const viewerOrder = coverId ? [ordered.find((m) => m.id === coverId)!, ...ordered.filter((m) => m.id !== coverId)] : ordered;
  const preview = () => viewerOrder.length && open(viewerOrder.map((m) => ({ src: m.full_src, w: m.w, h: m.h, alt: title })), 0, title);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
    refresh();
  };
  const check = <T,>(r: { error: { message: string } | null; data?: T | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };

  const save = (status?: string) => act(async () => {
    const patch: Partial<Shoot> = { title: title.trim() || "Untitled session", album: album.trim() || null };
    if (category !== shoot.category) { patch.category = category; patch.sort_order = shoots.filter((s) => s.category === category).length; }
    if (status) patch.status = status;
    check(await supabase.from("photoshoots").update(patch).eq("id", shoot.id));
  }, status === "published" ? "Published" : status === "draft" ? "Unpublished — saved as draft" : "Saved");

  const reorder = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = ordered.map((m) => m.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    act(async () => check(await supabase.from("photoshoot_images").upsert(next.map((media_id, position) => ({ photoshoot_id: shoot.id, media_id, position })))));
  };

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    act(async () => {
      const rows = await uploadFiles([...files]);
      check(await supabase.from("photoshoot_images").insert(rows.map((m, i) => ({ photoshoot_id: shoot.id, media_id: m.id, position: ordered.length + i }))));
    }, `${files.length} photo${files.length > 1 ? "s" : ""} added`);
  };

  const removeSel = () => act(async () => {
    check(await supabase.from("photoshoot_images").delete().eq("photoshoot_id", shoot.id).in("media_id", [...picked]));
    setPicked(new Set());
  }, "Removed from photoshoot (kept in library)");

  const moveSel = (target: string) => act(async () => {
    let to = target;
    if (target === "new") {
      to = check<{ id: string }>(await supabase.from("photoshoots").insert({ category: shoot.category, title: `${title} — split`, status: "draft", sort_order: shoots.filter((s) => s.category === shoot.category).length }).select("id").single()).id;
    }
    const start = links.filter((l) => l.photoshoot_id === to).length;
    const ids = ordered.filter((m) => picked.has(m.id)).map((m) => m.id);
    check(await supabase.from("photoshoot_images").delete().eq("photoshoot_id", shoot.id).in("media_id", ids));
    check(await supabase.from("photoshoot_images").upsert(ids.map((media_id, i) => ({ photoshoot_id: to, media_id, position: start + i }))));
    setPicked(new Set());
    if (target === "new") onSelect(to);
  }, "Photos moved");

  const duplicate = () => act(async () => {
    const copy = check<{ id: string }>(await supabase.from("photoshoots").insert({ category: shoot.category, title: `${shoot.title} (copy)`, album: shoot.album, cover_media_id: shoot.cover_media_id, status: "draft", sort_order: shoots.filter((s) => s.category === shoot.category).length }).select("id").single());
    if (ordered.length) check(await supabase.from("photoshoot_images").insert(ordered.map((m, position) => ({ photoshoot_id: copy.id, media_id: m.id, position }))));
    onSelect(copy.id);
  }, "Duplicated as draft");

  const remove = () => act(async () => {
    check(await supabase.from("photoshoots").delete().eq("id", shoot.id));
    onSelect(null);
  }, "Photoshoot deleted — its photos are in the library");

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="min-w-0">
      <button onClick={onClose} className="meta mb-4 text-muted-foreground hover:text-paper lg:hidden">← All photoshoots</button>
      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <div className="space-y-3">
          <div className="flex items-center gap-3"><StatusPill status={shoot.status} /><span className="meta text-muted-foreground">{ordered.length} frames</span></div>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
          <input className={input} value={album} onChange={(e) => setAlbum(e.target.value)} placeholder="Original album (optional)" aria-label="Original album" />
          <select className={cn(input, "appearance-none")} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            {photoCats.map((c) => <option key={c.slug} value={c.slug} className="bg-background">{c.title}</option>)}
          </select>
          <div className="flex flex-wrap gap-2 pt-2">
            <button className={btn} disabled={busy || !dirty} onClick={() => save()}>Save draft</button>
            <button className={btn} disabled={!ordered.length} onClick={preview}>Preview</button>
            {shoot.status === "published"
              ? <button className={btn} disabled={busy} onClick={() => save("draft")}>Unpublish</button>
              : <button className={btnPrimary} disabled={busy || !ordered.length} onClick={() => save("published")}>Publish</button>}
            <button className={btn} disabled={busy} onClick={duplicate}>Duplicate</button>
            <button className={cn(btn, "text-destructive hover:border-destructive")} disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        </div>
        {viewerOrder[0] && (
          <div className="mx-auto w-full max-w-64">
            <p className="meta mb-3 text-muted-foreground">Public preview</p>
            <SessionStack n={0} s={{
              id: shoot.id, category: shoot.category, album: shoot.album ?? title, title,
              cover: toPhoto(viewerOrder[0], title), images: viewerOrder.map((m) => toPhoto(m, title)), count: viewerOrder.length,
            }} />
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2">
        <label className={cn(btnPrimary, "cursor-pointer")}>
          + Upload photos
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
        {ordered.length > 0 && (
          <button className={btn} onClick={() => setPicked(picked.size === ordered.length ? new Set() : new Set(ordered.map((m) => m.id)))}>
            {picked.size === ordered.length ? "Clear selection" : "Select all"}
          </button>
        )}
        {picked.size > 0 && (
          <>
            <span className="meta text-muted-foreground">{picked.size} selected</span>
            <MoveSelect shoots={shoots.filter((s) => s.id !== shoot.id)} onPick={moveSel} label="Move to…" allowNew />
            <button className={btn} onClick={removeSel}>Remove</button>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Drag photos to reorder. Tap a photo to select it.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
        <SortableContext items={ordered.map((m) => m.id)} strategy={rectSortingStrategy}>
          <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
            {ordered.map((m, i) => (
              <SortableThumb key={m.id} id={m.id}>
                <Thumb m={m} picked={picked.has(m.id)} onToggle={() => toggle(m.id)} index={i + 1} cover={m.id === coverId}
                  onCover={() => act(async () => check(await supabase.from("photoshoots").update({ cover_media_id: m.id }).eq("id", shoot.id)), "Cover updated")} />
              </SortableThumb>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{shoot.title}”?</AlertDialogTitle>
            <AlertDialogDescription>The photoshoot is removed from the site. Its {ordered.length} photos stay in the media library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

const toPhoto = (m: Media, project: string) => ({ sm: m.sm, src: m.src, full: m.full_src, w: m.w, h: m.h, project });

function SortableThumb({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn("touch-manipulation", isDragging && "relative z-10 opacity-80")} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function Thumb({ m, picked, onToggle, index, cover, onCover, note }: {
  m: Media; picked: boolean; onToggle: () => void; index?: number; cover?: boolean; onCover?: () => void; note?: string;
}) {
  return (
    <div className={cn("group relative aspect-square overflow-hidden rounded-lg bg-charcoal ring-2 transition", picked ? "ring-paper" : "ring-transparent")}>
      <button type="button" onClick={onToggle} aria-pressed={picked} aria-label={picked ? "Deselect photo" : "Select photo"} className="absolute inset-0">
        <img src={m.sm} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </button>
      <div className="pointer-events-none absolute inset-x-1 top-1 flex justify-between">
        {index !== undefined && <span className="meta rounded-full bg-viewer/70 px-1.5 text-[0.55rem] text-paper">{String(index).padStart(2, "0")}</span>}
        {cover && <span className="meta rounded-full bg-paper px-1.5 text-[0.55rem] text-ink">Cover</span>}
      </div>
      {onCover && !cover && (
        <button type="button" onClick={onCover} className="meta absolute inset-x-1 bottom-1 rounded-full bg-viewer/75 py-1 text-[0.55rem] text-paper opacity-100 md:opacity-0 md:group-hover:opacity-100">Set cover</button>
      )}
      {note && <span className="meta pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-full bg-viewer/75 px-1.5 text-[0.55rem] text-paper/80">{note}</span>}
    </div>
  );
}

function MoveSelect({ shoots, onPick, label, allowNew }: { shoots: Shoot[]; onPick: (id: string) => void; label: string; allowNew?: boolean }) {
  return (
    <select
      className="meta rounded-full border border-border bg-background px-4 py-2 text-paper"
      value=""
      onChange={(e) => e.target.value && onPick(e.target.value)}
      aria-label={label}
    >
      <option value="">{label}</option>
      {allowNew && <option value="new">New photoshoot</option>}
      {photoCats.map((c) => (
        <optgroup key={c.slug} label={c.title}>
          {shoots.filter((s) => s.category === c.slug).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/* ---------------- Media library ---------------- */

function LibraryTab({ shoots, links, media, refresh }: { shoots: Shoot[]; links: Link_[]; media: Media[]; refresh: () => void }) {
  const [filter, setFilter] = useState("unassigned");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const linked = useMemo(() => {
    const map = new Map<string, string[]>();
    links.forEach((l) => map.set(l.media_id, [...(map.get(l.media_id) ?? []), l.photoshoot_id]));
    return map;
  }, [links]);
  const shootById = new Map(shoots.map((s) => [s.id, s]));

  const shown = media.filter((m) => {
    const ids = linked.get(m.id) ?? [];
    if (filter === "all") return true;
    if (filter === "unassigned") return ids.length === 0;
    if (filter.startsWith("cat:")) return ids.some((id) => shootById.get(id)?.category === filter.slice(4)) || (ids.length === 0 && m.origin_category === filter.slice(4));
    return ids.includes(filter);
  });

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setPicked(new Set()); } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
    refresh();
  };

  const addTo = (target: string) => act(async () => {
    let to = target;
    if (target === "new") {
      const first = media.find((m) => picked.has(m.id));
      const category = first?.origin_category ?? photoCats[0]!.slug;
      const r = await supabase.from("photoshoots").insert({ category, title: first?.album ?? "Untitled session", album: first?.album ?? null, status: "draft", sort_order: shoots.filter((s) => s.category === category).length }).select("id").single();
      if (r.error) throw r.error;
      to = r.data.id;
    }
    const start = links.filter((l) => l.photoshoot_id === to).length;
    const r = await supabase.from("photoshoot_images").upsert([...picked].map((media_id, i) => ({ photoshoot_id: to, media_id, position: start + i })));
    if (r.error) throw r.error;
  }, "Added to photoshoot");

  const del = () => act(async () => {
    const rows = media.filter((m) => picked.has(m.id));
    const paths = rows.map((m) => m.storage_path).filter((p): p is string => !!p);
    if (paths.length) await supabase.storage.from("portfolio").remove(paths);
    const r = await supabase.from("media").delete().in("id", rows.map((m) => m.id));
    if (r.error) throw r.error;
  }, "Deleted permanently");

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    uploadFiles([...files]).then(() => toast.success("Uploaded to unassigned photos")).catch((e) => toast.error(e.message)).finally(() => { setBusy(false); refresh(); });
  };

  const pickedAssigned = [...picked].some((id) => (linked.get(id) ?? []).length > 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select className="meta rounded-full border border-border bg-background px-4 py-2 text-paper" value={filter} onChange={(e) => { setFilter(e.target.value); setPicked(new Set()); }} aria-label="Filter">
          <option value="unassigned">Unassigned photos</option>
          <option value="all">All photos</option>
          <optgroup label="Category">{photoCats.map((c) => <option key={c.slug} value={`cat:${c.slug}`}>{c.title}</option>)}</optgroup>
          {photoCats.map((c) => (
            <optgroup key={c.slug} label={`Photoshoot — ${c.title}`}>
              {shoots.filter((s) => s.category === c.slug).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </optgroup>
          ))}
        </select>
        <label className={cn(btnPrimary, "cursor-pointer", busy && "opacity-50")}>
          + Upload
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
        <span className="meta text-muted-foreground">{shown.length} photos</span>
        {shown.length > 0 && <button className={btn} onClick={() => setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((m) => m.id)))}>{picked.size === shown.length ? "Clear" : "Select all"}</button>}
        {picked.size > 0 && (
          <>
            <span className="meta text-muted-foreground">{picked.size} selected</span>
            <MoveSelect shoots={shoots} onPick={addTo} label="Add to photoshoot…" allowNew />
            {!pickedAssigned && <button className={cn(btn, "text-destructive")} disabled={busy} onClick={() => setConfirm(true)}>Delete</button>}
          </>
        )}
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing here.</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-9">
        {shown.map((m) => {
          const ids = linked.get(m.id) ?? [];
          const note = ids.length ? ids.map((id) => shootById.get(id)?.title).join(", ") : (m.album ?? undefined);
          return <Thumb key={m.id} m={m} picked={picked.has(m.id)} onToggle={() => setPicked((p) => { const n = new Set(p); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} {...(note ? { note } : {})} />;
        })}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {picked.size} photo{picked.size > 1 ? "s" : ""} permanently?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------- Homepage hero & About ---------------- */

const toImg = (m: Media): HomeImage => ({ src: m.src, w: m.w, h: m.h });

function HomeTab({ media, refresh }: { media: Media[]; refresh: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "home"],
    queryFn: async () => (await supabase.from("site_settings").select("hero_slides, about_image").eq("id", 1).maybeSingle()).data,
  });
  const [slides, setSlides] = useState<HomeImage[] | null>(null);
  const [about, setAbout] = useState<HomeImage | null>(null);
  const [sel, setSel] = useState<"about" | number>(0);
  const [picker, setPicker] = useState<"hero" | "about" | null>(null);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  if (q.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  const savedHero = Array.isArray(q.data?.hero_slides) && q.data.hero_slides.length ? (q.data.hero_slides as unknown as HomeImage[]) : defaultHero;
  const savedAbout = (q.data?.about_image as unknown as HomeImage | null) ?? defaultAbout;
  const list = slides ?? savedHero;
  const portrait = about ?? savedAbout;
  const dirty = slides !== null || about !== null;
  const ids = list.map((s, i) => `${i}|${s.src}`);
  const current = sel === "about" ? portrait : list[Math.min(sel, list.length - 1)];

  const setPos = (pos: string) => {
    if (sel === "about") setAbout({ ...portrait, pos });
    else setSlides(list.map((s, i) => (i === sel ? { ...s, pos } : s)));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id)), to = ids.indexOf(String(e.over.id));
    setSlides(arrayMove(list, from, to)); setSel(to);
  };
  const add = (imgs: HomeImage[]) => {
    if (picker === "about") { setAbout(imgs[0]!); setSel("about"); }
    else { setSlides([...list, ...imgs]); setSel(list.length); }
    setPicker(null);
  };
  const upload = (files: FileList | null, target: "hero" | "about") => {
    if (!files?.length) return;
    setBusy(true);
    uploadFiles(target === "about" ? [files[0]!] : [...files])
      .then((rows) => { const imgs = rows.map(toImg); if (target === "about") { setAbout(imgs[0]!); setSel("about"); } else { setSlides([...list, ...imgs]); setSel(list.length); } refresh(); toast.success("Uploaded — remember to save"); })
      .catch((e) => toast.error(e.message)).finally(() => setBusy(false));
  };
  const save = async () => {
    if (!list.length) { toast.error("Add at least one hero photo"); return; }
    setBusy(true);
    const { error } = await supabase.from("site_settings").upsert({ id: 1, hero_slides: list as never, about_image: portrait as never, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Homepage published");
    setSlides(null); setAbout(null);
    qc.invalidateQueries({ queryKey: ["admin", "home"] });
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save & publish"}</button>
        {dirty && <button className={btn} onClick={() => { setSlides(null); setAbout(null); }}>Discard changes</button>}
        <Link to="/" target="_blank" className={btn}>Open homepage</Link>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="display text-3xl text-paper">Homepage hero</h2>
          <span className="meta text-muted-foreground">{list.length} slides · drag to reorder · first is shown first</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
              {list.map((s, i) => (
                <SortableThumb key={ids[i]} id={ids[i]!}>
                  <div className={cn("relative aspect-square overflow-hidden rounded-lg bg-charcoal ring-2", sel === i ? "ring-paper" : "ring-transparent")}>
                    <button type="button" onClick={() => setSel(i)} className="absolute inset-0" aria-label={`Edit slide ${i + 1}`}>
                      <img src={s.src} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: s.pos }} />
                    </button>
                    <span className="meta pointer-events-none absolute left-1 top-1 rounded-full bg-viewer/70 px-1.5 text-[0.55rem] text-paper">{i === 0 ? "First" : String(i + 1).padStart(2, "0")}</span>
                    <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                      {i > 0 && <button type="button" onClick={() => { setSlides([s, ...list.filter((_, k) => k !== i)]); setSel(0); }} className="meta rounded-full bg-viewer/75 px-1.5 py-0.5 text-[0.55rem] text-paper">Make first</button>}
                      <button type="button" onClick={() => { setSlides(list.filter((_, k) => k !== i)); setSel(0); }} className="meta ml-auto rounded-full bg-viewer/75 px-1.5 py-0.5 text-[0.55rem] text-paper" aria-label="Remove slide">✕</button>
                    </div>
                  </div>
                </SortableThumb>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className={cn(btn, "cursor-pointer", busy && "opacity-50")}>+ Upload<input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files, "hero"); e.target.value = ""; }} /></label>
          <button className={btn} onClick={() => setPicker("hero")}>Add from library</button>
        </div>
      </section>

      <section>
        <h2 className="display mb-4 text-3xl text-paper">About section photo</h2>
        <div className="flex flex-wrap items-end gap-3">
          <button type="button" onClick={() => setSel("about")} className={cn("w-28 overflow-hidden rounded-lg ring-2", sel === "about" ? "ring-paper" : "ring-transparent")}>
            <img src={portrait.src} alt="About" className="aspect-[4/5] w-full object-cover" style={{ objectPosition: portrait.pos }} />
          </button>
          <label className={cn(btn, "cursor-pointer", busy && "opacity-50")}>Upload new<input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files, "about"); e.target.value = ""; }} /></label>
          <button className={btn} onClick={() => setPicker("about")}>Choose from library</button>
        </div>
      </section>

      {current && (
        <section>
          <h2 className="meta mb-2 text-muted-foreground">Focal point — {sel === "about" ? "About photo" : `slide ${(sel as number) + 1}`}</h2>
          <p className="mb-4 text-sm text-muted-foreground">Tap the subject in the photo. Previews show phone and desktop crops.</p>
          <FocalEditor img={current} onPick={setPos} about={sel === "about"} />
        </section>
      )}

      {picker && <LibraryPicker media={media} single={picker === "about"} onPick={add} onClose={() => setPicker(null)} />}
    </div>
  );
}

function FocalEditor({ img, onPick, about }: { img: HomeImage; onPick: (pos: string) => void; about: boolean }) {
  const pos = img.pos ?? "50% 50%";
  const [x, y] = pos.split(" ").map((v) => parseFloat(v));
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="relative w-full max-w-md cursor-crosshair select-none" onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = Math.round(((e.clientX - r.left) / r.width) * 100), py = Math.round(((e.clientY - r.top) / r.height) * 100);
        onPick(`${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%`);
      }}>
        <img src={img.src} alt="" className="block w-full rounded-lg" draggable={false} />
        <span className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper shadow" style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
      <div className="flex items-end gap-4">
        <figure>
          <div className={cn("overflow-hidden rounded-md bg-charcoal", about ? "aspect-[4/5] w-28" : "aspect-[9/19] w-24")}>
            <img src={img.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: pos }} />
          </div>
          <figcaption className="meta mt-1 text-[0.55rem] text-muted-foreground">Phone</figcaption>
        </figure>
        <figure>
          <div className={cn("overflow-hidden rounded-md bg-charcoal", about ? "aspect-[4/5] w-40" : "aspect-[16/9] w-64")}>
            <img src={img.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: pos }} />
          </div>
          <figcaption className="meta mt-1 text-[0.55rem] text-muted-foreground">Desktop</figcaption>
        </figure>
      </div>
    </div>
  );
}

function LibraryPicker({ media, single, onPick, onClose }: { media: Media[]; single: boolean; onPick: (imgs: HomeImage[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 md:p-10" role="dialog" aria-label="Choose photos">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 bg-background/90 py-2">
        <span className="meta text-muted-foreground">{single ? "Choose one photo" : `${picked.length} selected`}</span>
        <button className={btnPrimary} disabled={!picked.length} onClick={() => onPick(picked.map((id) => toImg(media.find((m) => m.id === id)!)))}>Add</button>
        <button className={btn} onClick={onClose}>Cancel</button>
      </div>
      {media.length === 0 && <p className="text-sm text-muted-foreground">The media library is empty — upload instead.</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
        {media.map((m) => (
          <Thumb key={m.id} m={m} picked={picked.includes(m.id)} onToggle={() => setPicked((p) => single ? [m.id] : p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])} />
        ))}
      </div>
    </div>
  );
}
