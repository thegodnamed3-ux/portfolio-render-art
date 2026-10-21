import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createServerFn } from "@tanstack/react-start";

export type Lang = "en" | "et" | "ru";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "et", label: "ET" },
  { id: "ru", label: "RU" },
];
const isLang = (v: unknown): v is Lang => v === "en" || v === "et" || v === "ru";

/** Language for this request: the visitor's choice (cookie), else their browser language, else English. */
export const getLang = createServerFn({ method: "GET" }).handler(async (): Promise<Lang> => {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const h = req.headers;
    // A shared link can carry ?lang=et — it wins on the first visit.
    const fromUrl = new URL(req.url).searchParams.get("lang");
    if (isLang(fromUrl)) return fromUrl;
    const cookie = /(?:^|;\s*)lang=(en|et|ru)\b/.exec(h.get("cookie") ?? "")?.[1];
    if (isLang(cookie)) return cookie;
    const accept = (h.get("accept-language") ?? "").toLowerCase();
    for (const part of accept.split(",")) {
      const code = part.trim().slice(0, 2);
      if (isLang(code)) return code;
    }
  } catch { /* no request (static) */ }
  return "en";
});

type Entry = Record<Lang, string>;
const D = {
  // Navigation
  "nav.work": { en: "Work", et: "Tööd", ru: "Работы" },
  "nav.explore": { en: "Explore", et: "Suunad", ru: "Направления" },
  "nav.archive": { en: "Archive", et: "Arhiiv", ru: "Архив" },
  "nav.about": { en: "About", et: "Minust", ru: "Обо мне" },
  "ar.title": { en: "Archive", et: "Arhiiv", ru: "Архив" },
  "ar.back": { en: "Back to the website", et: "Tagasi kodulehele", ru: "Вернуться на сайт" },
  "ar.cats": { en: "Categories", et: "Suunad", ru: "Направления" },
  "ar.open": { en: "Open photo", et: "Ava foto", ru: "Открыть фото" },
  "ar.none": { en: "No photos here yet.", et: "Siin pole veel fotosid.", ru: "Здесь пока нет фото." },
  "sp.prev": { en: "Previous photo", et: "Eelmine foto", ru: "Предыдущее фото" },
  "sp.next": { en: "Next photo", et: "Järgmine foto", ru: "Следующее фото" },
  "sp.show": { en: "Show photo", et: "Näita fotot", ru: "Показать фото" },
  "pf.full": { en: "Open full screen", et: "Ava täisekraanil", ru: "Открыть на весь экран" },
  "nav.contact": { en: "Contact", et: "Kontakt", ru: "Контакты" },
  "nav.menu": { en: "Menu.", et: "Menüü.", ru: "Меню." },
  "nav.close": { en: "Close.", et: "Sulge.", ru: "Закрыть." },
  "nav.openMenu": { en: "Open menu", et: "Ava menüü", ru: "Открыть меню" },
  "nav.closeMenu": { en: "Close menu", et: "Sulge menüü", ru: "Закрыть меню" },
  "nav.subtitle": { en: "PHOTOGRAPHY · VISUALS", et: "FOTOGRAAFIA · VISUAALID", ru: "ФОТОГРАФИЯ · ВИЗУАЛ" },

  // Hero
  "hero.l1": { en: "Beyond", et: "Beyond", ru: "Beyond" },
  "hero.l2a": { en: "the", et: "the", ru: "the" },
  "hero.l2b": { en: "obvious.", et: "obvious.", ru: "obvious." },
  "hero.place": { en: "Tallinn, Estonia", et: "Tallinn, Eesti", ru: "Таллин, Эстония" },
  "hero.tag": { en: "Photography · Visuals", et: "Fotograafia · Visuaalid", ru: "Фотография · Визуал" },
  "hero.scroll": { en: "Scroll", et: "Keri", ru: "Вниз" },
  "hero.swipe": { en: "Swipe", et: "Libista", ru: "Листайте" },
  "hero.prev": { en: "Previous photograph", et: "Eelmine foto", ru: "Предыдущее фото" },
  "hero.next": { en: "Next photograph", et: "Järgmine foto", ru: "Следующее фото" },

  // Sections
  "work.title": { en: "Selected works.", et: "Valitud tööd.", ru: "Избранные работы." },
  "work.lead1": { en: "Faces, stories and products —", et: "Näod, lood ja tooted —", ru: "От портрета до коммерческой съёмки —" },
  "work.lead2": { en: "in light worth keeping.", et: "valguses, mis jääb meelde.", ru: "с вниманием к каждому кадру." },
  "disciplines.title": { en: "Disciplines.", et: "Suunad.", ru: "Направления." },
  "about.title": { en: "About.", et: "Minust.", ru: "Обо мне." },
  "about.role": { en: "Photographer & visual artist · Tallinn", et: "Fotograaf ja visuaalkunstnik · Tallinn", ru: "Фотограф и визуальный художник · Таллин" },
  "about.p1": {
    en: "I make pictures for people, places and brands — homes that feel lived-in before anyone moves in, faces that forget the camera is there, ads that don’t look like ads.",
    et: "Teen pilte inimestele, kohtadele ja brändidele — kodud, mis tunduvad elatud juba enne sissekolimist, näod, mis unustavad kaamera, reklaamid, mis ei näe välja nagu reklaam.",
    ru: "Снимаю людей, места и бренды — квартиры, в которых хочется жить ещё до переезда, лица, которые забывают о камере, рекламу, которая не выглядит как реклама.",
  },
  "about.p2": {
    en: "Real estate, portraits, people and brands. Photo and video — from the first frame to the final edit.",
    et: "Kinnisvara, portreed, inimesed ja brändid. Foto ja video — esimesest kaadrist viimase montaažini.",
    ru: "Недвижимость, портреты, люди и бренды. Фото и видео — от первого кадра до финального монтажа.",
  },
  "contact.title": { en: "Contact.", et: "Kontakt.", ru: "Контакты." },
  "reviews.title": { en: "Reviews.", et: "Arvustused.", ru: "Отзывы." },
  "reviews.pill": { en: "Reviews", et: "Arvustused", ru: "Отзывы" },
  "contact.pill": { en: "Contact", et: "Kontakt", ru: "Контакты" },
  "book.l1": { en: "Book a", et: "Broneeri", ru: "Записаться" },
  "book.l2": { en: "session.", et: "pildistamine.", ru: "на съёмку." },
  "book.send": { en: "Send a request", et: "Saada päring", ru: "Оставить заявку" },
  "footer.privacy": { en: "Privacy", et: "Privaatsus", ru: "Конфиденциальность" },
  "footer.city": { en: "Tallinn", et: "Tallinn", ru: "Таллин" },
  "review.close": { en: "Close review", et: "Sulge arvustus", ru: "Закрыть отзыв" },

  // Booking form
  "bf.name": { en: "Your name", et: "Sinu nimi", ru: "Ваше имя" },
  "bf.contact": { en: "Phone, e-mail or Telegram", et: "Telefon, e-post või Telegram", ru: "Телефон, e-mail или Telegram" },
  "bf.date": { en: "Preferred date (optional)", et: "Soovitud kuupäev (valikuline)", ru: "Желаемая дата (необязательно)" },
  "bf.message": { en: "A few words about the idea (optional)", et: "Paar sõna ideest (valikuline)", ru: "Пару слов об идее (необязательно)" },
  "bf.send": { en: "Send request", et: "Saada päring", ru: "Отправить заявку" },
  "bf.sending": { en: "Sending…", et: "Saadan…", ru: "Отправляю…" },
  "bf.thanks": { en: "Thank you — your request is on its way. I’ll get back to you shortly.", et: "Aitäh — päring on teel. Võtan peagi ühendust.", ru: "Спасибо — заявка отправлена. Скоро с вами свяжусь." },
  "bf.close": { en: "Close", et: "Sulge", ru: "Закрыть" },
  "bf.privacy": { en: "Your details are used only to reply to you.", et: "Sinu andmeid kasutatakse ainult vastamiseks.", ru: "Ваши данные используются только для ответа." },
  "bf.fail": { en: "Could not send the request", et: "Päringut ei õnnestunud saata", ru: "Не удалось отправить заявку" },

  // Disciplines / categories
  "cat.portraits": { en: "Portraits", et: "Portreed", ru: "Портреты" },
  "cat.couples": { en: "Couples", et: "Paarid", ru: "Пары" },
  "cat.commercial": { en: "Commercial", et: "Reklaam", ru: "Коммерция" },
  "cat.automotive": { en: "Automotive", et: "Autod", ru: "Авто" },
  "cat.video": { en: "Video", et: "Video", ru: "Видео" },
  "cat.real-estate": { en: "Real estate", et: "Kinnisvara", ru: "Недвижимость" },
  "cat.other": { en: "Other", et: "Muu", ru: "Другое" },

  // Portfolio explorer & viewer
  "pf.none": { en: "No published sessions yet", et: "Pildistamisi veel pole", ru: "Пока нет съёмок" },
  "pf.loading": { en: "Loading…", et: "Laadin…", ru: "Загрузка…" },
  "pf.scroll": { en: "Scroll to explore ↓", et: "Keri edasi ↓", ru: "Листайте ↓" },
  "pf.film": { en: "Film", et: "Film", ru: "Фильм" },
  "pf.back": { en: "← Back", et: "← Tagasi", ru: "← Назад" },
  "pf.close": { en: "Close", et: "Sulge", ru: "Закрыть" },
  "pf.play": { en: "▶ Play", et: "▶ Esita", ru: "▶ Смотреть" },
  "lb.swipe": { en: "← Swipe to explore →", et: "← Libista →", ru: "← Листайте →" },
  "lb.end": { en: "End of session", et: "Pildistamise lõpp", ru: "Конец съёмки" },
  "lb.book": { en: "Book", et: "Broneeri", ru: "Записаться" },
  "lb.prev": { en: "Previous photo", et: "Eelmine foto", ru: "Предыдущее фото" },
  "lb.next": { en: "Next photo", et: "Järgmine foto", ru: "Следующее фото" },

  // Client gallery
  "g.private": { en: "Private gallery", et: "Privaatne galerii", ru: "Личная галерея" },
  "g.for": { en: "For", et: "Kellele:", ru: "Для" },
  "g.downloadAll": { en: "Download all (.zip)", et: "Laadi kõik alla (.zip)", ru: "Скачать всё (.zip)" },
  "g.preparing": { en: "Preparing", et: "Valmistan", ru: "Готовлю" },
  "g.downloadDone": { en: "Download complete", et: "Allalaadimine valmis", ru: "Загрузка завершена" },
  "g.downloadFail": { en: "Download failed — please try again", et: "Allalaadimine ebaõnnestus — proovi uuesti", ru: "Не удалось скачать — попробуйте ещё раз" },
  "g.favourites": { en: "Favourites", et: "Lemmikud", ru: "Избранное" },
  "g.showAll": { en: "Show all", et: "Näita kõiki", ru: "Показать все" },
  "g.sendSel": { en: "Send my selection", et: "Saada minu valik", ru: "Отправить мой выбор" },
  "g.selSent": { en: "Selection sent · send again", et: "Valik saadetud · saada uuesti", ru: "Выбор отправлен · отправить снова" },
  "g.selSentToast": { en: "Sent — thank you!", et: "Saadetud — aitäh!", ru: "Отправлено — спасибо!" },
  "g.hint": {
    en: "Tap the heart on the photos you like most and the speech bubble to leave a note, then press “Send my selection”.",
    et: "Vajuta südamele fotodel, mis sulle kõige rohkem meeldivad, ja jutumullile, et jätta märkus, siis vajuta „Saada minu valik“.",
    ru: "Отметьте сердечком понравившиеся фото, а значком облачка оставьте комментарий, затем нажмите «Отправить мой выбор».",
  },
  "g.watermark": {
    en: "These are watermarked previews. Full-quality downloads open once the shoot is paid — the link stays the same.",
    et: "Need on vesimärgiga eelvaated. Täiskvaliteedis allalaadimine avaneb pärast tasumist — link jääb samaks.",
    ru: "Это превью с водяным знаком. Скачивание в полном качестве откроется после оплаты — ссылка останется той же.",
  },
  "g.liked": { en: "Liked the photos?", et: "Meeldisid fotod?", ru: "Понравились фото?" },
  "g.leaveReview": { en: "Leave a review", et: "Jäta arvustus", ru: "Оставить отзыв" },
  "g.empty": { en: "Photos are on their way — check back soon.", et: "Fotod on teel — vaata varsti uuesti.", ru: "Фото скоро появятся — загляните позже." },
  "g.gallery": { en: "Gallery", et: "Galerii", ru: "Галерея" },
  "g.inactive1": { en: "This link is", et: "See link ei ole", ru: "Эта ссылка" },
  "g.inactive2": { en: "no longer active.", et: "enam aktiivne.", ru: "больше не активна." },
  "g.expired1": { en: "This link has", et: "Selle lingi", ru: "Срок действия" },
  "g.expired2": { en: "expired.", et: "aeg on läbi.", ru: "ссылки истёк." },
  "g.fresh": { en: "If you need your photos again, just send me a message — I’ll share a fresh link.", et: "Kui vajad fotosid uuesti, kirjuta mulle — saadan uue lingi.", ru: "Если фото снова понадобятся, просто напишите мне — пришлю новую ссылку." },
  "g.pwTitle1": { en: "Enter the", et: "Sisesta", ru: "Введите" },
  "g.pwTitle2": { en: "password.", et: "parool.", ru: "пароль." },
  "g.pw": { en: "Password", et: "Parool", ru: "Пароль" },
  "g.pwWrong": { en: "That password doesn’t match. Try again.", et: "Parool ei sobi. Proovi uuesti.", ru: "Пароль не подходит. Попробуйте ещё раз." },
  "g.open": { en: "Open gallery", et: "Ava galerii", ru: "Открыть галерею" },
  "g.opening": { en: "Opening…", et: "Avan…", ru: "Открываю…" },
  "g.noteTitle": { en: "Note on this photo", et: "Märkus selle foto kohta", ru: "Комментарий к фото" },
  "g.notePh": { en: "e.g. a bit warmer, crop tighter, remove the sign…", et: "nt veidi soojem, tihedam kadreering, eemalda silt…", ru: "например: чуть теплее, кадрировать плотнее, убрать вывеску…" },
  "g.noteSave": { en: "Save note", et: "Salvesta märkus", ru: "Сохранить" },
  "g.noteRemove": { en: "Remove", et: "Eemalda", ru: "Удалить" },
  "g.saveFail": { en: "Could not save", et: "Salvestamine ebaõnnestus", ru: "Не удалось сохранить" },
  "rv.title": { en: "Leave a review", et: "Jäta arvustus", ru: "Оставить отзыв" },
  "rv.body": { en: "A few words about the shoot and the photos", et: "Paar sõna pildistamisest ja fotodest", ru: "Пару слов о съёмке и фотографиях" },
  "rv.send": { en: "Send review", et: "Saada arvustus", ru: "Отправить отзыв" },
  "rv.thanks1": { en: "Thank you.", et: "Aitäh.", ru: "Спасибо." },
  "rv.thanks2": { en: "Your review means a lot. It will appear on the website after a quick check.", et: "Sinu arvustus on väga oluline. See ilmub kodulehele pärast kiiret ülevaatust.", ru: "Ваш отзыв очень важен. Он появится на сайте после быстрой проверки." },
  "nf.meta": { en: "404", et: "404", ru: "404" },
  "nf.t1": { en: "Nothing", et: "Siin pole", ru: "Здесь" },
  "nf.t2": { en: "in this frame.", et: "midagi.", ru: "ничего нет." },
  "nf.p": { en: "This page doesn’t exist or has moved. The work is still where it was.", et: "Seda lehte pole või see on liikunud. Tööd on endiselt alles.", ru: "Такой страницы нет или она переехала. Работы — на своём месте." },
  "nf.home": { en: "Back to the website", et: "Tagasi kodulehele", ru: "На главную" },
  "err.meta": { en: "Error", et: "Viga", ru: "Ошибка" },
  "err.t1": { en: "Something went", et: "Midagi läks", ru: "Что-то пошло" },
  "err.t2": { en: "sideways.", et: "viltu.", ru: "не так." },
  "err.p": { en: "The page didn’t load this time. Try again in a moment — or head back to the start.", et: "Leht seekord ei laadinud. Proovi hetke pärast uuesti või mine algusesse.", ru: "Страница не загрузилась. Попробуйте ещё раз чуть позже — или вернитесь на главную." },
  "err.retry": { en: "Try again", et: "Proovi uuesti", ru: "Попробовать снова" },
  "err.home": { en: "Home", et: "Avaleht", ru: "Главная" },
  "rv.fail": { en: "Could not send the review", et: "Arvustust ei õnnestunud saata", ru: "Не удалось отправить отзыв" },
} satisfies Record<string, Entry>;

