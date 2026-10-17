import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ContactSection } from "@/components/ContactSection";
import { useLightbox } from "@/components/Lightbox";
import { getDelivery, type Delivery, type DeliveryFile } from "@/lib/delivery.functions";
import { submitReview } from "@/lib/reviews.functions";
import { ZipWriter } from "@/lib/zip";
import { formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Private client page, reachable only through the link generated in the studio. */
export const Route = createFileRoute("/g/$token")({
  loader: ({ params }) => getDelivery({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — thegodnamed` : "Gallery — thegodnamed" },
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

function DeliveryPage() {
  const delivery = Route.useLoaderData();
  return (
    <main className="min-h-[100svh]">
      <header className="flex items-center justify-between gap-4 px-5 py-4 md:px-10 md:py-6">
        <Link to="/" aria-label="thegodnamed — open the website" className="meta inline-flex flex-col items-center whitespace-nowrap text-paper transition-opacity hover:opacity-60">
          <span className="wordmark">thegodnamed</span>
          <span className="-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · VISUALS</span>
        </Link>
        <span className="meta text-[0.6875rem] text-muted-foreground">Private gallery</span>
      </header>
      {delivery ? <Gallery d={delivery} /> : <Missing />}
      <ContactSection reviews={false} />
    </main>
  );
}

function ReviewDialog({ token, defaultName, onClose }: { token: string; defaultName: string; onClose: () => void }) {
  const send = useServerFn(submitReview);
  const [name, setName] = useState(defaultName);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
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
      await send({ data: { token, name, body, rating } });
      setState("sent");
    } catch (err) {
      toast.error((err as Error).message || "Could not send the review");
      setState("idle");
    }
  };

  const field = "w-full rounded-2xl border border-paper/15 bg-transparent px-4 py-3 text-sm text-paper outline-none placeholder:text-paper/40 focus:border-paper/50";
  const shown = hover ?? rating ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leave a review"
      className="fixed inset-0 z-[110] flex items-end justify-center bg-viewer/70 p-3 backdrop-blur-md sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel w-full max-w-md rounded-[28px] p-5 text-paper md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="meta text-paper/70">Leave a review</p>
          <button type="button" onClick={onClose} aria-label="Close" className="glass hit inline-flex size-8 items-center justify-center rounded-full text-paper/80 hover:text-paper">✕</button>
        </div>
        {state === "sent" ? (
          <div className="py-6">
            <p className="display text-4xl">Thank you.</p>
            <p className="mt-3 text-sm text-paper/70">Your review means a lot. It will appear on the website after a quick check.</p>
            <button type="button" onClick={onClose} className="meta mt-6 rounded-full bg-paper px-5 py-2.5 text-ink">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Rating (optional)">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(rating === n ? null : n)}
                  className={cn("text-2xl leading-none transition-colors", n <= shown ? "text-paper" : "text-paper/20")}
                >★</button>
              ))}
              <span className="meta ml-2 text-[0.5625rem] text-paper/40">optional</span>
            </div>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} required aria-label="Your name" />
            <textarea className={cn(field, "min-h-32 resize-y")} value={body} onChange={(e) => setBody(e.target.value)} placeholder="A few words about the shoot and the photos" maxLength={1000} required aria-label="Review" />
            <button type="submit" disabled={state === "sending" || !name.trim() || body.trim().length < 3} className="meta w-full rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90 disabled:opacity-50">
              {state === "sending" ? "Sending…" : "Send review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Missing() {
  return (
    <section className="px-5 pb-24 pt-24 md:px-10 md:pb-36 md:pt-40">
      <p className="meta text-muted-foreground">Gallery</p>
      <h1 className="display mt-6 text-5xl text-paper md:text-7xl">This link is <em>no longer active.</em></h1>
      <p className="mt-6 max-w-md text-sm text-muted-foreground">If you need your photos again, just send me a message — I’ll share a fresh link.</p>
    </section>
  );
}

function Gallery({ d }: { d: Delivery }) {
  const { open } = useLightbox();
  const { token } = Route.useParams();
  const [progress, setProgress] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const n = d.files.length;

  const all = async () => {
    setProgress(0);
    try {
      const ok = await downloadAll(d, setProgress);
      if (ok) toast.success("Download complete");
    } catch (e) {
      toast.error((e as Error).message || "Download failed — please try again");
    }
    setProgress(null);
  };

  const view = (i: number) => open(d.files.map((f) => ({ src: f.preview, w: f.w, h: f.h, alt: f.name })), i, d.title, { action: { label: "Leave a review", onClick: () => setReviewOpen(true) } });

  return (
    <>
      <section className="px-5 pb-12 pt-16 md:px-10 md:pb-16 md:pt-28">
        <p className="meta text-muted-foreground">
          {d.clientName ? `For ${d.clientName} · ` : ""}{n} {n === 1 ? "photo" : "photos"}{d.totalSize > 0 ? ` · ${formatSize(d.totalSize)}` : ""}
        </p>
        <h1 className="display mt-5 text-[clamp(2.8rem,10vw,7.5rem)] text-paper">{d.title}</h1>
        {d.message && <p className="mt-6 max-w-xl whitespace-pre-line text-sm leading-relaxed text-paper/75 md:text-base">{d.message}</p>}
        {n > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={all}
              disabled={progress !== null}
              className="meta inline-flex items-center gap-2.5 rounded-full bg-paper px-5 py-3 text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <DownloadIcon className="size-4" />
              {progress === null ? "Download all (.zip)" : `Preparing ${progress} / ${n}…`}
            </button>
            <span className="meta text-[0.625rem] text-muted-foreground">Or download photos one by one below</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="group mt-6 inline-flex items-center gap-2 text-sm text-paper/60 transition-colors hover:text-paper"
        >
          Liked the photos? <span className="underline decoration-paper/30 underline-offset-4 group-hover:decoration-paper">Leave a review</span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </button>
      </section>
      {reviewOpen && <ReviewDialog token={token} defaultName={d.clientName ?? ""} onClose={() => setReviewOpen(false)} />}

      <section className="px-5 pb-20 md:px-10 md:pb-32">
        {n === 0 ? (
          <p className="meta py-16 text-center text-muted-foreground">Photos are on their way — check back soon.</p>
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
              {d.files.map((f, i) => <Tile key={f.id} f={f} onOpen={() => view(i)} />)}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

function Tile({ f, onOpen }: { f: DeliveryFile; onOpen: () => void }) {
  const portrait = f.h > f.w * 1.05;
  const [src, setSrc] = useState(f.preview);
  return (
    <li className={cn("group relative overflow-hidden rounded-sm bg-charcoal", portrait && "row-span-2")}>
      <button type="button" onClick={onOpen} className="absolute inset-0 z-0 block cursor-zoom-in" aria-label={`Open ${f.name}`}>
        <img
          src={src}
          alt={f.name}
          width={f.w}
          height={f.h}
          loading="lazy"
          decoding="async"
          draggable={false}
          // If the web preview is missing, fall back to the original file.
          onError={() => { if (src !== f.download) setSrc(f.download); }}
          className="pointer-events-none block h-full w-full object-cover"
        />
      </button>
      <a
        href={f.download}
        download={f.name}
        aria-label={`Download ${f.name}`}
        className="glass absolute bottom-1 right-1 z-10 inline-flex size-6 items-center justify-center rounded-full text-paper md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <DownloadIcon className="size-3" />
      </a>
    </li>
  );
}

