-- Optional avatar per review, and a stable key for imported reviews.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_source_key_key ON public.reviews (source_key);

-- The 21 reviews from the original Wfolio site (thegodnamed.wfolio.pro/reviews), in their
-- original order (first = newest), approved. Avatars are bundled in /public/reviews.
INSERT INTO public.reviews (source_key, name, body, avatar_url, status, created_at) VALUES
  ('wfolio-01', $r$Melissa$r$, $r$Gor is a photographer who made me feel so comfortable being in front of the camera, that I completely forgot that I am actually shy, it’s 15 degrees outside, there’s people watching me pose…

Thank you! :) xx$r$, '/reviews/wfolio-01.jpg', 'approved', '2026-10-01 12:00:00+00'),
  ('wfolio-02', $r$Artur Valdna$r$, $r$Luxury service - that's what you get from this professional! Photos were handled very quickly and professionally. In my humble opinion, camera angles were chosen in creative and unconventional manners, and background of the compositions is chosen in a such way to emphasize the color of the vehicle.
I am more than just satisfied with this work!$r$, '/reviews/wfolio-02.jpg', 'approved', '2026-09-30 12:00:00+00'),
  ('wfolio-03', $r$Zanna$r$, $r$Вауууу😻🤤 фотки просто пушка, спасибо большое за твою работу, у тебя талант ❤️🫶🏼$r$, '/reviews/wfolio-03.jpg', 'approved', '2026-09-29 12:00:00+00'),
  ('wfolio-04', $r$Mirtel Palmiste$r$, $r$I wanted to thank youu!!!
I love the photos, so professional!😌
Also I really liked that you created such a great vibe during our session, i felt so comfortable!$r$, '/reviews/wfolio-04.jpg', 'approved', '2026-09-28 12:00:00+00'),
  ('wfolio-05', $r$Ksenia$r$, $r$Сам процесс съемок просто кайф, видно что Гор реально разбирается в том, что делает. Помогает в изящном позирование, сразу видит кадр. Настолько потрясающей съемки у меня еще не было. Фотографии- огонь 🔥, легкая, приятная ретушь, мягкий и яркий свет ид. Пока что, это лучший фотограф, с которым удавалось работать, а у меня опыт не мал)$r$, '/reviews/wfolio-05.jpg', 'approved', '2026-09-27 12:00:00+00'),
  ('wfolio-06', $r$Надежда$r$, $r$Просто невероятная фотосессия! Сменили 3 образа и 3 локации.

Нашли общую волну с Гором и сделали просто бомбу!

Спасибо за фотосессию и шикарные фото 🩷$r$, '/reviews/wfolio-06.jpg', 'approved', '2026-09-26 12:00:00+00'),
  ('wfolio-07', $r$Anastasiia$r$, $r$Фотки огонь 🔥
Получила большое удовольствие от процесса
Превзошли мои ожидания 😍🤩$r$, '/reviews/wfolio-07.jpg', 'approved', '2026-09-25 12:00:00+00'),
  ('wfolio-08', $r$Елена Карпенко$r$, $r$Фотографии красивые и эстетичные, предали мне энергии и сексуальности 🔥🔥🔥😻🥰$r$, '/reviews/wfolio-08.jpg', 'approved', '2026-09-24 12:00:00+00'),
  ('wfolio-09', $r$Youssef Mansour$r$, $r$I've had a great experience with Gor. His photography skills and guidance during the photoshoot has been amazing. I'm very happy with how the results turned out.$r$, '/reviews/wfolio-09.jpg', 'approved', '2026-09-23 12:00:00+00'),
  ('wfolio-10', $r$Ann Force$r$, $r$Я в шоке 🤯 это самые лучшие кадры за всю мою жизнь 🥹 чуть не заплакала когда себя такую увидела 😨🥹$r$, '/reviews/wfolio-10.jpg', 'approved', '2026-09-22 12:00:00+00'),
  ('wfolio-11', $r$Vanessa Ber$r$, $r$Как всегда, безумно довольна работой Гора!
Умеет видеть лучшие ракурсы, позы, свет.
Обработка фотографий так-же великолепна.
Советую от всей души, если и идти на съемку, то только к нему! 🔥$r$, '/reviews/wfolio-11.jpg', 'approved', '2026-09-21 12:00:00+00'),
  ('wfolio-12', $r$Bogdana Oliinyk$r$, $r$Хочу выразить огромную благодарность Гору за потрясающую фотосессию! Все фотографии получились просто идеальными. Твой профессионализм, творческий подход и умение находить идеальные ракурсы действительно впечатляют. Во время съемки я чувствовала себя комфортно и уверенно, что очень важно для получения отличных снимков. Буду с радостью рекомендовать тебя всем своим друзьям и знакомым. Спасибо большое за твою работу и за то, что помог сохранить такие замечательные моменты✨🥰🫶$r$, '/reviews/wfolio-12.jpg', 'approved', '2026-09-20 12:00:00+00'),
  ('wfolio-13', $r$Диана$r$, $r$Огонь! Восторг! Экстаз! Фотограф мастер своего дела:)$r$, '/reviews/wfolio-13.jpg', 'approved', '2026-09-19 12:00:00+00'),
  ('wfolio-14', $r$Elizaveta$r$, $r$спасибо большое за такие красивые и эстетичные кадры!✨🥰🥹$r$, '/reviews/wfolio-14.jpg', 'approved', '2026-09-18 12:00:00+00'),
  ('wfolio-15', $r$Yeva Lunina$r$, $r$Гор прекрасный фотограф, умеет направить, поправить, подсказать. Съемка проходила максимально комфортно, очень хорошо, когда вы с фотографом видите одинаково)) фотографии получились шикарные, отличная обработка. Мне очень понравился и сам процесс съемки и итоговый результат!)$r$, '/reviews/wfolio-15.jpg', 'approved', '2026-09-17 12:00:00+00'),
  ('wfolio-16', $r$Alissia$r$, $r$Incredible photography and very warm and professional approach, I really enjoyed the shoot! Because of Gor's open-mindedness, ideas keep flowing and inspiring new ones, you don't feel lost about what you're doing - it comes naturally. Book book book, don't wait!!!$r$, '/reviews/wfolio-16.jpg', 'approved', '2026-09-16 12:00:00+00'),
  ('wfolio-17', $r$Vanessa Ber$r$, $r$Я в шоке от фотографий!
Работа выполнена на высшем уровне.
Уже давно хожу на съемки к Гору, и всегда безумно довольна результатом.$r$, '/reviews/wfolio-17.jpg', 'approved', '2026-09-15 12:00:00+00'),
  ('wfolio-18', $r$Sandra Süsi$r$, $r$Absoluutselt imelised pildid, love it!$r$, '/reviews/wfolio-18.jpg', 'approved', '2026-09-14 12:00:00+00'),
  ('wfolio-19', $r$Jelizaveta Slein$r$, $r$Я очень довольна съемкой! Кайфовала в процессе съемки и результат превзошел все ожидания!)$r$, '/reviews/wfolio-19.jpg', 'approved', '2026-09-13 12:00:00+00'),
  ('wfolio-20', $r$Alina Kocharova$r$, $r$Работы просто волшебные!😍 Фотограф профессионал своего дела. У меня не было никакого опыта в фотосъемках, и он сделал просто конфетку ! Буду советовать теперь всем знакомым😍$r$, '/reviews/wfolio-20.jpg', 'approved', '2026-09-12 12:00:00+00'),
  ('wfolio-21', $r$Sandra Süsi$r$, $r$Love it! All the lighting, editing, in my opinion - its just perfect!$r$, '/reviews/wfolio-21.jpg', 'approved', '2026-09-11 12:00:00+00')
ON CONFLICT (source_key) DO NOTHING;