export type Key = keyof typeof D;

/** Plural forms: English/Estonian one/other, Russian one/few/many. */
export function plural(lang: Lang, n: number, forms: { en: [string, string]; et: [string, string]; ru: [string, string, string] }) {
  if (lang === "ru") {
    const m10 = n % 10, m100 = n % 100;
    return forms.ru[m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2];
  }
  return forms[lang][n === 1 ? 0 : 1];
}
export const PHOTOS = { en: ["photo", "photos"], et: ["foto", "fotot"], ru: ["фото", "фото", "фото"] } as const satisfies Parameters<typeof plural>[2];
export const FRAMES = { en: ["frame", "frames"], et: ["kaader", "kaadrit"], ru: ["кадр", "кадра", "кадров"] } as const satisfies Parameters<typeof plural>[2];
export const FILMS = { en: ["film", "films"], et: ["film", "filmi"], ru: ["фильм", "фильма", "фильмов"] } as const satisfies Parameters<typeof plural>[2];

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; p: (n: number, forms: Parameters<typeof plural>[2]) => string };
const I18n = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => D[k].en, p: (n, f) => plural("en", n, f) });
export const useI18n = () => useContext(I18n);

export function I18nProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setState] = useState<Lang>(initial);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // ?lang=xx in a shared link is remembered for the next visits too.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isLang(q)) {
      setState(q);
      try { document.cookie = `lang=${q}; path=/; max-age=31536000; samesite=lax`; } catch { /* ignore */ }
    }
  }, []);
  const setLang = useCallback((l: Lang) => {
    setState(l);
    try { document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`; } catch { /* ignore */ }
  }, []);
  const t = useCallback((k: Key) => D[k]?.[lang] ?? D[k]?.en ?? k, [lang]);
  const p = useCallback((n: number, forms: Parameters<typeof plural>[2]) => plural(lang, n, forms), [lang]);
  return <I18n.Provider value={{ lang, setLang, t, p }}>{children}</I18n.Provider>;
}

/** Category title in the current language (falls back to the content title). */
/** A dictionary entry by key, outside React (page titles for Google). */
export function translateKey(lang: Lang, key: string, fallback: string) {
  const row = (D as Record<string, Entry>)[key];
  return row?.[lang] ?? fallback;
}

/** Language plus the site's own address (for links that tell Google about the other languages). */
export const getSiteInfo = createServerFn({ method: "GET" }).handler(async (): Promise<{ lang: Lang; origin: string }> => {
  let origin = "";
  try { const { getRequest } = await import("@tanstack/react-start/server"); origin = new URL(getRequest().url).origin; } catch { /* static */ }
  return { lang: await getLang(), origin };
});

export function useCategoryTitle() {
  const { t } = useI18n();
  return (slug: string, fallback: string) => {
    const k = `cat.${slug}` as Key;
    return k in D ? t(k) : fallback;
  };
}

/** Small EN · ET · RU switcher. */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={className} role="group" aria-label="Language">
      {LANGS.map((l, i) => (
        <span key={l.id}>
          {i > 0 && <span aria-hidden className="mx-1.5 opacity-40">·</span>}
          <button
            type="button"
            onClick={() => setLang(l.id)}
            aria-pressed={lang === l.id}
            className={lang === l.id ? "opacity-100" : "opacity-50 transition-opacity hover:opacity-90"}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
