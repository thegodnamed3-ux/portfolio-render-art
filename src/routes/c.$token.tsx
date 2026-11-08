import { Link, createFileRoute } from "@tanstack/react-router";
import { getPortal, type PortalItem } from "@/lib/delivery.functions";
import { LangSwitch, useI18n } from "@/lib/i18n";

/** A regular client's own page: every active gallery made for them, newest first. */
export const Route = createFileRoute("/c/$token")({
  loader: ({ params }) => getPortal({ data: { token: params.token } }),
  head: () => ({ meta: [{ title: "Your galleries — thegodnamed" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }] }),
  component: PortalPage,
});

const COPY = {
  en: { label: "Your galleries", hi: (n: string) => `For ${n}`, empty: "No active galleries right now.", missing: "This link is no longer active.", photos: "photos", locked: "Password", until: "Open until" },
  et: { label: "Teie galeriid", hi: (n: string) => `${n} jaoks`, empty: "Praegu aktiivseid galeriisid pole.", missing: "See link ei ole enam aktiivne.", photos: "fotot", locked: "Parool", until: "Avatud kuni" },
  ru: { label: "Ваши галереи", hi: (n: string) => `Для: ${n}`, empty: "Сейчас нет активных галерей.", missing: "Эта ссылка больше не активна.", photos: "фото", locked: "Пароль", until: "Открыта до" },
} as const;

function PortalPage() {
  const result = Route.useLoaderData();
  const { lang } = useI18n();
  const c = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "long", year: "numeric" });
  return (
    <main className="min-h-[100svh]">
      <header className="flex items-center justify-between gap-4 px-5 py-4 md:px-10 md:py-6">
        <Link to="/" aria-label="thegodnamed — open the website" className="meta inline-flex flex-col items-center whitespace-nowrap text-paper transition-opacity hover:opacity-60">
          <span className="wordmark">thegodnamed</span>
          <span className="-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · VISUALS</span>
        </Link>
        <LangSwitch />
      </header>
      <section className="px-5 pb-24 pt-16 md:px-10 md:pt-28">
        {result.state !== "ok" ? (
          <h1 className="display text-[2.4375rem] leading-none text-paper md:text-[3.8125rem]">{c.missing}</h1>
        ) : (
          <>
            <p className="meta text-[0.6875rem] text-muted-foreground">{result.name ? c.hi(result.name) : c.label}</p>
            <h1 className="display mt-5! text-[2.4375rem] leading-none text-paper md:text-[3.8125rem]">{c.label}</h1>
            {result.items.length === 0 ? (
              <p className="mt-8! text-muted-foreground">{c.empty}</p>
            ) : (
              <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((it: PortalItem) => (
                  <li key={it.token}>
                    <a href={`/g/${it.token}?lang=${lang}`} className="group block">
                      <span className="relative block aspect-[3/2] overflow-hidden rounded-lg bg-paper/5">
                        {it.cover
                          ? <img src={it.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                          : <span className="meta absolute inset-0 grid place-items-center text-muted-foreground">{it.locked ? `🔒 ${c.locked}` : ""}</span>}
                      </span>
                      <span className="display mt-4 block text-2xl leading-tight text-paper">{it.title}</span>
                      <span className="meta mt-2 block text-[0.6875rem] text-muted-foreground">
                        {fmt(it.date)} · {it.count} {c.photos}{it.expires ? ` · ${c.until} ${fmt(it.expires)}` : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
