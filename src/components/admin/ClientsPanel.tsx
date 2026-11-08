import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Clients (with their company) and ready-made message templates for client deliveries.
 * A delivery can be tied to a client: name, e-mail, language and default message come with it,
 * and the client page (/c/<token>) collects every delivery of that client.
 */
export type MsgLang = "en" | "et" | "ru";
export type Client = { id: string; name: string; company: string | null; email: string | null; phone: string | null; lang: MsgLang; template_id: string | null; notes: string | null };
export type Template = { id: string; title: string; lang: MsgLang; body: string };

const btn = "meta inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-paper/85 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-40";
const btnPrimary = "meta inline-flex items-center justify-center gap-2 rounded-full bg-paper px-4 py-2 text-ink transition-opacity hover:opacity-90 disabled:opacity-40";
const input = "w-full rounded-2xl border border-border bg-transparent px-4 py-2.5 text-sm text-paper outline-none placeholder:text-muted-foreground focus:border-paper/60";
const sb = supabase as any;
export const NEEDS_DB = "Clients and templates need their database update (migration “clients_templates”) — apply it in Lovable first.";
const dbError = (m: string) => (/studio_clients|message_templates|client_id|relation|schema|column/i.test(m) ? NEEDS_DB : m);

export const clientLabel = (c: Pick<Client, "name" | "company">) => (c.company ? `${c.company} — ${c.name}` : c.name);

export function useClients() {
  return useQuery({
    queryKey: ["admin", "clients"],
    queryFn: async () => {
      const r = await sb.from("studio_clients").select("*").order("company", { nullsFirst: false }).order("name");
      return r.error ? null : ((r.data ?? []) as Client[]);
    },
  });
}
export function useTemplates() {
  return useQuery({
    queryKey: ["admin", "templates"],
    queryFn: async () => {
      const r = await sb.from("message_templates").select("*").order("title");
      return r.error ? null : ((r.data ?? []) as Template[]);
    },
  });
}

/** Template text with the delivery's details put in: {name} {company} {title} {link} {password} {until}. */
export function fillTemplate(body: string, v: Record<string, string>) {
  return body.replace(/\{(name|company|title|link|password|until)\}/g, (_, k: string) => v[k] ?? "");
}
/** The reverse: the delivery's own details turned back into placeholders, to save a message as a template. */
export function toTemplate(text: string, v: Record<string, string>) {
  let out = text;
  (["link", "title", "password", "until", "company", "name"] as const).forEach((k) => { const val = v[k]; if (val && val.length > 1) out = out.split(val).join(`{${k}}`); });
  return out;
}

function ClientForm({ c, templates, onDone }: { c: Partial<Client> | null; templates: Template[]; onDone: (saved?: Client) => void }) {
  const [f, setF] = useState({ name: c?.name ?? "", company: c?.company ?? "", email: c?.email ?? "", phone: c?.phone ?? "", lang: (c?.lang ?? "en") as MsgLang, template_id: c?.template_id ?? "", notes: c?.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) { toast.error("Add the client's name"); return; }
    setBusy(true);
    const row = { name: f.name.trim(), company: f.company.trim() || null, email: f.email.trim().toLowerCase() || null, phone: f.phone.trim() || null, lang: f.lang, template_id: f.template_id || null, notes: f.notes.trim() || null };
    const r = c?.id ? await sb.from("studio_clients").update(row).eq("id", c.id).select("*").single() : await sb.from("studio_clients").insert(row).select("*").single();
    setBusy(false);
    if (r.error) { toast.error(dbError(r.error.message)); return; }
    toast.success(c?.id ? "Client saved" : "Client added");
    onDone(r.data as Client);
  };
  const remove = async () => {
    if (!c?.id || !window.confirm(`Delete ${clientLabel({ name: f.name, company: f.company || null })}? Their deliveries stay.`)) return;
    const r = await sb.from("studio_clients").delete().eq("id", c.id);
    if (r.error) toast.error(dbError(r.error.message)); else { toast.success("Client deleted"); onDone(); }
  };
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Name, e.g. Svetlana Davidovski" aria-label="Name" />
        <input className={input} value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Company, e.g. SV Kinnisvara (optional)" aria-label="Company" />
        <input className={input} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="E-mail (optional)" aria-label="E-mail" />
        <input className={input} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone (optional)" aria-label="Phone" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="meta text-muted-foreground">Language</span>
        <div className="glass inline-flex rounded-full p-1">
          {(["en", "et", "ru"] as const).map((l) => (
            <button key={l} type="button" onClick={() => set("lang", l)} className={cn("meta rounded-full px-3 py-1", f.lang === l ? "bg-paper text-ink" : "text-paper/75")}>{l.toUpperCase()}</button>
          ))}
        </div>
        <select className={cn(input, "w-auto min-w-48 flex-1")} value={f.template_id} onChange={(e) => set("template_id", e.target.value)} aria-label="Default message">
          <option value="">Standard message</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.lang.toUpperCase()})</option>)}
        </select>
      </div>
      <input className={input} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes for yourself (optional)" aria-label="Notes" />
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} disabled={busy} onClick={() => void save()}>{c?.id ? "Save client" : "Add client"}</button>
        <button className={btn} onClick={() => onDone()}>Cancel</button>
        {c?.id && <button className={cn(btn, "text-destructive hover:border-destructive")} onClick={() => void remove()}>Delete</button>}
      </div>
    </div>
  );
}

