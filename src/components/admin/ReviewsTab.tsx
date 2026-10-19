import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { connectTelegramButtons, telegramStatus } from "@/lib/telegram.functions";
import { cn } from "@/lib/utils";

type Review = {
  id: string; name: string; body: string; rating: number | null; status: string; created_at: string; avatar_url: string | null;
  client_deliveries: { title: string } | null;
  photoshoot_id?: string | null;
};
type ShootOption = { id: string; title: string; category: string };

const btn = "meta inline-flex items-center justify-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40";
const btnPrimary = "meta inline-flex items-center justify-center gap-2 rounded-full bg-paper px-3.5 py-1.5 text-ink transition-opacity hover:opacity-90 disabled:opacity-40";
const field = "w-full rounded-2xl border border-border bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-paper/60";

const FILTERS = [
  { key: "pending", label: "New" },
  { key: "approved", label: "On the website" },
  { key: "hidden", label: "Hidden" },
] as const;

export function ReviewsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const q = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: async () => {
      // With the linked photoshoot (migration 0025); without it the list still loads.
      const withShoot = await supabase.from("reviews").select("id, name, body, rating, status, created_at, avatar_url, photoshoot_id, client_deliveries(title)").order("created_at", { ascending: false });
      if (!withShoot.error) return withShoot.data as unknown as Review[];
      const { data, error } = await supabase
        .from("reviews")
        .select("id, name, body, rating, status, created_at, avatar_url, client_deliveries(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Review[];
    },
  });
  const shoots = useQuery({
    queryKey: ["admin", "review-shoots"],
    queryFn: async () => {
      const { data } = await supabase.from("photoshoots").select("id, title, category").order("title");
      return (data ?? []) as ShootOption[];
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
    void qc.invalidateQueries({ queryKey: ["reviews", "approved"] });
  };

  if (q.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-destructive">Could not load reviews. The database update for reviews may not be applied yet.</p>;
  const all = q.data ?? [];
  const list = all.filter((r) => r.status === filter);
  const count = (k: string) => all.filter((r) => r.status === k).length;

  return (
    <div className="space-y-6">
      <TelegramPanel />
      <div className="flex flex-wrap items-center gap-3">
        <div className="glass inline-flex rounded-full p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={cn("meta rounded-full px-3 py-1.5", filter === f.key ? "bg-paper text-ink" : "text-paper/75")}>
              {f.label} {count(f.key)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Clients leave reviews from their delivery page. Approved reviews appear under “Reviews →” in the Contact block.</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => <ReviewItem key={r.id} r={r} refresh={refresh} shoots={shoots.data ?? []} />)}
      </ul>
      {!list.length && <p className="meta text-muted-foreground">Nothing here.</p>}
    </div>
  );
}

function ReviewItem({ r, refresh, shoots }: { r: Review; refresh: () => void; shoots: ShootOption[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [body, setBody] = useState(r.body);
  const [busy, setBusy] = useState(false);

  const update = async (patch: Partial<Pick<Review, "status" | "name" | "body">>, ok: string) => {
    setBusy(true);
    const { error } = await supabase.from("reviews").update(patch).eq("id", r.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ok);
    setEditing(false);
    refresh();
  };
  const remove = async () => {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusy(true);
    const { error } = await supabase.from("reviews").delete().eq("id", r.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };

  return (
    <li className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/30 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 truncate text-sm text-paper">
          {r.avatar_url && <img src={r.avatar_url} alt="" className="size-7 shrink-0 rounded-full object-cover" />}
          {r.name}
        </p>
      </div>
      {editing ? (
        <div className="space-y-2">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Name" />
          <textarea className={cn(field, "min-h-28 resize-y")} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} aria-label="Review" />
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed text-paper/75">{r.body}</p>
      )}
      <select
        className="meta w-full rounded-full border border-border bg-background px-3 py-1.5 text-paper"
        value={r.photoshoot_id ?? ""}
        aria-label="Linked photoshoot"
        onChange={async (e) => {
          const { error } = await supabase.from("reviews").update({ photoshoot_id: e.target.value || null } as never).eq("id", r.id);
          if (error) toast.error("Linking needs migration 0025_review_photoshoot — apply it in Lovable first."); else { toast.success(e.target.value ? "Linked to the photoshoot" : "Unlinked"); refresh(); }
        }}
      >
        <option value="">Linked photoshoot: none</option>
        {shoots.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <p className="meta text-[0.6rem] text-muted-foreground">
        {new Date(r.created_at).toLocaleDateString()}{r.client_deliveries ? ` · ${r.client_deliveries.title}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <button className={btnPrimary} disabled={busy || !name.trim() || !body.trim()} onClick={() => update({ name: name.trim(), body: body.trim() }, "Saved")}>Save</button>
            <button className={btn} onClick={() => { setEditing(false); setName(r.name); setBody(r.body); }}>Cancel</button>
          </>
        ) : (
          <>
            {r.status !== "approved" && <button className={btnPrimary} disabled={busy} onClick={() => update({ status: "approved" }, "Now on the website")}>Approve</button>}
            {r.status !== "hidden" && <button className={btn} disabled={busy} onClick={() => update({ status: "hidden" }, "Hidden")}>Hide</button>}
            <button className={btn} disabled={busy} onClick={() => setEditing(true)}>Edit</button>
            <button className={cn(btn, "text-destructive hover:border-destructive")} disabled={busy} onClick={remove}>Delete</button>
          </>
        )}
      </div>
    </li>
  );
}

/** Connects the Publish / Hide buttons under review notifications in Telegram. */
function TelegramPanel() {
  const status = useServerFn(telegramStatus);
  const connect = useServerFn(connectTelegramButtons);
  const q = useQuery({ queryKey: ["admin", "telegram"], queryFn: () => status() });
  const [busy, setBusy] = useState(false);
  if (q.isLoading || q.error || !q.data) return null;
  const here = typeof window === "undefined" ? "" : `${window.location.origin}/api/telegram`;
  const connected = !!q.data.webhook && q.data.webhook === here;
  const run = async () => {
    setBusy(true);
    try { const r = await connect(); toast.success(`Telegram buttons connected (${r.url})`); await q.refetch(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border/60 bg-card/30 p-5">
      <p className="meta text-muted-foreground">Telegram</p>
      {!q.data.configured ? (
        <p className="text-xs text-muted-foreground">Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Lovable Cloud to get review alerts.</p>
      ) : connected ? (
        <p className="text-xs text-paper/80">Alerts on · Publish / Hide buttons work from Telegram.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Alerts on. Connect the Publish / Hide buttons — do it from the published site.</p>
          <button className={btn} disabled={busy} onClick={run}>{busy ? "Connecting…" : "Connect buttons"}</button>
        </>
      )}
    </div>
  );
}
