import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Frame } from "@/components/Frame";
import { ContactLinks } from "@/components/ContactLinks";
import { useLightbox } from "@/components/Lightbox";
import { SiteNav } from "@/components/SiteNav";
import { categories } from "@/content/categories";
import type { Category } from "@/content/categories";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "thegodnamed — Photography & film in Tallinn" },
      { name: "description", content: "Photography, film & visual storytelling. An editorial archive made in Tallinn." },
      { property: "og:title", content: "thegodnamed — Photography & film in Tallinn" },
      { property: "og:description", content: "Photography, film & visual storytelling. An editorial archive made in Tallinn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: photos[10]!.src },
      { name: "twitter:image", content: photos[10]!.src },
    ],
  }),
  component: Index,
});

const p = (n: number) => photos[n - 1]!;
const num = (n: number) => String(n).padStart(2, "0");

// Every photo on the homepage, in reading order, for the fullscreen viewer.
const workOrder = [3, 10, 13, 8, 26, 17, 16, 32, 5, 22];
const archiveOrder = [1, 2, 4, 6, 7, 9, 12, 14, 15, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 30, 31, 33, 34, 35];
const homeOrder = [...workOrder, ...archiveOrder];
const viewerItems = homeOrder.map((n) => ({ src: p(n).src, w: p(n).w, h: p(n).h }));

function useOpen() {
  const { open } = useLightbox();
  return (n: number) => () => open(viewerItems, homeOrder.indexOf(n));
}

function Hero() {
  const hero = p(11);
  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden">
      <img
        src={hero.src}
        alt="Woman standing in the sea at dusk"
        className="absolute inset-0 h-full w-full object-cover object-[60%_center]"
        loading="eager"
      />
      <div className="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-background via-background/60 to-transparent md:h-3/4 md:via-background/50" />
      <div className="relative flex min-h-[100svh] flex-col justify-end px-5 pb-8 md:px-10 md:pb-12">
        <p className="meta reveal mb-8 text-[0.5rem] text-paper/65 md:mb-10 md:text-[0.6875rem]">
          Photography, film &amp; visual storytelling.
        </p>
        <h1
          className="display reveal text-[clamp(3.4rem,15.5vw,11.5rem)] text-paper"
          style={{ animationDelay: "0.14s" }}
        >
          <span className="block">Beyond</span>
          <span className="block md:pl-[0.6em]">
            the <em>obvious.</em>
          </span>
        </h1>
        <div className="meta mt-10 flex items-baseline justify-between gap-4 border-t border-paper/25 pt-5 text-paper/70 md:mt-14">
          <span>Tallinn, Estonia</span>
          <span className="hidden md:inline">Archive · {photos.length} frames</span>
          <a href="#work" className="transition-colors hover:text-paper">Scroll ↓</a>
        </div>
      </div>
    </section>
  );
}

function Work() {
  const o = useOpen();
  return (
    <section id="work" className="px-5 py-24 md:px-10 md:py-40">
      <div className="mb-16 grid gap-6 md:mb-28 md:grid-cols-12">
        <p className="meta text-muted-foreground md:col-span-3">Selected work</p>
        <h2 className="display text-5xl md:col-span-8 md:text-7xl">
          Portraits by the sea, in studios, <em className="text-muted-foreground">and in between.</em>
        </h2>
      </div>

      {/* Composition 1: large + small offset */}
      <div className="grid gap-6 md:grid-cols-12 md:gap-10">
        <Frame onOpen={o(3)} photo={p(3)} caption="Coastline" index={num(1)} className="md:col-span-8" />
        <Frame onOpen={o(10)} photo={p(10)} caption="Study" index={num(2)} className="w-2/3 justify-self-end md:col-span-3 md:col-start-10 md:mt-56 md:w-full" />
      </div>

      {/* Composition 2: small left, medium right */}
      <div className="mt-20 grid gap-6 md:mt-40 md:grid-cols-12 md:gap-10">
        <Frame onOpen={o(13)} photo={p(13)} caption="Red room" index={num(3)} className="md:col-span-5 md:col-start-2" />
        <Frame onOpen={o(8)} photo={p(8)} caption="Blue hour" index={num(4)} className="md:col-span-5 md:col-start-8 md:mt-32" />
      </div>

      {/* Full bleed */}
      <Frame onOpen={o(26)} photo={p(26)} caption="Edge of the cliff" index={num(5)} className="-mx-5 mt-20 md:-mx-10 md:mt-40 [&_figcaption]:px-5 md:[&_figcaption]:px-10" />

      {/* Composition 3: tall vertical + two */}
      <div className="mt-20 grid items-end gap-6 md:mt-40 md:grid-cols-12 md:gap-10">
        <Frame onOpen={o(17)} photo={p(17)} caption="White" index={num(6)} className="w-3/5 md:col-span-3 md:w-full" />
        <Frame onOpen={o(16)} photo={p(16)} caption="Glasshouse" index={num(7)} className="md:col-span-5" />
        <Frame onOpen={o(32)} photo={p(32)} caption="Kneel" index={num(8)} className="w-1/2 justify-self-end md:col-span-3 md:w-full" />
      </div>

      <div className="mt-20 grid gap-6 md:mt-40 md:grid-cols-12 md:gap-10">
        <Frame onOpen={o(5)} photo={p(5)} caption="Couples — sunset" index={num(9)} className="md:col-span-7" />
        <Frame onOpen={o(22)} photo={p(22)} caption="Monochrome" index={num(10)} className="md:col-span-4 md:col-start-9 md:-mt-0 md:self-end" />
      </div>
    </section>
  );
}

