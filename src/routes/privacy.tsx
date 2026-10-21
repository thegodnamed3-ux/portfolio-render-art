import { Link, createFileRoute } from "@tanstack/react-router";
import { withLang } from "@/lib/seo";
import type { ReactNode } from "react";
import { contact } from "@/content/contact";
import { LangSwitch, useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: (ctx) => withLang(ctx, {
    meta: [
      { title: "Privacy policy — thegodnamed" },
      { name: "description", content: "How thegodnamed (Gor Arsakjan, Tallinn) handles personal data." },
    ],
    }),
  component: PrivacyPage,
});

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a className="underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);
const B = ({ children }: { children: ReactNode }) => <strong className="text-paper">{children}</strong>;

const tg = contact.telegram ? <A href={contact.telegram}>Telegram</A> : null;
const wa = contact.whatsapp ? <A href={contact.whatsapp}>WhatsApp</A> : null;
const aki = <A href="https://www.aki.ee">aki.ee</A>;

type Doc = { title: ReactNode; updated: string; back: string; sections: { title: string; body: ReactNode[] }[] };

const DOCS: Record<Lang, Doc> = {
  en: {
    title: <>Privacy <em>policy.</em></>,
    updated: "Last updated 18 October 2026",
    back: "← Back",
    sections: [
      { title: "Who I am", body: [<>This website belongs to Gor Arsakjan (“thegodnamed”), a photographer and filmmaker based in Tallinn, Estonia. I am the controller of the personal data described here. You can reach me any time through {tg}{tg && wa && " or "}{wa}.</>] },
      {
        title: "What I collect and why",
        body: [
          <><B>Booking requests.</B> When you send a request through the form, I receive your name, how to reach you, the type of shoot, a preferred date and your message. They are delivered to me as a Telegram message and used only to answer you and arrange the shoot (steps before a contract, GDPR Art. 6(1)(b)).</>,
          <><B>Private galleries.</B> If I deliver photos to you, they are stored in a private gallery reachable only through a personal link (and a password, if we agreed on one). When you use it, I see when it was opened and downloaded, and any photos you marked as favourites or notes you left — so I know the photos arrived and which ones to work on (performance of our agreement, Art. 6(1)(b)).</>,
          <><B>Reviews.</B> If you leave a review, I receive your name and your text — and, for reviews moved from my previous website, a small photo. A review appears on the website only after I approve it, and you can ask me to change or remove it at any time (your consent, Art. 6(1)(a)).</>,
          <><B>Portfolio photos.</B> Photos of people shown in my portfolio are published with their agreement. If you appear in a photo and want it taken down, write to me and I’ll remove it.</>,
          <><B>Technical data.</B> Like any website, the hosting infrastructure processes your IP address and basic request data to deliver pages and keep the service secure (legitimate interest, Art. 6(1)(f)).</>,
        ],
      },
      { title: "Visit statistics", body: [<>To see how the website is used, I count page views without cookies. For each visit I store the page, the website you came from (e.g. “instagram”), your country and device type. Your IP address is never stored — it is only mixed with your browser type and the date into a one-way code that tells same-day repeat visits apart and changes every day (legitimate interest, Art. 6(1)(f)).</>] },
      { title: "Cookies and storage", body: [<>The website does not use advertising or analytics cookies. It remembers your language choice in a small cookie, and your browser may keep a few technical entries — for example, that you already saw a swipe hint, or the password of a private gallery for the current session — which never leave your device.</>] },
      { title: "Who else processes the data", body: [<>I don’t sell or share your data. To run the website I rely on service providers acting on my behalf: website and database hosting (Lovable Cloud and its infrastructure partners) and Telegram for delivering booking requests and notifications to me. Some of them may process data outside the European Economic Area under the safeguards required by the GDPR, such as Standard Contractual Clauses.</>] },
      { title: "How long I keep it", body: [<>Booking requests: as long as needed to arrange and carry out the shoot, and for bookkeeping where the law requires it. Private galleries and their activity records: until the gallery is deleted — usually within a few months after delivery, or earlier if you ask. Reviews: until you ask me to remove them. Visit statistics: up to two years.</>] },
      { title: "Your rights", body: [<>You can ask me for a copy of your data, to correct or delete it, to restrict or object to its use, and to receive it in a portable format. Where something is based on your consent, you can withdraw it at any time. If you think your data is handled wrongly, you can also complain to the Estonian Data Protection Inspectorate (Andmekaitse Inspektsioon, {aki}).</>] },
      { title: "Changes", body: [<>If this policy changes, the new version will be published on this page with a new date.</>] },
    ],
  },
  et: {
    title: <>Privaatsus&shy;poliitika<em>.</em></>,
    updated: "Viimati uuendatud 18. oktoobril 2026",
    back: "← Tagasi",
    sections: [
      { title: "Kes ma olen", body: [<>See veebileht kuulub Gor Arsakjanile („thegodnamed“), Tallinnas tegutsevale fotograafile ja filmitegijale. Olen siin kirjeldatud isikuandmete vastutav töötleja. Minuga saab igal ajal ühendust {tg}{tg && wa && " või "}{wa} kaudu.</>] },
      {
        title: "Milliseid andmeid kogun ja miks",
        body: [
          <><B>Broneerimispäringud.</B> Kui saadad vormi kaudu päringu, saan sinu nime, kontakti, pildistamise tüübi, soovitud kuupäeva ja sõnumi. Need jõuavad minuni Telegrami sõnumina ja neid kasutatakse ainult sulle vastamiseks ja pildistamise korraldamiseks (lepingueelsed toimingud, isikuandmete kaitse üldmääruse art 6 lg 1 p b).</>,
          <><B>Privaatsed galeriid.</B> Kui annan sulle fotod üle, hoitakse neid privaatses galeriis, millele pääseb ligi ainult isikliku lingi (ja kokkulepitud parooli) kaudu. Näen, millal galerii avati ja fotosid alla laaditi, ning milliseid fotosid märkisid lemmikuks või millised märkused jätsid — et teaksin, et fotod jõudsid kohale ja millega edasi töötada (lepingu täitmine, art 6 lg 1 p b).</>,
          <><B>Arvustused.</B> Kui jätad arvustuse, saan sinu nime ja teksti — ning minu eelmiselt veebilehelt üle toodud arvustuste puhul väikese foto. Arvustus ilmub veebilehel alles pärast minu kinnitust ning võid igal ajal paluda seda muuta või eemaldada (sinu nõusolek, art 6 lg 1 p a).</>,
          <><B>Portfoolio fotod.</B> Inimeste fotosid avaldan portfoolios nende nõusolekul. Kui oled fotol ja soovid, et see eemaldataks, kirjuta mulle ja ma eemaldan selle.</>,
          <><B>Tehnilised andmed.</B> Nagu iga veebileht, töötleb majutusteenus sinu IP-aadressi ja päringu põhiandmeid, et lehti kuvada ja teenust turvaliselt hoida (õigustatud huvi, art 6 lg 1 p f).</>,
        ],
      },
      { title: "Külastuste statistika", body: [<>Et näha, kuidas veebilehte kasutatakse, loen lehevaatamisi ilma küpsisteta. Iga külastuse kohta salvestan lehe, veebilehe, kust tulid (nt „instagram“), riigi ja seadme tüübi. Sinu IP-aadressi ei salvestata kunagi — see segatakse brauseri tüübi ja kuupäevaga ühesuunaliseks koodiks, mis eristab sama päeva korduvkülastusi ja muutub iga päev (õigustatud huvi, art 6 lg 1 p f).</>] },
      { title: "Küpsised ja salvestus", body: [<>Veebileht ei kasuta reklaami- ega analüütikaküpsiseid. Keelevalik jäetakse meelde väikeses küpsises ning sinu brauser võib hoida mõnda tehnilist kirjet — näiteks et oled libistamise vihjet juba näinud või privaatse galerii parooli käimasoleva seansi jaoks —, mis ei lahku kunagi sinu seadmest.</>] },
      { title: "Kes veel andmeid töötleb", body: [<>Ma ei müü ega jaga sinu andmeid. Veebilehe toimimiseks kasutan minu nimel tegutsevaid teenusepakkujaid: veebilehe ja andmebaasi majutus (Lovable Cloud ja selle taristupartnerid) ning Telegram, mille kaudu jõuavad minuni broneerimispäringud ja teavitused. Mõned neist võivad töödelda andmeid väljaspool Euroopa Majanduspiirkonda isikuandmete kaitse üldmääruses nõutud kaitsemeetmetega, näiteks lepingu tüüptingimuste alusel.</>] },
      { title: "Kui kaua andmeid hoian", body: [<>Broneerimispäringud: nii kaua, kui on vaja pildistamise korraldamiseks ja läbiviimiseks, ning raamatupidamise jaoks seadusega nõutud ajal. Privaatsed galeriid ja nende tegevuslogid: kuni galerii kustutamiseni — tavaliselt paari kuu jooksul pärast üleandmist või varem, kui palud. Arvustused: kuni palud need eemaldada. Külastuste statistika: kuni kaks aastat.</>] },
      { title: "Sinu õigused", body: [<>Võid paluda koopiat oma andmetest, nende parandamist või kustutamist, töötlemise piiramist või sellele vastuväite esitamist ning andmete saamist ülekantavas vormis. Kui töötlemine põhineb sinu nõusolekul, võid selle igal ajal tagasi võtta. Kui leiad, et sinu andmeid töödeldakse valesti, võid pöörduda ka Andmekaitse Inspektsiooni poole ({aki}).</>] },
      { title: "Muudatused", body: [<>Kui see poliitika muutub, avaldatakse uus versioon sellel lehel uue kuupäevaga.</>] },
    ],
  },
  ru: {
    title: <>Политика <em>конфиденциальности.</em></>,
    updated: "Обновлено 18 октября 2026",
    back: "← Назад",
    sections: [
      { title: "Кто я", body: [<>Этот сайт принадлежит Гору Арсакьяну («thegodnamed»), фотографу и видеографу из Таллина, Эстония. Я являюсь контролёром персональных данных, описанных здесь. Связаться со мной можно в любое время через {tg}{tg && wa && " или "}{wa}.</>] },
      {
        title: "Какие данные я собираю и зачем",
        body: [
          <><B>Заявки на съёмку.</B> Когда вы отправляете заявку через форму, я получаю ваше имя, контакт для связи, тип съёмки, желаемую дату и сообщение. Они приходят мне сообщением в Telegram и используются только для ответа вам и организации съёмки (действия до заключения договора, GDPR ст. 6(1)(b)).</>,
          <><B>Личные галереи.</B> Если я передаю вам фото, они хранятся в личной галерее, доступной только по персональной ссылке (и паролю, если мы договорились о нём). Я вижу, когда галерею открывали и скачивали фото, а также какие фото вы отметили как избранные и какие комментарии оставили — чтобы знать, что фото дошли, и с какими работать дальше (исполнение договорённости, ст. 6(1)(b)).</>,
          <><B>Отзывы.</B> Если вы оставляете отзыв, я получаю ваше имя и текст — а для отзывов, перенесённых с моего прежнего сайта, ещё и небольшое фото. Отзыв появляется на сайте только после моего одобрения, и вы в любой момент можете попросить изменить или удалить его (ваше согласие, ст. 6(1)(a)).</>,
          <><B>Фото в портфолио.</B> Фотографии людей публикуются в портфолио с их согласия. Если вы есть на фото и хотите, чтобы его убрали, напишите мне — я удалю его.</>,
          <><B>Технические данные.</B> Как и любой сайт, хостинг обрабатывает ваш IP-адрес и базовые данные запроса, чтобы показывать страницы и обеспечивать безопасность (законный интерес, ст. 6(1)(f)).</>,
        ],
      },
      { title: "Статистика посещений", body: [<>Чтобы понимать, как используется сайт, я считаю просмотры страниц без cookies. Для каждого посещения сохраняются страница, сайт, с которого вы пришли (например, «instagram»), страна и тип устройства. Ваш IP-адрес никогда не сохраняется — он лишь смешивается с типом браузера и датой в необратимый код, который отличает повторные визиты в тот же день и меняется каждый день (законный интерес, ст. 6(1)(f)).</>] },
      { title: "Cookies и хранение", body: [<>Сайт не использует рекламные или аналитические cookies. Выбор языка запоминается в небольшом cookie, а ваш браузер может хранить несколько технических записей — например, что вы уже видели подсказку про свайп, или пароль от личной галереи на время текущего сеанса, — которые никогда не покидают ваше устройство.</>] },
      { title: "Кто ещё обрабатывает данные", body: [<>Я не продаю и не передаю ваши данные. Для работы сайта я пользуюсь услугами поставщиков, действующих от моего имени: хостинг сайта и базы данных (Lovable Cloud и его инфраструктурные партнёры) и Telegram, через который мне приходят заявки и уведомления. Некоторые из них могут обрабатывать данные за пределами Европейской экономической зоны с мерами защиты, требуемыми GDPR, например на основании стандартных договорных условий.</>] },
      { title: "Как долго я храню данные", body: [<>Заявки: столько, сколько нужно для организации и проведения съёмки, и в сроки, требуемые законом для бухгалтерии. Личные галереи и записи об их использовании: до удаления галереи — обычно в течение нескольких месяцев после передачи, или раньше, если вы попросите. Отзывы: пока вы не попросите их удалить. Статистика посещений: до двух лет.</>] },
      { title: "Ваши права", body: [<>Вы можете запросить копию своих данных, их исправление или удаление, ограничение обработки или возражение против неё, а также получить данные в переносимом формате. Если обработка основана на вашем согласии, вы можете отозвать его в любой момент. Если вы считаете, что ваши данные обрабатываются неправильно, вы также можете обратиться в Инспекцию по защите данных Эстонии (Andmekaitse Inspektsioon, {aki}).</>] },
      { title: "Изменения", body: [<>Если политика изменится, новая версия будет опубликована на этой странице с новой датой.</>] },
    ],
  },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="display text-2xl text-paper md:text-3xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-paper/75 md:text-[0.9375rem]">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  const { lang } = useI18n();
  const doc = DOCS[lang];
  return (
    <main className="min-h-[100svh] px-5 pb-24 md:px-10">
      <header className="flex items-center justify-between gap-4 py-4 md:py-6">
        <Link to="/" aria-label="thegodnamed" className="meta inline-flex flex-col items-center whitespace-nowrap text-paper transition-opacity hover:opacity-60">
          <span className="wordmark">thegodnamed</span>
          <span className="-mr-[0.3em] mt-[3px] whitespace-nowrap text-[0.5rem] tracking-[0.3em] text-paper/85 md:mt-1 md:text-[0.5625rem]">PHOTOGRAPHY · VISUALS</span>
        </Link>
        <div className="flex items-baseline gap-5">
          <LangSwitch className="meta text-[0.6875rem] text-paper" />
          <Link to="/" className="meta text-[0.6875rem] text-muted-foreground hover:text-paper">{doc.back}</Link>
        </div>
      </header>

      <article className="mx-auto max-w-2xl space-y-10 pt-12 md:pt-20">
        <div>
          <h1 className="display text-5xl text-paper md:text-7xl">{doc.title}</h1>
          <p className="meta mt-4 text-muted-foreground">{doc.updated}</p>
        </div>
        {doc.sections.map((s) => (
          <Section key={s.title} title={s.title}>
            {s.body.map((b, i) => <p key={i}>{b}</p>)}
          </Section>
        ))}
      </article>
    </main>
  );
}
