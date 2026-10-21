import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Request = { id: string; name: string; contact: string; shoot_type: string; wished_date: string | null; message: string | null; status: string; shoot_date: string | null; notes: string | null; created_at: string };

export const STAGES = [
  ["new", "New"], ["in progress", "Talking"], ["booked", "Shoot booked"], ["delivered", "Delivered"], ["paid", "Paid"], ["closed", "Closed"],
] as const;

const btn = "meta inline-flex items-center justify-center gap-2 rounded-[10px] border border-border px-3.5 py-2 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40";
const field = "w-full rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm text-paper outline-none focus:border-paper/60";

/** Booking requests from the website as a pipeline: stage, shoot date, private notes. */
export function RequestsTab() {
  const qc = useQueryClient();
  const [stage, setStage] = useState("open");
  const q = useQuery({
    queryKey: ["admin", "requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("booking_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Request[];
    },
  });
  if (q.isLoading) return <p className="meta text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="text-sm text-muted-foreground">Requests need migration 0027_booking_requests — apply it in Lovable. Until then requests only go to Telegram.</p>;
  const all = q.data ?? [];
  const isOpen = (r: Request) => !["paid", "closed"].includes(r.status);
  const count = (k: string) => all.filter((r) => (k === "open" ? isOpen(r) : r.status === k)).length;
  const list = all.filter((r) => (stage === "all" ? true : stage === "open" ? isOpen(r) : r.status === stage));
  const save = async (id: string, patch: Partial<Request>, ok?: string) => {
    const { error } = await (supabase as any).from("booking_requests").update(patch).eq("id", id);
    if (error) { toast.error("Could not save"); return; }
    if (ok) toast.success(ok);
    void qc.invalidateQueries({ queryKey: ["admin", "requests"] });
  };
  const contactHref = (c: string) => (/@/.test(c) ? `mailto:${c}` : /^\+?[\d\s()-]{6,}$/.test(c) ? `tel:${c.replace(/[^\d+]/g, "")}` : c.startsWith("@") ? `https://t.me/${c.slice(1)}` : null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[["open", "Open"], ...STAGES, ["all", "All"]].map(([k, label]) => (
          <button key={k} onClick={() => setStage(k)} className={cn(btn, stage === k && "border-paper bg-paper text-ink hover:text-ink")}>{label} <span className="opacity-60">{k === "all" ? all.length : count(k)}</span></button>
        ))}
      </div>
      {!list.length && <p className="meta text-muted-foreground">Nothing in this stage.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((r) => {
          const href = contactHref(r.contact);
          return (
            <li key={r.id} className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-paper">{r.name}</p>
                  <p className="meta mt-1 text-[0.6rem] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.shoot_type}{r.wished_date ? ` · wished: ${r.wished_date}` : ""}</p>
                </div>
                <select className={cn(field, "w-auto")} value={r.status} onChange={(e) => save(r.id, { status: e.target.value }, "Stage updated")} aria-label="Stage">
                  {STAGES.map(([k, label]) => <option key={k} value={k} className="bg-background">{label}</option>)}
                </select>
              </div>
              {r.message && <p className="whitespace-pre-line text-sm leading-relaxed text-paper/75">{r.message}</p>}
              <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
                <label className="space-y-1"><span className="meta text-[0.6rem] text-muted-foreground">Shoot date</span>
                  <input type="date" className={field} defaultValue={r.shoot_date ?? ""} onChange={(e) => save(r.id, { shoot_date: e.target.value || null, ...(e.target.value && ["new", "in progress"].includes(r.status) ? { status: "booked" } : {}) }, e.target.value ? "Shoot date saved" : undefined)} />
                </label>
                <label className="space-y-1"><span className="meta text-[0.6rem] text-muted-foreground">Notes (only you see them)</span>
                  <textarea rows={2} className={cn(field, "resize-y")} defaultValue={r.notes ?? ""} placeholder="Price, place, outfit ideas…" onBlur={(e) => { if ((e.target.value || null) !== r.notes) void save(r.id, { notes: e.target.value || null }, "Notes saved"); }} />
                </label>
              </div>
              <p className="text-sm text-paper/80">{href ? <a className="underline underline-offset-4" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{r.contact}</a> : r.contact}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Count of new requests for the sidebar badge. */
export function useNewRequests() {
  return useQuery({
    queryKey: ["admin", "requests", "new"],
    queryFn: async () => {
      const { count, error } = await (supabase as any).from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "new");
      return error ? 0 : count ?? 0;
    },
  });
}
