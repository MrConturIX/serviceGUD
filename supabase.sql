-- ============================================================
--  GUD Autoserviss — база для сайта (отзывы + онлайн-запись)
--  Запусти этот скрипт целиком: Supabase → SQL Editor → Run.
--  Запускать можно повторно — существующие таблицы не пострадают.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
--  1) ОТЗЫВЫ
-- ============================================================
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,   -- имя и фамилия
  email      text not null,   -- почта (для связи, НЕ публикуется)
  service    text not null,   -- с чем помогли
  comment    text not null,   -- комментарий
  approved   boolean not null default true,
  constraint reviews_len check (
    char_length(name)    between 2 and 80  and
    char_length(email)   between 5 and 120 and
    char_length(service) between 2 and 120 and
    char_length(comment) between 3 and 2000
  )
);

alter table public.reviews enable row level security;

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to anon with check (true);

grant insert (name, email, service, comment) on public.reviews to anon;

-- публичное чтение отзывов БЕЗ e-mail
create or replace view public.reviews_public as
  select id, created_at, name, service, comment
  from public.reviews
  where approved = true;

grant select on public.reviews_public to anon;

-- ============================================================
--  2) ОНЛАЙН-ЗАПИСЬ (заявки клиентов)
--     Заявки видит только владелец в Supabase → Table editor.
--     Посетители сайта могут только оставить заявку, читать чужие — нет.
-- ============================================================
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  service     text not null,   -- выбранная услуга
  visit_date  date,            -- желаемая дата
  visit_time  text,            -- желаемое время
  name        text not null,   -- имя и фамилия
  phone       text not null,   -- телефон
  car         text,            -- марка/модель авто (необязательно)
  comment     text,            -- комментарий (необязательно)
  status      text not null default 'new',   -- new / confirmed / done / cancelled
  constraint bookings_len check (
    char_length(name)    between 2 and 80  and
    char_length(phone)   between 5 and 40  and
    char_length(service) between 2 and 120
  )
);

alter table public.bookings enable row level security;

drop policy if exists bookings_insert on public.bookings;
create policy bookings_insert on public.bookings
  for insert to anon with check (true);

grant insert (service, visit_date, visit_time, name, phone, car, comment) on public.bookings to anon;

create index if not exists bookings_created_idx on public.bookings (created_at desc);

-- ============================================================
--  ГОТОВО.
--
--  ЗАЯВКИ смотри в Supabase → Table editor → bookings.
--    Отработал заявку — поставь status = 'done' (или 'confirmed').
--
--  МОДЕРАЦИЯ ОТЗЫВОВ (по желанию — показывать только проверенные):
--    alter table public.reviews alter column approved set default false;
--    затем одобряй вручную: Table editor → reviews → approved = true.
-- ============================================================
