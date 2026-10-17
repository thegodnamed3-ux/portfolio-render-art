import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { contact } from "@/content/contact";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — thegodnamed" },
      { name: "description", content: "How thegodnamed (Gor Arsakjan, Tallinn) handles personal data." },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "17 October 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="display text-2xl text-paper md:text-3xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-paper/75 md:text-[0.9375rem]">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="min-h-[100svh] px-5 pb-24 md:px-10">
      <header className="flex items-center justify-between gap-4 py-4 md:py-6">
        <Link to="/" aria-label="thegodnamed — back to the website" className="meta inline-flex flex-col items-center whitespace-nowrap text-paper transition-opacity hover:opacity-60">
          <span className="wordmark">thegodnamed</span>
          <span className="-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · VISUALS</span>
        </Link>
        <Link to="/" className="meta text-[0.6875rem] text-muted-foreground hover:text-paper">← Back</Link>
      </header>

      <article className="mx-auto max-w-2xl space-y-10 pt-12 md:pt-20">
        <div>
          <h1 className="display text-5xl text-paper md:text-7xl">Privacy <em>policy.</em></h1>
          <p className="meta mt-4 text-muted-foreground">Last updated {UPDATED}</p>
        </div>

        <Section title="Who I am">
          <p>
            This website belongs to Gor Arsakjan (“thegodnamed”), a photographer and filmmaker based in Tallinn, Estonia.
            I am the controller of the personal data described here. You can reach me any time through
            {contact.telegram && <> <a className="underline underline-offset-2" href={contact.telegram} target="_blank" rel="noopener noreferrer">Telegram</a></>}
            {contact.whatsapp && <> or <a className="underline underline-offset-2" href={contact.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a></>}.
          </p>
        </Section>

        <Section title="What I collect and why">
          <p><strong className="text-paper">Booking requests.</strong> When you send a request through the form, I receive your name, how to reach you, the type of shoot, a preferred date and your message. They are delivered to me as a Telegram message and used only to answer you and arrange the shoot (steps before a contract, GDPR Art. 6(1)(b)).</p>
          <p><strong className="text-paper">Private galleries.</strong> If I deliver photos to you, they are stored in a private gallery reachable only through a personal link (and a password, if we agreed on one). When you use it, I see when it was opened and downloaded, and any photos you marked as favourites or notes you left — so I know the photos arrived and which ones to work on (performance of our agreement, Art. 6(1)(b)).</p>
          <p><strong className="text-paper">Reviews.</strong> If you leave a review, I receive your name, your text and — for reviews moved from my previous website — a small photo. A review appears on the website only after I approve it, and you can ask me to change or remove it at any time (your consent, Art. 6(1)(a)).</p>
          <p><strong className="text-paper">Portfolio photos.</strong> Photos of people shown in my portfolio are published with their agreement. If you appear in a photo and want it taken down, write to me and I’ll remove it.</p>
          <p><strong className="text-paper">Technical data.</strong> Like any website, the hosting infrastructure processes your IP address and basic request data to deliver pages and keep the service secure (legitimate interest, Art. 6(1)(f)).</p>
        </Section>

        <Section title="Visit statistics">
          <p>
            To see how the website is used, I count page views without cookies. For each visit I store the page, the
            website you came from (e.g. “instagram”), your country and device type. Your IP address is never stored —
            it is only mixed with your browser type and the date into a one-way code that tells same-day repeat visits
            apart and changes every day (legitimate interest, Art. 6(1)(f)).
          </p>
        </Section>

        <Section title="Cookies and storage">
          <p>
            The website does not use advertising or analytics cookies. Your browser may keep a few small technical entries
            — for example, that you already saw a swipe hint, or the password of a private gallery for the current session —
            which never leave your device.
          </p>
        </Section>

        <Section title="Who else processes the data">
          <p>
            I don’t sell or share your data. To run the website I rely on service providers acting on my behalf: website
            and database hosting (Lovable Cloud and its infrastructure partners) and Telegram for delivering booking
            requests and notifications to me. Some of them may process data outside the European Economic Area under the
            safeguards required by the GDPR, such as Standard Contractual Clauses.
          </p>
        </Section>

        <Section title="How long I keep it">
          <p>
            Booking requests: as long as needed to arrange and carry out the shoot, and for bookkeeping where the law
            requires it. Private galleries and their activity records: until the gallery is deleted — usually within a few
            months after delivery, or earlier if you ask. Reviews: until you ask me to remove them.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask me for a copy of your data, to correct or delete it, to restrict or object to its use, and to receive
            it in a portable format. Where something is based on your consent, you can withdraw it at any time. If you think
            your data is handled wrongly, you can also complain to the Estonian Data Protection Inspectorate
            (Andmekaitse Inspektsioon, <a className="underline underline-offset-2" href="https://www.aki.ee" target="_blank" rel="noopener noreferrer">aki.ee</a>).
          </p>
        </Section>

        <Section title="Changes">
          <p>If this policy changes, the new version will be published on this page with a new date.</p>
        </Section>
      </article>
    </main>
  );
}
