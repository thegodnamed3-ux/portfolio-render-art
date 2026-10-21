import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ContactSection } from "@/components/ContactSection";
import { originOf, useLightbox, type ViewerOrigin } from "@/components/Lightbox";
import { useFadeIn } from "@/components/Frame";
import { getDelivery, logDeliveryEvent, markDeliveryFile, submitPicks, type Delivery, type DeliveryFile, type DeliveryResult } from "@/lib/delivery.functions";
import { submitReview } from "@/lib/reviews.functions";
import { ZipWriter } from "@/lib/zip";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LangSwitch, PHOTOS, useI18n } from "@/lib/i18n";

/** Private client page, reachable only through the link generated in the studio. */
export const Route = createFileRoute("/g/$token")({
  loader: ({ params }) => getDelivery({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.state === "ok" ? `${loaderData.delivery.title} — thegodnamed` : "Gallery — thegodnamed" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: DeliveryPage,
});

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn("fill-none stroke-current", className)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
  </svg>
);

const zipName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "photos"}.zip`;

type SavePicker = (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
  createWritable: () => Promise<{ write: (d: Uint8Array) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>;
}>;

/** Builds the archive in the browser: straight to disk where supported, otherwise in memory. */
async function downloadAll(d: Delivery, onProgress: (done: number) => void) {
  const name = zipName(d.title);
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;

  let write: (c: Uint8Array) => Promise<void>;
  let done: () => Promise<void>;
  let fail: () => Promise<void> = async () => {};

  if (picker) {
    let handle;
    try {
      handle = await picker({ suggestedName: name, types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }] });
    } catch {
      return false; // dialog dismissed
    }
    const out = await handle.createWritable();
    write = (c) => out.write(c);
    done = () => out.close();
    fail = () => out.abort().catch(() => {});
  } else {
    const parts: BlobPart[] = [];
    write = async (c) => { parts.push(c as BlobPart); };
    done = async () => {
      const url = URL.createObjectURL(new Blob(parts, { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
  }

  try {
    const zip = new ZipWriter(write);
    for (let i = 0; i < d.files.length; i++) {
      const f = d.files[i]!;
      if (!f.download) continue;
      const res = await fetch(f.download);
      if (!res.ok) throw new Error(`Could not download ${f.name}`);
      await zip.add(f.name, new Uint8Array(await res.arrayBuffer()));
      onProgress(i + 1);
    }
    await zip.finish();
    await done();
    return true;
  } catch (e) {
    await fail();
    throw e;
  }
}

type AccessKey = { token: string; password: string | null };

function DeliveryPage() {
  const initial = Route.useLoaderData();
  const { token } = Route.useParams();
  const fetchDelivery = useServerFn(getDelivery);
  const { t } = useI18n();
  const [result, setResult] = useState<DeliveryResult>(initial);
  const [password, setPassword] = useState<string | null>(null);
  const key = `delivery-pw:${token}`;

  const unlock = async (pw: string, silent = false) => {
    const r = await fetchDelivery({ data: { token, password: pw } });
    if (r.state === "ok") {
      setPassword(pw);
      try { sessionStorage.setItem(key, pw); } catch { /* private mode */ }
    }
    if (!(silent && r.state === "locked")) setResult(r);
    return r;
  };

  // A password typed earlier in this browser session opens the gallery straight away.
  useEffect(() => {
    if (initial.state !== "locked") return;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(key); } catch { /* ignore */ }
    if (saved) void unlock(saved, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-[100svh]">
      <header className="flex items-center justify-between gap-4 px-5 py-4 md:px-10 md:py-6">
        <Link to="/" aria-label="thegodnamed — open the website" className="meta inline-flex flex-col items-center whitespace-nowrap text-paper transition-opacity hover:opacity-60">
          <span className="wordmark">thegodnamed</span>
          <span className="-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · VISUALS</span>
        </Link>
        <div className="flex items-baseline gap-5">
          <span className="meta hidden text-[0.6875rem] text-muted-foreground sm:inline">{t("g.private")}</span>
          <LangSwitch className="meta text-[0.6875rem] text-paper" />
        </div>
      </header>
      {result.state === "ok" ? (
        <Gallery d={result.delivery} access={{ token, password }} />
      ) : result.state === "locked" ? (
        <PasswordGate wrong={result.wrong} onSubmit={unlock} />
      ) : result.state === "expired" ? (
        <Notice title={<>{t("g.expired1")} <em>{t("g.expired2")}</em></>} />
      ) : (
        <Notice title={<>{t("g.inactive1")} <em>{t("g.inactive2")}</em></>} />
      )}
      <ContactSection reviews={false} />
    </main>
  );
}

function PasswordGate({ wrong, onSubmit }: { wrong: boolean; onSubmit: (pw: string) => Promise<DeliveryResult> }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();
  return (
    <section className="flex min-h-[60svh] items-center justify-center px-5 py-20">
      <form
        onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onSubmit(pw).catch(() => toast.error(t("g.open"))); setBusy(false); }}
        className="glass-panel w-full max-w-sm space-y-4 rounded-[28px] p-6 text-paper"
      >
        <p className="meta text-paper/70">{t("g.private")}</p>
        <p className="display text-4xl">{t("g.pwTitle1")} <em>{t("g.pwTitle2")}</em></p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          aria-label={t("g.pw")}
          className="w-full rounded-full border border-paper/15 bg-transparent px-4 py-3 text-sm text-paper outline-none placeholder:text-paper/40 focus:border-paper/50"
          placeholder={t("g.pw")}
        />
        {wrong && <p className="text-xs text-destructive">{t("g.pwWrong")}</p>}
        <button type="submit" disabled={busy || !pw} className="meta w-full rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90 disabled:opacity-50">
          {busy ? t("g.opening") : t("g.open")}
        </button>
      </form>
    </section>
  );
}

function ReviewDialog({ access, defaultName, onClose }: { access: AccessKey; defaultName: string; onClose: () => void }) {
  const send = useServerFn(submitReview);
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await send({ data: { ...access, name, body } });
      setState("sent");
    } catch (err) {
      toast.error((err as Error).message || t("rv.fail"));
      setState("idle");
    }
  };

  const field = "w-full rounded-2xl border border-paper/15 bg-transparent px-4 py-3 text-sm text-paper outline-none placeholder:text-paper/40 focus:border-paper/50";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("rv.title")}
      className="fixed inset-0 z-[110] flex items-end justify-center bg-viewer/70 p-3 backdrop-blur-md sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel w-full max-w-md rounded-[28px] p-5 text-paper md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="meta text-paper/70">{t("rv.title")}</p>
          <button type="button" onClick={onClose} aria-label={t("bf.close")} className="glass hit inline-flex size-8 items-center justify-center rounded-full text-paper/80 hover:text-paper">✕</button>
        </div>
        {state === "sent" ? (
          <div className="py-6">
            <p className="display text-4xl">{t("rv.thanks1")}</p>
            <p className="mt-3 text-sm text-paper/70">{t("rv.thanks2")}</p>
            <button type="button" onClick={onClose} className="meta mt-6 rounded-full bg-paper px-5 py-2.5 text-ink">{t("bf.close")}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("bf.name")} maxLength={60} required aria-label={t("bf.name")} />
            <textarea className={cn(field, "min-h-32 resize-y")} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("rv.body")} maxLength={1000} required aria-label={t("rv.title")} />
            <button type="submit" disabled={state === "sending" || !name.trim() || body.trim().length < 3} className="meta w-full rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90 disabled:opacity-50">
              {state === "sending" ? t("bf.sending") : t("rv.send")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Notice({ title }: { title: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="px-5 pb-24 pt-24 md:px-10 md:pb-36 md:pt-40">
      <p className="meta text-muted-foreground">{t("g.gallery")}</p>
      <h1 className="display mt-6 text-5xl text-paper md:text-7xl">{title}</h1>
      <p className="mt-6 max-w-md text-sm text-muted-foreground">{t("g.fresh")}</p>
    </section>
  );
}

const HeartIcon = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn("stroke-current", filled ? "fill-current" : "fill-none", className)} strokeWidth="1.6" strokeLinejoin="round">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);
const NoteIcon = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={cn("stroke-current", filled ? "fill-current" : "fill-none", className)} strokeWidth="1.6" strokeLinejoin="round">
    <path d="M5 5h14v10H10l-5 4z" />
  </svg>
);

type Marks = Record<string, { favorite: boolean; note: string | null }>;

function Gallery({ d, access }: { d: Delivery; access: AccessKey }) {
  const { open } = useLightbox();
  const { t, p } = useI18n();
  const mark = useServerFn(markDeliveryFile);
  const log = useServerFn(logDeliveryEvent);
  const sendPicks = useServerFn(submitPicks);
  const [picksState, setPicksState] = useState<"idle" | "sending" | "sent">("idle");
  const sendSelection = async () => {
    setPicksState("sending");
    try {
      const r = await sendPicks({ data: access });
      setPicksState("sent");
      toast.success(`${t("g.selSentToast")} (${r.count} ${p(r.count, PHOTOS)})`);
    } catch (e) {
      setPicksState("idle");
      toast.error((e as Error).message || t("bf.fail"));
    }
  };
  const [progress, setProgress] = useState<number | null>(null);
  // A link from the review request (?review=1) opens the form straight away.
  const [reviewOpen, setReviewOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("review") === "1");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [noteFor, setNoteFor] = useState<DeliveryFile | null>(null);
  const [marks, setMarks] = useState<Marks>(() => Object.fromEntries(d.files.map((f) => [f.id, { favorite: f.favorite, note: f.note }])));
  const favCount = Object.values(marks).filter((m) => m.favorite).length;
  const shown = onlyFavs ? d.files.filter((f) => marks[f.id]?.favorite) : d.files;
  const n = d.files.length;

  // Stats: one "opened" per browser session.
  useEffect(() => {
    const k = `delivery-viewed:${access.token}`;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* ignore */ }
    void log({ data: { ...access, kind: "view" } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (id: string, patch: { favorite?: boolean; note?: string | null }) => {
    const before = marks[id]!;
    if (picksState === "sent") setPicksState("idle");
    setMarks((m) => ({ ...m, [id]: { ...m[id]!, ...patch } }));
    try {
      await mark({ data: { ...access, fileId: id, ...patch } });
    } catch (e) {
      setMarks((m) => ({ ...m, [id]: before }));
      toast.error((e as Error).message || t("g.saveFail"));
    }
  };

  const all = async () => {
    setProgress(0);
    try {
      const ok = await downloadAll(d, setProgress);
      if (ok) {
        toast.success(t("g.downloadDone"));
        void log({ data: { ...access, kind: "zip" } }).catch(() => {});
      }
    } catch (e) {
      toast.error((e as Error).message || t("g.downloadFail"));
    }
    setProgress(null);
  };

  const view = (i: number, origin?: ViewerOrigin) => open(shown.map((f) => ({ src: f.preview, w: f.w, h: f.h, alt: f.name })), i, d.title, { origin, action: { label: t("g.leaveReview"), onClick: () => setReviewOpen(true) } });

  return (
    <>
      <section className="px-5 pb-12 pt-16 md:px-10 md:pb-16 md:pt-28">
        <p className="meta text-muted-foreground">
          {d.clientName ? `${t("g.for")} ${d.clientName} · ` : ""}{n} {p(n, PHOTOS)}{d.totalSize > 0 ? ` · ${formatSize(d.totalSize)}` : ""}
        </p>
        <h1 className="display mt-5 text-[clamp(2.8rem,10vw,7.5rem)] text-paper">{d.title}</h1>
        {d.message && <p className="mt-6 max-w-xl whitespace-pre-line text-sm leading-relaxed text-paper/75 md:text-base">{d.message}</p>}
        {n > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {!d.watermark && <button
              type="button"
              onClick={all}
              disabled={progress !== null}
              className="meta inline-flex items-center gap-2.5 rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <DownloadIcon className="size-4" />
              {progress === null ? t("g.downloadAll") : `${t("g.preparing")} ${progress} / ${n}…`}
            </button>}
            <button
              type="button"
              onClick={() => setOnlyFavs((v) => !v)}
              aria-pressed={onlyFavs}
              disabled={!favCount && !onlyFavs}
              className={cn("glass meta inline-flex items-center gap-2 rounded-full px-4 py-3 text-paper disabled:opacity-40", onlyFavs && "!bg-paper !text-ink")}
            >
              <HeartIcon filled={favCount > 0} className="size-3.5" />
              {onlyFavs ? t("g.showAll") : `${t("g.favourites")} ${favCount}`}
            </button>
            {favCount > 0 && (
              <button
                type="button"
                onClick={sendSelection}
                disabled={picksState === "sending"}
                className="glass meta inline-flex items-center gap-2 rounded-full px-4 py-3 text-paper disabled:opacity-50"
              >
                {picksState === "sending" ? t("bf.sending") : picksState === "sent" ? t("g.selSent") : `${t("g.sendSel")} (${favCount})`}
              </button>
            )}
          </div>
        )}
        {d.watermark && n > 0 && (
          <p className="mt-4 max-w-md text-sm text-paper/70">{t("g.watermark")}</p>
        )}
        {n > 0 && (
          <p className="mt-4 max-w-md text-xs text-paper/50">{t("g.hint")}</p>
        )}
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="group mt-6 inline-flex items-center gap-2 text-sm text-paper/60 transition-colors hover:text-paper"
        >
          {t("g.liked")} <span className="underline decoration-paper/30 underline-offset-4 group-hover:decoration-paper">{t("g.leaveReview")}</span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </button>
      </section>
      {reviewOpen && <ReviewDialog access={access} defaultName={d.clientName ?? ""} onClose={() => setReviewOpen(false)} />}
      {noteFor && (
        <NoteDialog
          file={noteFor}
          initial={marks[noteFor.id]?.note ?? ""}
          onClose={() => setNoteFor(null)}
          onSave={(note) => { void save(noteFor.id, { note: note.trim() || null }); setNoteFor(null); }}
        />
      )}

      <section className="px-5 pb-20 md:px-10 md:pb-32">
        {n === 0 ? (
          <p className="meta py-16 text-center text-muted-foreground">{t("g.empty")}</p>
        ) : (
          // Row height = one landscape (3:2) cell; portraits span two rows, so two
          // landscapes stack in the space of one portrait. Dense flow fills the holes.
          <div style={{ containerType: "inline-size" }}>
            <ul
              className="grid grid-flow-row-dense [--cols:4] [--gap:0.25rem] sm:[--gap:0.375rem] md:[--cols:6] lg:[--cols:8]"
              style={{
                gridTemplateColumns: "repeat(var(--cols), minmax(0, 1fr))",
                gridAutoRows: "calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols) * 2 / 3)",
                gap: "var(--gap)",
              }}
            >
              {shown.map((f, i) => (
                <Tile
                  key={f.id}
                  f={f}
                  mark={marks[f.id] ?? { favorite: false, note: null }}
                  onOpen={(origin) => view(i, origin)}
                  onFavorite={() => void save(f.id, { favorite: !marks[f.id]?.favorite })}
                  onNote={() => setNoteFor(f)}
                  onDownload={() => void log({ data: { ...access, kind: "download", fileId: f.id } }).catch(() => {})}
                />
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

function NoteDialog({ file, initial, onClose, onSave }: { file: DeliveryFile; initial: string; onClose: () => void; onSave: (note: string) => void }) {
  const [text, setText] = useState(initial);
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={t("g.noteTitle")} className="fixed inset-0 z-[110] flex items-end justify-center bg-viewer/50 p-3 backdrop-blur-md sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(text); }} className="glass-panel w-full max-w-md space-y-4 rounded-[28px] p-5 text-paper md:p-6">
        <div className="flex items-center gap-3">
          <img src={file.preview} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="meta text-paper/70">{t("g.noteTitle")}</p>
            <p className="truncate text-xs text-paper/50">{file.name}</p>
          </div>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={t("g.notePh")}
          aria-label="Note"
          className="min-h-28 w-full resize-y rounded-2xl border border-paper/15 bg-transparent px-4 py-3 text-sm text-paper outline-none placeholder:text-paper/40 focus:border-paper/50"
        />
        <div className="flex gap-2">
          <button type="submit" className="meta flex-1 rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90">{t("g.noteSave")}</button>
          {initial && <button type="button" onClick={() => onSave("")} className="glass meta rounded-full px-4 py-3 text-paper">{t("g.noteRemove")}</button>}
        </div>
      </form>
    </div>
  );
}

function Tile({ f, mark, onOpen, onFavorite, onNote, onDownload }: {
  f: DeliveryFile; mark: { favorite: boolean; note: string | null };
  onOpen: (origin?: ViewerOrigin) => void; onFavorite: () => void; onNote: () => void; onDownload: () => void;
}) {
  const portrait = f.h > f.w * 1.05;
  const [src, setSrc] = useState(f.preview);
  const fade = useFadeIn();
  const reveal = "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100";
  return (
    <li className={cn("group relative overflow-hidden rounded-sm bg-charcoal", portrait && "row-span-2")}>
      <button type="button" onClick={(e) => onOpen(originOf(e.currentTarget))} className="absolute inset-0 z-0 block cursor-zoom-in" aria-label={`Open ${f.name}`}>
        <img
          ref={fade.ref}
          onLoad={fade.onLoad}
          data-fade=""
          src={src}
          alt={f.name}
          width={f.w}
          height={f.h}
          loading="lazy"
          decoding="async"
          draggable={false}
          // If the web preview is missing, fall back to the original file.
          onError={() => { if (f.download && src !== f.download) setSrc(f.download); else fade.onError(); }}
          className={cn("pointer-events-none block h-full w-full object-cover transition-opacity duration-500 ease-out", fade.loaded ? "opacity-100" : "opacity-0")}
        />
        {f.overlay && (
          <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="wordmark -rotate-12 text-[clamp(0.7rem,2.2cqw,1.4rem)] text-white/35 [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">thegodnamed</span>
          </span>
        )}
      </button>
      <div className="absolute bottom-1 left-1 z-10 flex gap-1">
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={mark.favorite}
          aria-label={mark.favorite ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
          className={cn("glass inline-flex size-6 items-center justify-center rounded-full text-paper", !mark.favorite && reveal)}
        >
          <HeartIcon filled={mark.favorite} className="size-3" />
        </button>
        <button
          type="button"
          onClick={onNote}
          aria-label={mark.note ? `Edit note on ${f.name}` : `Add a note to ${f.name}`}
          title={mark.note ?? undefined}
          className={cn("glass inline-flex size-6 items-center justify-center rounded-full text-paper", !mark.note && reveal)}
        >
          <NoteIcon filled={!!mark.note} className="size-3" />
        </button>
      </div>
      {f.download && <a
        href={f.download}
        download={f.name}
        onClick={onDownload}
        aria-label={`Download ${f.name}`}
        className={cn("glass absolute bottom-1 right-1 z-10 inline-flex size-6 items-center justify-center rounded-full text-paper", reveal)}
      >
        <DownloadIcon className="size-3" />
      </a>}
    </li>
  );
}
