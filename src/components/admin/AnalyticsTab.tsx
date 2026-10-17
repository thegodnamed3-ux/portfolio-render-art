import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type View = { path: string; referrer: string | null; country: string | null; device: string | null; visitor: string; created_at: string };

const RANGES = [7, 30, 90] as const;
const panel = "rounded-3xl border border-border/60 bg-card/30 p-5";

const COUNTRY = (code: string) => {
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; }
};

function Top({ title, rows, total, empty }: { title: string; rows: [string, number][]; total: number; empty: string }) {
  return (
    <div className={panel}>
      <p className="meta mb-4 text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(([label, n]) => (
            <li key={label} className="relative">
              <span className="absolute inset-y-0 left-0 rounded-lg bg-paper/[0.07]" style={{ width: `${Math.max(4, (n / Math.max(1, total)) * 100)}%` }} />
              <span className="relative flex items-baseline justify-between gap-3 px-2.5 py-1 text-sm">
                <span className="truncate text-paper/90">{label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{n}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cookie-free visit statistics: visitors, views, pages, sources, countries, devices. */
export function AnalyticsTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const q = useQuery({
    queryKey: ["admin", "analytics", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const out: View[] = [];
      for (let a = 0; ; a += 1000) {
        const { data, error } = await supabase.from("page_views").select("path, referrer, country, device, visitor, created_at").gte("created_at", since).order("id").range(a, a + 999);
        if (error) throw error;
        out.push(...((data ?? []) as View[]));
        if (!data || data.length < 1000 || out.length > 100_000) break;
      }
      return out;
    },
  });

  const stats = useMemo(() => {
    const rows = q.data ?? [];
    const dayKey = (r: View) => r.created_at.slice(0, 10);
    const visitors = new Set(rows.map((r) => `${dayKey(r)}|${r.visitor}`)).size;
    const count = (pick: (r: View) => string | null, n = 8) => {
      const m = new Map<string, number>();
      rows.forEach((r) => { const k = pick(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    };
    // Visitors per day for the chart (every day in range, zeros included).
    const perDay = new Map<string, Set<string>>();
    rows.forEach((r) => { const k = dayKey(r); if (!perDay.has(k)) perDay.set(k, new Set()); perDay.get(k)!.add(r.visitor); });
    const series: { day: string; n: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      series.push({ day: d, n: perDay.get(d)?.size ?? 0 });
    }
    const direct = rows.filter((r) => !r.referrer).length;
    return {
      visitors,
      views: rows.length,
      perVisit: visitors ? (rows.length / visitors).toFixed(1) : "0",
      pages: count((r) => r.path),
      sources: [...count((r) => r.referrer, 7), ...(direct ? [["direct / typed", direct] as [string, number]] : [])].sort((a, b) => b[1] - a[1]),
      countries: count((r) => (r.country ? COUNTRY(r.country) : null), 6),
      devices: count((r) => r.device, 3),
      series,
      max: Math.max(1, ...series.map((s) => s.n)),
    };
  }, [q.data, days]);

  if (q.error) return <p className="text-sm text-destructive">Statistics appear once the database update for them is applied.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass inline-flex rounded-full p-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)} className={cn("meta rounded-full px-3.5 py-1.5", days === r ? "bg-paper text-ink" : "text-paper/75")}>{r} days</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">No cookies, no stored IP addresses. A summary arrives in Telegram every Monday.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Visitors", stats.visitors],
          ["Page views", stats.views],
          ["Pages per visit", stats.perVisit],
        ].map(([label, v]) => (
          <div key={label} className={panel}>
            <p className="meta text-muted-foreground">{label}</p>
            <p className="display mt-2 text-5xl text-paper tabular-nums">{q.isLoading ? "—" : v}</p>
          </div>
        ))}
      </div>

      <div className={panel}>
        <p className="meta mb-4 text-muted-foreground">Visitors per day</p>
        <div className="flex h-36 items-end gap-[2px]" role="img" aria-label="Visitors per day">
          {stats.series.map((s) => (
            <div key={s.day} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t-sm bg-paper/60 transition-colors group-hover:bg-paper" style={{ height: `${(s.n / stats.max) * 100}%`, minHeight: s.n ? 2 : 0 }} />
              <span className="meta pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-paper px-2 py-0.5 text-[0.55rem] text-ink group-hover:block">
                {new Date(s.day).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {s.n}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Top title="Top pages" rows={stats.pages} total={stats.views} empty="No visits yet." />
        <Top title="Where visitors came from" rows={stats.sources} total={stats.views} empty="No visits yet." />
        <Top title="Countries" rows={stats.countries} total={stats.views} empty="No visits yet." />
        <Top title="Devices" rows={stats.devices} total={stats.views} empty="No visits yet." />
      </div>
    </div>
  );
}
