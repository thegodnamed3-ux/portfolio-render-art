import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { importWfolio } from "@/lib/portfolio.functions";
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
type Shoot = { id: string; category: string; title: string; album: string | null; cover_media_id: string | null; status: string; sort_order: number };
type Link_ = { photoshoot_id: string; media_id: string; position: number };

const photoCats = categories.filter((c) => !c.external && c.videos.length === 0);
const catTitle = (slug: string) => categories.find((c) => c.slug === slug)?.title ?? slug;

const btn = "meta inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40";
const btnPrimary = "meta inline-flex items-center justify-center gap-2 rounded-full bg-paper px-4 py-2 text-ink transition-opacity hover:opacity-90 disabled:opacity-40";
const input = "w-full rounded-full border border-border bg-transparent px-4 py-2.5 text-sm text-paper outline-none focus:border-paper/60";

function useData() {
  return useQuery({
    queryKey: ["admin", "portfolio"],
    queryFn: async () => {
      const [m, s, l] = await Promise.all([
        supabase.from("media").select("*").order("created_at"),
        supabase.from("photoshoots").select("*").order("sort_order"),
        supabase.from("photoshoot_images").select("*").order("position"),
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
  const [tab, setTab] = useState<"shoots" | "library">("shoots");
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
          {(["shoots", "library"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("meta rounded-full px-4 py-2", tab === t ? "bg-paper text-ink" : "text-paper/75")}>
              {t === "shoots" ? "Photoshoots" : "Media library"}
            </button>
          ))}
        </div>
        {!hasImport && (
          <button className={btnPrimary} disabled={imp.isPending} onClick={() => imp.mutate()}>
            {imp.isPending ? "Importing…" : "Import original Wfolio photos"}
          </button>
        )}
      </div>

      {tab === "shoots" ? (
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
    if (error) return toast.error(error.message);
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
