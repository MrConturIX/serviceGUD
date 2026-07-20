-- ============================================================
--  GUD Autoserviss — отзывы для сайта
--  Запусти этот скрипт целиком в Supabase → SQL Editor → Run.
--  Он создаёт таблицу отзывов и настраивает доступ безопасно:
--    • любой посетитель может ОСТАВИТЬ отзыв;
--    • все видят опубликованные отзывы БЕЗ чужих e-mail;
--    • e-mail сохраняется, но наружу не отдаётся.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Таблица отзывов
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,   -- имя и фамилия
  email      text not null,   -- почта (для связи, НЕ публикуется)
  service    text not null,   -- с чем помогли
  comment    text not null,   -- комментарий
  approved   boolean not null default true,   -- см. «модерация» ниже
  constraint reviews_len check (
    char_length(name)    between 2 and 80  and
    char_length(email)   between 5 and 120 and
    char_length(service) between 2 and 120 and
    char_length(comment) between 3 and 2000
  )
);

-- 2) Включаем защиту строк
alter table public.reviews enable row level security;

-- 3) Разрешаем посетителям сайта ОСТАВЛЯТЬ отзыв (роль anon = публичный ключ)
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert
  on public.reviews
  for insert
  to anon
  with check (true);

grant insert (name, email, service, comment) on public.reviews to anon;

-- 4) Публичное чтение БЕЗ e-mail — через отдельное представление.
--    Прямого доступа к таблице у посетителей нет (нет политики SELECT),
--    поэтому вытащить e-mail через API невозможно.
create or replace view public.reviews_public as
  select id, created_at, name, service, comment
  from public.reviews
  where approved = true;

grant select on public.reviews_public to anon;

-- ============================================================
--  ГОТОВО. Дальше — по желанию:
--
--  МОДЕРАЦИЯ (чтобы отзыв появлялся только после твоей проверки):
--    alter table public.reviews alter column approved set default false;
--  Тогда новые отзывы будут скрыты, пока ты не откроешь их вручную:
--    Supabase → Table editor → reviews → поставить approved = true.
--
--  УДАЛИТЬ отзыв: в Table editor удали строку, либо:
--    delete from public.reviews where id = '...';
-- ============================================================
