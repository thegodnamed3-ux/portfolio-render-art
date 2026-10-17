import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ContactLinks } from "@/components/ContactLinks";
import { useLightbox } from "@/components/Lightbox";
import { getDelivery, type Delivery, type DeliveryFile } from "@/lib/delivery.functions";
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
          <span className="-mr-[0.275em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · FILM</span>
        </Link>
        <span className="meta text-[0.6875rem] text-muted-foreground">Private gallery</span>
      </header>
      {delivery ? <Gallery d={delivery} /> : <Missing />}
      <Contact />
    </main>
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
  const [progress, setProgress] = useState<number | null>(null);
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

  const view = (i: number) => open(d.files.map((f) => ({ src: f.preview, w: f.w, h: f.h, alt: f.name })), i, d.title);

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
      </section>

      <section className="px-5 pb-20 md:px-10 md:pb-32">
        {n === 0 ? (
          <p className="meta py-16 text-center text-muted-foreground">Photos are on their way — check back soon.</p>
        ) : (
          <ul className="columns-4 gap-1 sm:gap-1.5 md:columns-6 lg:columns-8 2xl:columns-10">
            {d.files.map((f, i) => <Tile key={f.id} f={f} onOpen={() => view(i)} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function Tile({ f, onOpen }: { f: DeliveryFile; onOpen: () => void }) {
  return (
    <li className="group relative mb-1 break-inside-avoid overflow-hidden rounded-sm bg-charcoal sm:mb-1.5">
      <button type="button" onClick={onOpen} className="block w-full cursor-zoom-in" aria-label={`Open ${f.name}`}>
        <img src={f.preview} alt={f.name} width={f.w} height={f.h} loading="lazy" decoding="async" className="block h-auto w-full" />
      </button>
      <a
        href={f.download}
        download={f.name}
        aria-label={`Download ${f.name}`}
        className="glass absolute bottom-1 right-1 inline-flex size-6 items-center justify-center rounded-full text-paper transition-opacity duration-300 hover:bg-paper hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <DownloadIcon className="size-3" />
      </a>
    </li>
  );
}

function Contact() {
  return (
    <section data-nav-light className="bg-paper px-5 pb-10 pt-20 text-ink md:px-10 md:pt-28">
      <p className="meta text-ink-muted">Contact</p>
      <h2 className="display mt-6 text-[15vw] md:text-[9vw]">
        Book a <em>session.</em>
      </h2>
      <ContactLinks tone="light" className="mt-8 md:mt-12" />
      <footer className="meta mt-16 border-t border-ink/15 pt-5 text-ink-muted md:mt-24">
        <div className="flex items-baseline justify-between gap-4">
          <Link to="/" className="wordmark text-ink transition-opacity hover:opacity-60">thegodnamed</Link>
          <span className="flex items-baseline gap-2.5 whitespace-nowrap font-[Inter,sans-serif] text-[0.6875rem] font-medium uppercase leading-none tracking-[0.06em] text-ink-muted/65 md:text-xs">
            <span>Tallinn</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </span>
        </div>
      </footer>
    </section>
  );
}
