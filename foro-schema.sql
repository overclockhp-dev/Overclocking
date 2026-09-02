-- ============================================================
-- ESQUEMA DEL FORO — Overclock
-- Ejecutar completo en Supabase → SQL Editor
-- ============================================================

-- ---------- 1. REPUTACIÓN DE USUARIOS ----------
create table if not exists public.user_reputation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points int not null default 100,
  report_count int not null default 0,       -- reportes válidos acumulados (nunca se reinicia)
  suspended_until timestamptz,                -- null = no suspendido
  updated_at timestamptz not null default now()
);

-- ---------- 2. PUBLICACIONES DEL FORO ----------
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  tag text not null check (tag in ('general','debate','teoria','arte','pregunta','ayuda')),
  has_spoiler boolean not null default false,
  image_url text,
  image_status text not null default 'none'   -- none | pending_review | approved | flagged_nsfw
    check (image_status in ('none','pending_review','approved','flagged_nsfw')),
  status text not null default 'published'    -- published | pending_review | blocked
    check (status in ('published','pending_review','blocked')),
  normalized_content text not null,           -- contenido normalizado (anti-leetspeak/espaciado), usado para detectar spam
  created_at timestamptz not null default now()
);

create index if not exists idx_forum_posts_tag on public.forum_posts(tag);
create index if not exists idx_forum_posts_author_time on public.forum_posts(author_id, created_at desc);

-- ---------- 3. REPORTES ----------
create table if not exists public.forum_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.forum_posts(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> reported_user_id)
);

create index if not exists idx_forum_reports_pair on public.forum_reports(reporter_id, reported_user_id, created_at desc);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Crear fila de reputación automáticamente para cada usuario nuevo
create or replace function public.ensure_reputation_row()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_reputation(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_new_user_reputation on auth.users;
create trigger trg_new_user_reputation
  after insert on auth.users
  for each row execute function public.ensure_reputation_row();

-- ---------- Bloquear publicación si el usuario está suspendido ----------
create or replace function public.check_not_suspended()
returns trigger language plpgsql security definer as $$
declare
  v_suspended_until timestamptz;
begin
  select suspended_until into v_suspended_until
  from public.user_reputation where user_id = new.author_id;

  if v_suspended_until is not null and v_suspended_until > now() then
    raise exception 'Tu cuenta está suspendida temporalmente hasta que revisemos tu caso.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_not_suspended on public.forum_posts;
create trigger trg_check_not_suspended
  before insert on public.forum_posts
  for each row execute function public.check_not_suspended();

-- ---------- Detección de spam: mismo mensaje repetido ----------
-- Si el mismo autor publica el mismo contenido normalizado 3+ veces
-- en los últimos 15 minutos, se suspende automáticamente.
create or replace function public.detect_repeated_spam()
returns trigger language plpgsql security definer as $$
declare
  v_repeats int;
begin
  select count(*) into v_repeats
  from public.forum_posts
  where author_id = new.author_id
    and normalized_content = new.normalized_content
    and created_at > now() - interval '15 minutes';

  if v_repeats >= 2 then -- este insert sería la 3ra vez
    update public.user_reputation
      set suspended_until = now() + interval '72 hours',
          updated_at = now()
      where user_id = new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_detect_spam on public.forum_posts;
create trigger trg_detect_spam
  before insert on public.forum_posts
  for each row execute function public.detect_repeated_spam();

-- ---------- Reportes: anti-abuso 24h + descuento de reputación cada 3 reportes ----------
create or replace function public.handle_new_report()
returns trigger language plpgsql security definer as $$
declare
  v_recent_report timestamptz;
  v_new_count int;
begin
  -- Regla anti-spam: A no puede reportar a B dos veces en 24h
  select created_at into v_recent_report
  from public.forum_reports
  where reporter_id = new.reporter_id
    and reported_user_id = new.reported_user_id
    and created_at > now() - interval '24 hours'
  order by created_at desc
  limit 1;

  if v_recent_report is not null then
    raise exception 'Ya reportaste a este usuario en las últimas 24 horas.'
      using errcode = 'P0001';
  end if;

  -- Incrementar contador y aplicar descuento cada 3 reportes
  update public.user_reputation
    set report_count = report_count + 1,
        updated_at = now()
    where user_id = new.reported_user_id
    returning report_count into v_new_count;

  if v_new_count is null then
    insert into public.user_reputation(user_id, report_count) values (new.reported_user_id, 1)
    returning report_count into v_new_count;
  end if;

  if v_new_count % 3 = 0 then
    update public.user_reputation
      set points = greatest(points - 15, 0),
          updated_at = now()
      where user_id = new.reported_user_id;

    update public.user_reputation
      set suspended_until = now() + interval '999 years' -- suspensión indefinida hasta revisión manual
      where user_id = new.reported_user_id and points <= 0;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_new_report on public.forum_reports;
create trigger trg_new_report
  before insert on public.forum_reports
  for each row execute function public.handle_new_report();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.forum_posts enable row level security;
alter table public.forum_reports enable row level security;
alter table public.user_reputation enable row level security;

-- forum_posts: cualquiera ve lo publicado; el autor ve también lo suyo en revisión
create policy "ver publicaciones publicadas o propias"
  on public.forum_posts for select
  using (status = 'published' or author_id = auth.uid());

-- El insert directo por el cliente queda deshabilitado a propósito:
-- las publicaciones se crean a través de la Edge Function create-post,
-- que usa la service_role key (bypassa RLS) después de moderar el texto/imagen.
-- Así el filtro de censura no se puede saltar llamando directo a la API.

-- forum_reports: cualquier usuario autenticado puede insertar un reporte
create policy "usuarios autenticados pueden reportar"
  on public.forum_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "nadie lee reportes desde el cliente"
  on public.forum_reports for select
  using (false); -- solo tú (dashboard/service role) los ves

-- user_reputation: cada usuario ve solo su propia reputación
create policy "ver mi propia reputacion"
  on public.user_reputation for select
  using (user_id = auth.uid());

-- ============================================================
-- STORAGE: bucket para imágenes del foro
-- ============================================================
insert into storage.buckets (id, name, public)
values ('forum-images', 'forum-images', true)
on conflict (id) do nothing;

create policy "usuarios autenticados suben imagenes al foro"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'forum-images');

create policy "cualquiera ve imagenes del foro"
  on storage.objects for select
  using (bucket_id = 'forum-images');
