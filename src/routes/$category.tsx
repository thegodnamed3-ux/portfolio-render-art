import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { SessionGrid, VideoGallery } from "@/components/Gallery";
import { SiteNav } from "@/components/SiteNav";
import { getCategory, internalCategories } from "@/content/categories";
import { getPublishedSessions } from "@/lib/portfolio.functions";

export const Route = createFileRoute("/$category")({
  loader: async ({ params }) => {
    const c = getCategory(params.category);
    if (!c) throw notFound();
    const sessions = c.videos.length ? [] : await getPublishedSessions({ data: { category: c.slug } });
    return { slug: c.slug, sessions };
  },
  head: ({ loaderData }) => {
    const c = loaderData ? getCategory(loaderData.slug) : undefined;
    if (!c) return { meta: [{ title: "Not found — thegodnamed" }, { name: "robots", content: "noindex" }] };
    const title = `${c.title} — thegodnamed`;
    const image = loaderData?.sessions[0]?.cover.src ?? (c.videos[0] ? `https://i.ytimg.com/vi/${c.videos[0].id}/hqdefault.jpg` : undefined);
    return {
      meta: [
        { title },
        { name: "description", content: c.description },
        { property: "og:title", content: title },
        { property: "og:description", content: c.description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug, sessions } = Route.useLoaderData();
  const i = internalCategories.findIndex((c) => c.slug === slug);
  const c = internalCategories[i]!;
  const prev = internalCategories[(i - 1 + internalCategories.length) % internalCategories.length]!;
  const next = internalCategories[(i + 1) % internalCategories.length]!;
  const count = sessions.length || c.videos.length;

  return (
    <main>
      <SiteNav />
      <section className="px-5 pb-16 pt-36 md:px-10 md:pb-28 md:pt-56">
        <div className="flex items-end justify-between gap-6 border-b border-border pb-6">
          <h1 className="display reveal text-[clamp(3.2rem,12vw,9rem)] text-paper">{c.title}.</h1>
          <p className="meta shrink-0 pb-2 text-muted-foreground">
            {String(i + 1).padStart(2, "0")} / {String(internalCategories.length).padStart(2, "0")}
            {count > 0 && <span className="hidden md:inline"> · {count} {c.videos.length ? "films" : "frames"}</span>}
          </p>
        </div>
      </section>

      <section className="px-5 pb-24 md:px-10 md:pb-40">
        {c.videos.length > 0 ? <VideoGallery videos={c.videos} /> : sessions.length ? <SessionGrid sessions={sessions} /> : <p className="meta py-24 text-center text-muted-foreground">—</p>}
      </section>

      <nav aria-label="Categories" className="grid grid-cols-2 border-t border-border">
        <Link to="/$category" params={{ category: prev.slug }} className="group border-r border-border px-5 py-10 md:px-10 md:py-16">
          <span className="meta text-muted-foreground">← Previous</span>
          <span className="display mt-3 block text-3xl text-paper transition-transform duration-300 group-hover:-translate-x-1 md:text-6xl">{prev.title}</span>
        </Link>
        <Link to="/$category" params={{ category: next.slug }} className="group px-5 py-10 text-right md:px-10 md:py-16">
          <span className="meta text-muted-foreground">Next →</span>
          <span className="display mt-3 block text-3xl text-paper transition-transform duration-300 group-hover:translate-x-1 md:text-6xl">{next.title}</span>
        </Link>
      </nav>

      <footer className="meta flex justify-between border-t border-border px-5 py-6 text-muted-foreground md:px-10">
        <span className="flex items-baseline gap-3"><Link to="/" className="wordmark text-paper">thegodnamed</Link><span>— Tallinn</span></span>
        <Link to="/" hash="contact" className="hover:text-paper">Book a session</Link>
      </footer>
    </main>
  );
}
