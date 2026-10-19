import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, BarChart3, Images, Inbox, Layers, LayoutTemplate, LogOut, MessageSquareQuote, Send, Settings2, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { discoverWfolioAlbums, importWfolioAlbum, IMPORT_BATCH, type AlbumResult } from "@/lib/wfolio-import.functions";
import { importWfolio, type HomeImage } from "@/lib/portfolio.functions";
import { migrateWfolioMedia, migrateWfolioSettings, wfolioMigrationStatus } from "@/lib/wfolio-migrate.functions";
import { defaultHero, defaultAbout, defaultWork, defaultWorkColumns, type WorkItem } from "@/content/home";
import { WorkGrid } from "@/components/WorkGrid";
import { Spotlight } from "@/components/Spotlight";
import { useLightbox } from "@/components/Lightbox";
import { SessionStack } from "@/components/Gallery";
import { categories } from "@/content/categories";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DeliveriesTab, createDeliveryFromFiles } from "@/components/admin/DeliveriesTab";
import { ZipWriter } from "@/lib/zip";
import { ReviewsTab } from "@/components/admin/ReviewsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";

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

type Media = { id: string; sm: string; src: string; full_src: string; w: number; h: number; album: string | null; origin_category: string | null; storage_path: string | null; created_at?: string; tags?: string[] };
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
    <main className="min-h-[100svh] pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-4 md:px-10">
          <div className="flex items-center gap-3">
            <Link to="/" className="wordmark text-paper transition-opacity hover:opacity-70">thegodnamed</Link>
            <span className="meta rounded-full border border-border px-2.5 py-1 text-[0.5625rem] text-muted-foreground">Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer" className={cn(btn, "hidden sm:inline-flex")}>View site <ArrowUpRight className="size-3.5" strokeWidth={1.5} /></a>
            <button onClick={onSignOut} className={btn} aria-label="Sign out"><LogOut className="size-3.5" strokeWidth={1.5} /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[90rem] px-4 pt-6 md:px-10 md:pt-10">{children}</div>
    </main>
  );
}

type Tab = "shoots" | "library" | "home" | "review" | "clients" | "reviews" | "analytics" | "settings";
const NAV: { group: string; items: { id: Tab; label: string; hint: string; Icon: LucideIcon }[] }[] = [
  {
    group: "Website",
    items: [
      { id: "shoots", label: "Photoshoots", hint: "The stacks shown in each discipline — order, covers, publishing.", Icon: Layers },
      { id: "home", label: "Homepage", hint: "Hero slides, the About portrait and Selected works.", Icon: LayoutTemplate },
      { id: "library", label: "Media library", hint: "Every photo uploaded to the site.", Icon: Images },
      { id: "review", label: "Import review", hint: "Albums brought over from Wfolio, waiting for a decision.", Icon: Inbox },
    ],
  },
  {
    group: "Clients",
    items: [
      { id: "clients", label: "Client delivery", hint: "Private galleries: upload, share the link, see picks and activity.", Icon: Send },
      { id: "reviews", label: "Reviews", hint: "Approve, edit or hide what clients wrote.", Icon: MessageSquareQuote },
    ],
  },
  {
    group: "Studio",
    items: [
      { id: "analytics", label: "Analytics", hint: "Who visits the website and where they come from — without cookies.", Icon: BarChart3 },
      { id: "settings", label: "Settings", hint: "Contact links used across the site.", Icon: Settings2 },
    ],
  },
];
const ALL_TABS = NAV.flatMap((g) => g.items);

function usePendingReviews() {
  return useQuery({
    queryKey: ["admin", "reviews-pending"],
    queryFn: async () => {
      const { count, error } = await supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending");
      return error ? 0 : (count ?? 0);
    },
    refetchInterval: 60_000,
  });
}

