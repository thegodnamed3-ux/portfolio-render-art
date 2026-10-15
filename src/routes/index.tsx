import { createFileRoute } from "@tanstack/react-router";
import { Frame } from "@/components/Frame";
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

const disciplines = [
  "Portraits",
  "Couples",
  "Commercial",
  "Automotive",
  "Video",
  "Real estate",
];

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 mix-blend-difference">
      <nav className="meta px-5 py-4 text-paper md:px-10 md:py-6">
        <div className="flex items-baseline justify-between gap-4">
          <a href="#top" className="whitespace-nowrap tracking-[0.22em] transition-opacity hover:opacity-60 md:tracking-[0.3em]">
            thegodnamed
          </a>
          <div className="flex gap-3 text-[0.625rem] md:gap-8 md:text-[0.6875rem]">
            <a href="#work" className="hover:opacity-60 transition-opacity">Work</a>
            <a href="#about" className="hover:opacity-60 transition-opacity">About</a>
            <a href="#contact" className="hover:opacity-60 transition-opacity">Contact</a>
          </div>
        </div>
        <p className="mt-1.5 whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/55 md:text-[0.5625rem]">
          PHOTOGRAPHY · FILM
        </p>
      </nav>
    </header>
  );
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
        <p className="meta reveal mb-6 text-[0.5rem] text-paper/65 md:mb-9 md:text-[0.6875rem]">
          Photography, film &amp; visual storytelling.
        </p>
        <h1
          className="display reveal text-[clamp(3.4rem,15.5vw,11.5rem)] text-paper"
          style={{ animationDelay: "0.14s" }}
        >
          <span className="block">Seen</span>
          <span className="block md:pl-[0.6em]">
            <em>differently.</em>
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
        <Frame photo={p(3)} caption="Coastline" index={num(1)} className="md:col-span-8" />
        <Frame photo={p(10)} caption="Study" index={num(2)} className="w-2/3 justify-self-end md:col-span-3 md:col-start-10 md:mt-56 md:w-full" />
      </div>

      {/* Composition 2: small left, medium right */}
      <div className="mt-20 grid gap-6 md:mt-40 md:grid-cols-12 md:gap-10">
        <Frame photo={p(13)} caption="Red room" index={num(3)} className="md:col-span-5 md:col-start-2" />
        <Frame photo={p(8)} caption="Blue hour" index={num(4)} className="md:col-span-5 md:col-start-8 md:mt-32" />
      </div>

      {/* Full bleed */}
      <Frame photo={p(26)} caption="Edge of the cliff" index={num(5)} className="-mx-5 mt-20 md:-mx-10 md:mt-40 [&_figcaption]:px-5 md:[&_figcaption]:px-10" />

      {/* Composition 3: tall vertical + two */}
      <div className="mt-20 grid items-end gap-6 md:mt-40 md:grid-cols-12 md:gap-10">
        <Frame photo={p(17)} caption="White" index={num(6)} className="w-3/5 md:col-span-3 md:w-full" />
        <Frame photo={p(16)} caption="Glasshouse" index={num(7)} className="md:col-span-5" />
        <Frame photo={p(32)} caption="Kneel" index={num(8)} className="w-1/2 justify-self-end md:col-span-3 md:w-full" />
      </div>

      <div className="mt-20 grid gap-6 md:mt-40 md:grid-cols-12 md:gap-10">
        <Frame photo={p(5)} caption="Couples — sunset" index={num(9)} className="md:col-span-7" />
        <Frame photo={p(22)} caption="Monochrome" index={num(10)} className="md:col-span-4 md:col-start-9 md:-mt-0 md:self-end" />
      </div>
    </section>
  );
}

function Index_Disciplines() {
  return (
    <section className="bg-paper px-5 py-24 text-ink md:px-10 md:py-36">
      <div className="grid gap-12 md:grid-cols-12">
        <p className="meta text-ink-muted md:col-span-3">Index</p>
        <ol className="md:col-span-9">
          {disciplines.map((d, i) => (
            <li
              key={d}
              className="group flex items-baseline justify-between border-t border-ink/15 py-5 last:border-b md:py-7"
            >
              <span className="display text-4xl transition-transform duration-300 group-hover:translate-x-2 md:text-6xl">
                {d}
              </span>
              <span className="meta text-ink-muted">{num(i + 1)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Archive() {
  const rest = [1, 2, 4, 6, 7, 9, 12, 14, 15, 18, 19, 20, 21, 23, 24, 25, 27, 28, 29, 30, 31, 33, 34, 35];
  return (
    <section className="px-5 py-24 md:px-10 md:py-40">
      <div className="mb-12 flex items-baseline justify-between md:mb-20">
        <h2 className="display text-5xl md:text-7xl">Archive</h2>
        <p className="meta text-muted-foreground">{rest.length} frames</p>
      </div>
      <div className="columns-2 gap-3 md:columns-4 md:gap-6">
        {rest.map((n) => (
          <Frame key={n} photo={p(n)} className="mb-3 break-inside-avoid md:mb-6" />
        ))}
      </div>
    </section>
  );
}

function About() {
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
        <Frame photo={p(7)} className="md:col-span-3 md:col-start-10" />
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="bg-paper px-5 pb-10 pt-24 text-ink md:px-10 md:pt-40">
      <p className="meta text-ink-muted">Contact</p>
      <a
        href="mailto:hello@example.com"
        className="display mt-6 block text-[15vw] transition-opacity hover:opacity-60 md:text-[9vw]"
      >
        Book a <em>session</em>
      </a>
      <div className="meta mt-24 flex flex-col gap-3 border-t border-ink/15 pt-6 text-ink-muted md:flex-row md:justify-between">
        <span>thegodnamed — Tallinn</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </section>
  );
}

function Index() {
  return (
    <main>
      <Nav />
      <Hero />
      <Work />
      <Index_Disciplines />
      <Archive />
      <About />
      <Contact />
    </main>
  );
}