/** Pick the delivery's client (or add a new one right here). */
export function ClientPicker({ value, onPick }: { value: string | null; onPick: (c: Client | null) => void }) {
  const qc = useQueryClient();
  const clients = useClients();
  const templates = useTemplates();
  const [adding, setAdding] = useState(false);
  if (clients.data === null) return null; // database update not applied yet: the plain fields still work
  const list = clients.data ?? [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select className={cn(input, "w-auto min-w-56 flex-1")} value={value ?? ""} aria-label="Client"
          onChange={(e) => { const c = list.find((x) => x.id === e.target.value) ?? null; onPick(c); }}>
          <option value="">— No saved client —</option>
          {list.map((c) => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
        </select>
        <button className={btn} type="button" onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "+ New client"}</button>
      </div>
      {adding && (
        <ClientForm c={null} templates={templates.data ?? []} onDone={async (saved) => {
          setAdding(false);
          await qc.invalidateQueries({ queryKey: ["admin", "clients"] });
          if (saved) onPick(saved);
        }} />
      )}
    </div>
  );
}

/** Clients and templates in one place: add, edit, delete. */
export function ClientsManager() {
  const qc = useQueryClient();
  const clients = useClients();
  const templates = useTemplates();
  const [editing, setEditing] = useState<string | null>(null);
  const [tplEdit, setTplEdit] = useState<Partial<Template> | null>(null);
  if (clients.data === null || templates.data === null) return <p className="text-xs text-muted-foreground">{NEEDS_DB}</p>;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin", "clients"] }), qc.invalidateQueries({ queryKey: ["admin", "templates"] })]);
  const saveTpl = async () => {
    if (!tplEdit?.title?.trim() || !tplEdit.body?.trim()) { toast.error("Add a name and the text"); return; }
    const row = { title: tplEdit.title.trim(), lang: tplEdit.lang ?? "en", body: tplEdit.body };
    const r = tplEdit.id ? await sb.from("message_templates").update(row).eq("id", tplEdit.id) : await sb.from("message_templates").insert(row);
    if (r.error) { toast.error(dbError(r.error.message)); return; }
    toast.success("Template saved"); setTplEdit(null); await refresh();
  };
  const delTpl = async (t: Template) => {
    if (!window.confirm(`Delete the template “${t.title}”?`)) return;
    const r = await sb.from("message_templates").delete().eq("id", t.id);
    if (r.error) toast.error(dbError(r.error.message)); else await refresh();
  };
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="meta text-muted-foreground">Clients</p>
          <button className={btn} onClick={() => setEditing("new")}>+ New client</button>
        </div>
        {editing === "new" && <ClientForm c={null} templates={templates.data ?? []} onDone={async () => { setEditing(null); await refresh(); }} />}
        <ul className="space-y-1.5">
          {(clients.data ?? []).map((c) => (
            <li key={c.id}>
              {editing === c.id ? (
                <ClientForm c={c} templates={templates.data ?? []} onDone={async () => { setEditing(null); await refresh(); }} />
              ) : (
                <button onClick={() => setEditing(c.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2 text-left hover:border-paper/30">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-paper">{c.company || c.name}</span>
                    <span className="meta block truncate text-muted-foreground">{c.company ? `${c.name} · ` : ""}{c.lang.toUpperCase()}{c.email ? ` · ${c.email}` : ""}</span>
                  </span>
                  <span className="meta shrink-0 text-muted-foreground">Edit</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {!clients.data?.length && editing !== "new" && <p className="text-xs text-muted-foreground">No clients yet.</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="meta text-muted-foreground">Message templates</p>
          <button className={btn} onClick={() => setTplEdit({ title: "", lang: "en", body: "" })}>+ New template</button>
        </div>
        <p className="text-xs text-muted-foreground">Placeholders: {"{name} {company} {title} {link} {password} {until}"} — they’re filled in from the delivery. You can also write a message in a delivery and press “Save as template”.</p>
        {tplEdit && (
          <div className="space-y-2 rounded-2xl border border-border/60 p-4">
            <div className="flex flex-wrap gap-2">
              <input className={cn(input, "flex-1")} value={tplEdit.title ?? ""} onChange={(e) => setTplEdit({ ...tplEdit, title: e.target.value })} placeholder="Template name, e.g. Agent — Russian" />
              <div className="glass inline-flex rounded-full p-1">
                {(["en", "et", "ru"] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setTplEdit({ ...tplEdit, lang: l })} className={cn("meta rounded-full px-3 py-1", (tplEdit.lang ?? "en") === l ? "bg-paper text-ink" : "text-paper/75")}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <textarea className={cn(input, "resize-y text-sm leading-relaxed")} rows={8} value={tplEdit.body ?? ""} onChange={(e) => setTplEdit({ ...tplEdit, body: e.target.value })} placeholder={"Hi {name}!\n\nYour photos are ready: {title}\n{link}\n\n— Gor"} />
            <div className="flex gap-2">
              <button className={btnPrimary} onClick={() => void saveTpl()}>Save template</button>
              <button className={btn} onClick={() => setTplEdit(null)}>Cancel</button>
            </div>
          </div>
        )}
        <ul className="space-y-1.5">
          {(templates.data ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2">
              <span className="min-w-0 truncate text-sm text-paper">{t.title} <span className="meta text-muted-foreground">{t.lang.toUpperCase()}</span></span>
              <span className="flex shrink-0 gap-3">
                <button className="meta text-muted-foreground hover:text-paper" onClick={() => setTplEdit(t)}>Edit</button>
                <button className="meta text-muted-foreground hover:text-destructive" onClick={() => void delTpl(t)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
        {!templates.data?.length && !tplEdit && <p className="text-xs text-muted-foreground">No templates yet.</p>}
      </div>
    </div>
  );
}