function DisciplineRow({ c, n }: { c: Category; n: string }) {
  const inner = (
    <>
      <span className="flex items-center gap-3 md:gap-5">
        <span className="display text-4xl transition-transform duration-300 group-hover:translate-x-2 md:text-6xl">
          {c.title}
        </span>
        {c.external && (
          <ArrowUpRight
            strokeWidth={1.25}
            aria-hidden
            className="size-4 shrink-0 text-ink-muted transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 md:size-7"
          />
        )}
      </span>
      <span className="meta text-ink-muted">{n}</span>
    </>
  );
  const cls = "group flex items-baseline justify-between py-5 md:py-7";

  return c.external ? (
    <a
      href={c.external}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      aria-label={`${c.title} — opens in a new tab`}
    >
      {inner}
    </a>
  ) : (
    <Link to="/$category" params={{ category: c.slug }} className={cls}>
      {inner}
    </Link>
  );
}

function Index_Disciplines() {
  return (
    <section id="disciplines" data-nav-light className="scroll-mt-0 bg-paper px-5 py-24 text-ink md:px-10 md:py-36">
      <div className="grid gap-12 md:grid-cols-12">
        <h2 className="display text-3xl md:col-span-3 md:text-4xl">Disciplines.</h2>
        <ol className="md:col-span-9">
          {categories.map((c, i) => (
            <li key={c.slug} className="border-t border-ink/15 last:border-b">
              <DisciplineRow c={c} n={num(i + 1)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Archive() {
  const rest = archiveOrder;
  const o = useOpen();
  return (
    <section className="px-5 py-24 md:px-10 md:py-40">
      <div className="mb-12 flex items-baseline justify-between md:mb-20">
        <h2 className="display text-5xl md:text-7xl">Archive</h2>
        <p className="meta text-muted-foreground">{rest.length} frames</p>
      </div>
      <div className="columns-2 gap-3 md:columns-4 md:gap-6">
        {rest.map((n) => (
          <Frame key={n} onOpen={o(n)} photo={p(n)} className="mb-3 break-inside-avoid md:mb-6" />
        ))}
      </div>
    </section>
  );
}

function About() {
  const o = useOpen();
  return (
    <section id="about" className="border-t border-border px-5 py-24 md:px-10 md:py-40">
      <div className="grid gap-12 md:grid-cols-12 md:gap-10">
        <p className="meta text-muted-foreground md:col-span-3">About</p>
        <div className="md:col-span-5">
          <p className="display text-4xl md:text-5xl">
            Photographing people where the light is honest — on the Baltic shore, in quiet rooms, at the edge of the day.
          </p>
          {/* Placeholder copy — replace with the photographer's own words. */}
          <p className="mt-8 max-w-md text-sm leading-relaxed text-muted-foreground">
            Based in Tallinn. Portraits, couples and commissioned work. Replace this paragraph with your own biography.
          </p>
        </div>
        <Frame onOpen={o(7)} photo={p(7)} className="md:col-span-3 md:col-start-10" />
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" data-nav-light className="bg-paper px-5 pb-10 pt-24 text-ink md:px-10 md:pt-40">
      <p className="meta text-ink-muted">Contact</p>
      <h2 className="display mt-6 text-[15vw] md:text-[9vw]">
        Book a <em>session.</em>
      </h2>
      <ContactLinks tone="light" className="mt-8 md:mt-12" />
      <footer className="meta mt-20 border-t border-ink/15 pt-5 text-ink-muted md:mt-28">
        <div className="flex items-baseline justify-between gap-4">
          <span className="wordmark text-ink">thegodnamed</span>
          <span className="meta flex items-baseline gap-2 whitespace-nowrap text-ink-muted/65">
            <span className="text-lg md:text-xl">Tallinn</span>
            <span className="text-sm md:text-base">&copy; {new Date().getFullYear()}</span>
          </span>
        </div>
      </footer>
    </section>
  );
}

function Index() {
  return (
    <main>
      <SiteNav />
      <Hero />
      <Work />
      <Index_Disciplines />
      <Archive />
      <About />
      <Contact />
    </main>
  );
}