function Studio() {
  const q = useData();
  const qc = useQueryClient();
  const runImport = useServerFn(importWfolio);
  const [tab, setTabState] = useState<Tab>("shoots");
  const [cat, setCat] = useState(photoCats[0]!.slug);
  const [selected, setSelected] = useState<string | null>(null);
  const pendingReviews = usePendingReviews();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "portfolio"] });

  // Remember the open section between visits.
  useEffect(() => {
    try { const t = localStorage.getItem("studio-tab") as Tab | null; if (t && ALL_TABS.some((x) => x.id === t)) setTabState(t); } catch { /* ignore */ }
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem("studio-tab", t); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  };

  const imp = useMutation({
    mutationFn: () => runImport(),
    onSuccess: (r) => { toast.success(r.skipped ? "Already imported" : `Imported ${r.imported} photos into ${r.sessions} draft photoshoots`); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Could not load the portfolio.</p>;
  const { media, shoots, links } = q.data;
  const hasImport = media.some((m) => m.origin_category);
  const badges: Partial<Record<Tab, number>> = {
    reviews: pendingReviews.data ?? 0,
    review: shoots.filter((s) => s.import_batch && (s.review_status ?? "pending") === "pending").length,
  };
  const current = ALL_TABS.find((t) => t.id === tab)!;

  const Badge = ({ n, active }: { n?: number; active?: boolean }) =>
    n ? <span className={cn("ml-auto min-w-5 rounded-full px-1.5 text-center text-[0.625rem] font-medium leading-5", active ? "bg-ink/10 text-ink" : "bg-paper/15 text-paper")}>{n}</span> : null;

  return (
    <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Studio sections" className="sticky top-24 hidden self-start lg:block">
        {NAV.map((g) => (
          <div key={g.group} className="mb-7">
            <p className="meta mb-2 px-3 text-[0.5625rem] text-muted-foreground/70">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ id, label, Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => setTab(id)}
                    aria-current={tab === id ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
                      tab === id ? "bg-paper text-ink" : "text-paper/70 hover:bg-paper/[0.06] hover:text-paper",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                    {label}
                    <Badge n={badges[id] ?? 0} active={tab === id} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        <div className="glass inline-flex gap-1 rounded-full p-1">
          {ALL_TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={cn("meta inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2", tab === id ? "bg-paper text-ink" : "text-paper/75")}>
              <Icon className="size-3.5" strokeWidth={1.5} />
              {label}
              {badges[id] ? <span className="rounded-full bg-current/15 px-1.5 text-[0.55rem]">{badges[id]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <section className="min-w-0">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6 md:mb-10">
          <div>
            <h1 className="display text-4xl text-paper md:text-5xl">{current.label}.</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{current.hint}</p>
          </div>
          {!hasImport && tab === "library" && (
            <button className={btnPrimary} disabled={imp.isPending} onClick={() => imp.mutate()}>
              {imp.isPending ? "Importing…" : "Import original Wfolio photos"}
            </button>
          )}
        </header>

        {tab === "settings" ? (
          <WhatsAppSetting />
        ) : tab === "analytics" ? (
          <AnalyticsTab />
        ) : tab === "clients" ? (
          <DeliveriesTab />
        ) : tab === "reviews" ? (
          <ReviewsTab />
        ) : tab === "review" ? (
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
      </section>
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
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex max-w-2xl flex-wrap items-center gap-3 rounded-3xl border border-border/60 bg-card/30 p-5">
      <label htmlFor="wa" className="meta w-full text-muted-foreground">WhatsApp link</label>
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
        <div className="rounded-3xl border border-border/60 bg-card/30 p-5 text-sm text-paper/80">
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
  const [sort, setSort] = useState<"new" | "old" | "large" | "project">("new");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [dropping, setDropping] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const allTags = useMemo(() => [...new Set(media.flatMap((m) => m.tags ?? []))].sort((a, b) => a.localeCompare(b)), [media]);
  const shootTitle = (m: Media) => (linked.get(m.id) ?? []).map((id) => shootById.get(id)?.title ?? "").filter(Boolean)[0];
  const q = query.trim().toLowerCase();

  const shown = media.filter((m) => {
    const ids = linked.get(m.id) ?? [];
    if (q && !`${m.album ?? ""} ${(m.tags ?? []).join(" ")} ${ids.map((id) => shootById.get(id)?.title ?? "").join(" ")}`.toLowerCase().includes(q)) return false;
    if (filter.startsWith("tag:")) return (m.tags ?? []).includes(filter.slice(4));
    if (filter === "all") return true;
    if (filter === "unassigned") return ids.length === 0;
    if (filter.startsWith("cat:")) return ids.some((id) => shootById.get(id)?.category === filter.slice(4)) || (ids.length === 0 && m.origin_category === filter.slice(4));
    return ids.includes(filter);
  }).sort((a, b) => sort === "old" ? (a.created_at ?? "").localeCompare(b.created_at ?? "")
    : sort === "large" ? b.w * b.h - a.w * a.h
    : sort === "project" ? (shootTitle(a) ?? "\uffff").localeCompare(shootTitle(b) ?? "\uffff")
    : (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const pickedList = media.filter((m) => picked.has(m.id));
  const fileName = (m: Media, i: number) => `${(shootTitle(m) || m.album || "photo").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 70)} ${String(i + 1).padStart(3, "0")}.jpg`;
  const original = async (m: Media) => {
    if (m.storage_path) { const r = await supabase.storage.from("portfolio").download(m.storage_path); if (!r.error && r.data) return r.data; }
    const res = await fetch(m.full_src || m.src);
    if (!res.ok) throw new Error("Could not download a photo");
    return res.blob();
  };
  const save = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); };
  const download = async (items: Media[]) => {
    if (!items.length) return;
    try {
      if (items.length === 1) { save(await original(items[0]!), fileName(items[0]!, 0)); return; }
      const parts: BlobPart[] = [];
      const zip = new ZipWriter(async (c) => { parts.push(c as BlobPart); });
      for (let i = 0; i < items.length; i++) { setProgress(`Preparing ${i + 1} / ${items.length}…`); await zip.add(fileName(items[i]!, i), new Uint8Array(await (await original(items[i]!)).arrayBuffer())); }
      await zip.finish();
      save(new Blob(parts, { type: "application/zip" }), `thegodnamed (${items.length}).zip`);
      toast.success(`${items.length} photos downloaded`);
    } catch (e) { toast.error((e as Error).message); } finally { setProgress(null); }
  };
  const label = (add: boolean) => act(async () => {
    const name = tag.trim().slice(0, 60);
    if (!name) return;
    for (const m of pickedList) {
      const cur = m.tags ?? [];
      const next = add ? [...new Set([...cur, name])] : cur.filter((x) => x !== name);
      const r = await supabase.from("media").update({ tags: next } as never).eq("id", m.id);
      if (r.error) throw new Error("Labels need migration 0024_media_tags — apply it in Lovable first.");
    }
  }, add ? `Labelled “${tag.trim()}”` : `Removed “${tag.trim()}”`);
  const sendToClient = async () => {
    try {
      const files: File[] = [];
      for (let i = 0; i < pickedList.length; i++) { setProgress(`Preparing ${i + 1} / ${pickedList.length}…`); const b = await original(pickedList[i]!); files.push(new File([b], fileName(pickedList[i]!, i), { type: b.type || "image/jpeg" })); }
      const r = await createDeliveryFromFiles(`Selection — ${new Date().toLocaleDateString()}`, files, (n) => setProgress(`Sending ${n} / ${files.length}…`));
      setSent(r.link);
      try { await navigator.clipboard.writeText(r.link); toast.success("Client link created and copied"); } catch { toast.success("Client link created"); }
      if (r.failed) toast.error(`${r.failed} photo(s) could not be added`);
      setPicked(new Set());
    } catch (e) { toast.error((e as Error).message); } finally { setProgress(null); }
  };

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
      <WfolioMigration refresh={refresh} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <select className="meta rounded-full border border-border bg-background px-4 py-2 text-paper" value={filter} onChange={(e) => { setFilter(e.target.value); setPicked(new Set()); }} aria-label="Filter">
          <option value="unassigned">Unassigned photos</option>
          <option value="all">All photos</option>
          {allTags.length > 0 && <optgroup label="Labels">{allTags.map((t) => <option key={t} value={`tag:${t}`}>{t}</option>)}</optgroup>}
          <optgroup label="Category">{photoCats.map((c) => <option key={c.slug} value={`cat:${c.slug}`}>{c.title}</option>)}</optgroup>
          {photoCats.map((c) => (
            <optgroup key={c.slug} label={`Photoshoot — ${c.title}`}>
              {shoots.filter((s) => s.category === c.slug).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </optgroup>
          ))}
        </select>
        <select className="meta rounded-full border border-border bg-background px-4 py-2 text-paper" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="new">Newest first</option><option value="old">Oldest first</option><option value="large">Largest first</option><option value="project">By photoshoot</option>
        </select>
        <input className="meta w-48 rounded-full border border-border bg-transparent px-4 py-2 text-paper outline-none" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        <label className={cn(btnPrimary, "cursor-pointer", busy && "opacity-50")}>
          + Upload
          <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
        <span className="meta text-muted-foreground">{progress ?? `${shown.length} photos · drag photos here to upload`}</span>
        {shown.length > 0 && !progress && <button className={btn} onClick={() => download(shown)}>Download {shown.length === media.length ? "all" : "these"} ({shown.length})</button>}
        {shown.length > 0 && <button className={btn} onClick={() => setPicked(picked.size === shown.length ? new Set() : new Set(shown.map((m) => m.id)))}>{picked.size === shown.length ? "Clear" : "Select all"}</button>}
        {picked.size > 0 && (
          <>
            <span className="meta text-muted-foreground">{picked.size} selected</span>
            <MoveSelect shoots={shoots} onPick={addTo} label="Add to photoshoot…" allowNew />
            <button className={btnPrimary} disabled={!!progress} onClick={() => download(pickedList)}>Download</button>
            <button className={btn} disabled={!!progress} onClick={sendToClient}>Send to client</button>
            <input className="meta w-40 rounded-full border border-border bg-transparent px-4 py-2 text-paper outline-none" list="lib-tags" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Label" maxLength={60} />
            <datalist id="lib-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
            <button className={btn} disabled={!tag.trim() || busy} onClick={() => label(true)}>Label</button>
            <button className={btn} disabled={!tag.trim() || busy} onClick={() => label(false)}>Unlabel</button>
            {!pickedAssigned && <button className={cn(btn, "text-destructive")} disabled={busy} onClick={() => setConfirm(true)}>Delete</button>}
          </>
        )}
      </div>
      {sent && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm"><span>Client link:</span><a className="underline" href={sent} target="_blank" rel="noreferrer">{sent}</a><span className="meta text-muted-foreground">password & expiry — in Clients</span><button className={btn} onClick={() => setSent(null)}>Close</button></div>}
      <div
        className={cn("relative min-h-40 rounded-2xl outline-2 outline-offset-4 transition", dropping ? "outline-dashed outline-paper/70 bg-paper/5" : "outline-transparent")}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDropping(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false); }}
        onDrop={(e) => { e.preventDefault(); setDropping(false); upload(e.dataTransfer.files); }}
      >
      {dropping && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-viewer/70 text-sm text-paper">Drop photos to upload</div>}
      {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing here — drag photos from your computer onto this area, or press Upload.</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-9">
        {shown.map((m) => {
          const ids = linked.get(m.id) ?? [];
          const note = ids.length ? ids.map((id) => shootById.get(id)?.title).join(", ") : (m.album ?? undefined);
          const tags = (m.tags ?? []).join(" · ");
          const full = [note, tags].filter(Boolean).join(" · ");
          return <Thumb key={m.id} m={m} picked={picked.has(m.id)} onToggle={() => setPicked((p) => { const n = new Set(p); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} {...(full ? { note: full } : {})} />;
        })}
      </div>
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

const toImg = (m: Media): HomeImage => ({ src: m.src, w: m.w, h: m.h, ...(m.sm && m.sm !== m.src ? { sm: m.sm } : {}) });

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

      <SpotlightEditor media={media} refresh={refresh} />
      <WorkEditor media={media} refresh={refresh} />
    </div>
  );
}

/* ---------------- Homepage "Selected works" ---------------- */

/** Top of Selected works: the large photo with thumbnails (desktop) / sideways strip (phones). */
function SpotlightEditor({ media, refresh }: { media: Media[]; refresh: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "spotlight"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("featured_spotlight").eq("id", 1).maybeSingle();
      if (error) return { missing: true as const, list: [] as WorkItem[] };
      return { missing: false as const, list: (Array.isArray(data?.featured_spotlight) ? data.featured_spotlight : []) as unknown as WorkItem[] };
    },
  });
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [sel, setSel] = useState(0);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  if (q.isLoading) return null;
  if (q.data?.missing) {
    return (
      <section className="space-y-3 border-t border-border pt-10">
        <h2 className="display text-3xl text-paper">Selected works — spotlight</h2>
        <p className="text-sm text-muted-foreground">Apply the database update <code>0023_featured_spotlight.sql</code> in Lovable to turn this on.</p>
      </section>
    );
  }
  const list = items ?? q.data?.list ?? [];
  const dirty = items !== null;
  const ids = list.map((w, i) => `sp|${i}|${w.src}`);
  const current = list[Math.min(sel, list.length - 1)];

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id)), to = ids.indexOf(String(e.over.id));
    setItems(arrayMove(list, from, to)); setSel(to);
  };
  const add = (imgs: HomeImage[]) => { setItems([...list, ...imgs]); setSel(list.length); setPicker(false); };
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    uploadFiles([...files])
      .then((rows) => { setItems([...list, ...rows.map(toImg)]); setSel(list.length); refresh(); toast.success("Uploaded — remember to save"); })
      .catch((e) => toast.error(e.message)).finally(() => setBusy(false));
  };
  const setCaption = (caption: string) => setItems(list.map((w, i) => (i === sel ? { ...w, caption } : w)));
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("site_settings").update({ featured_spotlight: (list.length ? list : null) as never, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(list.length ? "Spotlight published" : "Spotlight removed from the site");
    setItems(null);
    qc.invalidateQueries({ queryKey: ["admin", "spotlight"] });
  };

  return (
    <section className="space-y-6 border-t border-border pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-3xl text-paper">Selected works — spotlight</h2>
        <span className="meta text-muted-foreground">{list.length} photos · drag to reorder · shown above the grid</span>
        <button className={btnPrimary} disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save & publish"}</button>
        {dirty && <button className={btn} onClick={() => setItems(null)}>Discard changes</button>}
      </div>
      <p className="text-xs text-muted-foreground">Desktop: one large photo with thumbnails and arrows beside it. Phones: the same photos as a sideways strip. Leave empty to hide it.</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
            {list.map((w, i) => (
              <SortableThumb key={ids[i]} id={ids[i]!}>
                <div className={cn("relative aspect-square overflow-hidden rounded-lg bg-charcoal ring-2", sel === i ? "ring-paper" : "ring-transparent")}>
                  <button type="button" onClick={() => setSel(i)} className="absolute inset-0" aria-label={`Edit photo ${i + 1}`}>
                    <img src={w.sm ?? w.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                  <span className="meta pointer-events-none absolute left-1 top-1 rounded-full bg-viewer/70 px-1.5 text-[0.55rem] text-paper">{String(i + 1).padStart(2, "0")}</span>
                  <button type="button" onClick={() => { setItems(list.filter((_, k) => k !== i)); setSel(0); }} className="meta absolute bottom-1 right-1 rounded-full bg-viewer/75 px-1.5 py-0.5 text-[0.55rem] text-paper" aria-label="Remove photo">✕</button>
                </div>
              </SortableThumb>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(btn, "cursor-pointer", busy && "opacity-50")}>+ Upload<input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
        <button className={btn} onClick={() => setPicker(true)}>Add from library</button>
        {current && (
          <input className={cn(input, "max-w-xs")} value={current.caption ?? ""} onChange={(e) => setCaption(e.target.value)} placeholder={`Caption for photo ${Math.min(sel, list.length - 1) + 1}`} maxLength={60} aria-label="Caption" />
        )}
      </div>

      {list.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="meta text-muted-foreground">Live preview</span>
            <div className="glass inline-flex rounded-full p-1">
              {(["desktop", "mobile"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cn("meta rounded-full px-3 py-1", view === v ? "bg-paper text-ink" : "text-paper/75")}>{v === "desktop" ? "Desktop" : "Phone"}</button>
              ))}
            </div>
          </div>
          <div className={cn("overflow-hidden rounded-2xl border border-border bg-background p-4 md:p-6", view === "mobile" ? "w-[375px] max-w-full" : "w-full")}>
            <Spotlight items={list} force={view} />
          </div>
        </div>
      )}

      {picker && <LibraryPicker media={media} single={false} onPick={add} onClose={() => setPicker(false)} />}
    </section>
  );
}

function WorkEditor({ media, refresh }: { media: Media[]; refresh: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "work"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("featured_work, featured_columns").eq("id", 1).maybeSingle();
      if (error) throw error;
      // Separate read: works before the phone-size column exists.
      const { data: m } = await supabase.from("site_settings").select("featured_columns_mobile").eq("id", 1).maybeSingle();
      return { ...data, featured_columns_mobile: m?.featured_columns_mobile ?? null };
    },
  });
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [cols, setCols] = useState<number | null>(null);
  const [colsM, setColsM] = useState<number | null>(null);
  const [sel, setSel] = useState(0);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  if (q.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">Selected works can’t be edited yet — the database update for it hasn’t been applied.</p>;

  const saved = Array.isArray(q.data?.featured_work) && q.data.featured_work.length ? (q.data.featured_work as unknown as WorkItem[]) : defaultWork;
  const list = items ?? saved;
  const columns = cols ?? q.data?.featured_columns ?? defaultWorkColumns;
  const columnsM = colsM ?? q.data?.featured_columns_mobile ?? 2;
  const dirty = items !== null || cols !== null || colsM !== null;
  const ids = list.map((w, i) => `${i}|${w.src}`);
  const current = list[Math.min(sel, list.length - 1)];

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id)), to = ids.indexOf(String(e.over.id));
    setItems(arrayMove(list, from, to)); setSel(to);
  };
  const add = (imgs: HomeImage[]) => { setItems([...list, ...imgs]); setSel(list.length); setPicker(false); };
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    uploadFiles([...files])
      .then((rows) => { setItems([...list, ...rows.map(toImg)]); setSel(list.length); refresh(); toast.success("Uploaded — remember to save"); })
      .catch((e) => toast.error(e.message)).finally(() => setBusy(false));
  };
  const setCaption = (caption: string) => setItems(list.map((w, i) => (i === sel ? { ...w, caption } : w)));
  const save = async () => {
    if (!list.length) { toast.error("Add at least one photo"); return; }
    setBusy(true);
    const { error } = await supabase.from("site_settings").upsert({ id: 1, featured_work: list as never, featured_columns: columns, updated_at: new Date().toISOString() });
    if (error) { setBusy(false); toast.error(error.message); return; }
    if (colsM !== null) {
      const { error: e2 } = await supabase.from("site_settings").update({ featured_columns_mobile: columnsM }).eq("id", 1);
      if (e2) toast.error("Phone size needs a database update first (0021_featured_columns_mobile).");
    }
    setBusy(false);
    toast.success("Selected works published");
    setItems(null); setCols(null); setColsM(null);
    qc.invalidateQueries({ queryKey: ["admin", "work"] });
  };

  return (
    <section className="space-y-6 border-t border-border pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-3xl text-paper">Selected works</h2>
        <span className="meta text-muted-foreground">{list.length} photos · drag to reorder</span>
        <button className={btnPrimary} disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save & publish"}</button>
        {dirty && <button className={btn} onClick={() => { setItems(null); setCols(null); setColsM(null); }}>Discard changes</button>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8">
            {list.map((w, i) => (
              <SortableThumb key={ids[i]} id={ids[i]!}>
                <div className={cn("relative aspect-square overflow-hidden rounded-lg bg-charcoal ring-2", sel === i ? "ring-paper" : "ring-transparent")}>
                  <button type="button" onClick={() => setSel(i)} className="absolute inset-0" aria-label={`Edit photo ${i + 1}`}>
                    <img src={w.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                  <span className="meta pointer-events-none absolute left-1 top-1 rounded-full bg-viewer/70 px-1.5 text-[0.55rem] text-paper">{String(i + 1).padStart(2, "0")}</span>
                  <button type="button" onClick={() => { setItems(list.filter((_, k) => k !== i)); setSel(0); }} className="meta absolute bottom-1 right-1 rounded-full bg-viewer/75 px-1.5 py-0.5 text-[0.55rem] text-paper" aria-label="Remove photo">✕</button>
                </div>
              </SortableThumb>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(btn, "cursor-pointer", busy && "opacity-50")}>+ Upload<input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} /></label>
        <button className={btn} onClick={() => setPicker(true)}>Add from library</button>
        {current && (
          <input className={cn(input, "max-w-xs")} value={current.caption ?? ""} onChange={(e) => setCaption(e.target.value)} placeholder={`Caption for photo ${Math.min(sel, list.length - 1) + 1}`} maxLength={60} aria-label="Caption" />
        )}
      </div>

      {/* The slider follows the preview: desktop size, or phone size. */}
      <div className="max-w-md">
        {view === "desktop" ? (
          <>
            <label htmlFor="work-cols" className="meta mb-2 block text-muted-foreground">Size on desktop — {columns} per row</label>
            <input id="work-cols" type="range" min={2} max={6} step={1} value={columns} onChange={(e) => setCols(Number(e.target.value))} className="w-full accent-[var(--paper)]" />
            <div className="meta mt-1 flex justify-between px-1 text-[0.55rem] text-muted-foreground" aria-hidden>
              {[2, 3, 4, 5, 6].map((n) => <span key={n} className={cn("flex flex-col items-center gap-1", n === columns && "text-paper")}><span className="h-2 w-px bg-current" />{n}</span>)}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="work-cols-m" className="meta mb-2 block text-muted-foreground">Size on phones — {columnsM} per row</label>
            <input id="work-cols-m" type="range" min={1} max={3} step={1} value={columnsM} onChange={(e) => setColsM(Number(e.target.value))} className="w-full accent-[var(--paper)]" />
            <div className="meta mt-1 flex justify-between px-1 text-[0.55rem] text-muted-foreground" aria-hidden>
              {[1, 2, 3].map((n) => <span key={n} className={cn("flex flex-col items-center gap-1", n === columnsM && "text-paper")}><span className="h-2 w-px bg-current" />{n}</span>)}
            </div>
          </>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Fewer per row = bigger photos. Switch the preview to Phone to set the size on phones separately.</p>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="meta text-muted-foreground">Live preview</span>
          <div className="glass inline-flex rounded-full p-1">
            {(["desktop", "mobile"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("meta rounded-full px-3 py-1", view === v ? "bg-paper text-ink" : "text-paper/75")}>{v === "desktop" ? "Desktop" : "Phone"}</button>
            ))}
          </div>
        </div>
        <div className={cn("overflow-hidden rounded-2xl border border-border bg-background p-4 md:p-6", view === "mobile" ? "mx-0 w-[375px] max-w-full" : "w-full")}>
          <WorkGrid items={list} columns={columns} mobileColumns={columnsM} force={view} />
        </div>
      </div>

      {picker && <LibraryPicker media={media} single={false} onPick={add} onClose={() => setPicker(false)} />}
    </section>
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

/* ---------------- Move photos off Wfolio ---------------- */

function WfolioMigration({ refresh }: { refresh: () => void }) {
  const qc = useQueryClient();
  const status = useServerFn(wfolioMigrationStatus);
  const runMedia = useServerFn(migrateWfolioMedia);
  const runSettings = useServerFn(migrateWfolioSettings);
  const q = useQuery({ queryKey: ["admin", "wfolio-left"], queryFn: () => status() });
  const [run, setRun] = useState<{ done: number; total: number; failed: { id: string; error: string }[]; step: string } | null>(null);

  const start = async () => {
    const total = q.data?.media ?? 0;
    const failed: { id: string; error: string }[] = [];
    let done = 0;
    setRun({ done, total, failed, step: "Copying photos" });
    try {
      for (;;) {
        const r = await runMedia({ data: { batch: 8, skip: failed.map((f) => f.id) } });
        done += r.done;
        failed.push(...r.failed);
        setRun({ done, total, failed: [...failed], step: "Copying photos" });
        if (r.done === 0 && r.failed.length === 0) break;
        // Safety net: never run past the number that was left when we started.
        if (done + failed.length >= total + 10) break;
      }
      setRun({ done, total, failed: [...failed], step: "Homepage images" });
      await runSettings();
      toast.success(failed.length ? `Done — ${failed.length} photo(s) could not be copied` : "All photos now live in your own storage");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setRun((r) => r && { ...r, step: "Finished" });
    refresh();
    void qc.invalidateQueries({ queryKey: ["admin", "wfolio-left"] });
    void qc.invalidateQueries({ queryKey: ["admin", "home"] });
    void qc.invalidateQueries({ queryKey: ["admin", "work"] });
  };

  if (q.isLoading || q.error || !q.data) return null;
  const left = q.data.media + q.data.settings;
  const busy = !!run && run.step !== "Finished";
  if (!left && !q.data.settingsMissing && !run) return null;

  return (
    <div className="mb-8 space-y-3 rounded-3xl border border-border/60 bg-card/30 p-5">
      <p className="meta text-muted-foreground">Photos hosted on Wfolio</p>
      <p className="text-sm text-paper/80">
        {left
          ? `${q.data.media} library photos and ${q.data.settings} homepage images are still loaded from Wfolio’s servers. Copy them into your own storage before cancelling Wfolio — nothing changes on the site.`
          : "Library is moved. One last step fixes the homepage defaults."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnPrimary} disabled={busy} onClick={start}>{busy ? `${run!.step}… ${run!.done} / ${run!.total}` : "Move all photos from Wfolio"}</button>
        {run && run.total > 0 && (
          <div className="h-1 w-48 overflow-hidden rounded-full bg-paper/10">
            <span className="block h-full rounded-full bg-paper/70 transition-[width]" style={{ width: `${Math.min(100, ((run.done + run.failed.length) / Math.max(1, run.total)) * 100)}%` }} />
          </div>
        )}
      </div>
      {run && run.failed.length > 0 && (
        <p className="text-xs text-destructive">{run.failed.length} could not be copied (e.g. {run.failed[0]!.error}). Run again later to retry.</p>
      )}
    </div>
  );
}
