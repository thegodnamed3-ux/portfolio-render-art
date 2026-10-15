create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- The very first account becomes the administrator; later sign-ups get no rights.
create or replace function public.grant_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_first_admin after insert on auth.users
  for each row execute function public.grant_first_admin();

create table public.media (
  id uuid primary key default gen_random_uuid(),
  sm text not null,
  src text not null,
  full_src text not null,
  w int not null,
  h int not null,
  album text,
  origin_category text,
  storage_path text,
  created_at timestamptz not null default now()
);

create table public.photoshoots (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null default 'Untitled session',
  album text,
  cover_media_id uuid references public.media(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photoshoot_images (
  photoshoot_id uuid not null references public.photoshoots(id) on delete cascade,
  media_id uuid not null references public.media(id) on delete cascade,
  position int not null default 0,
  primary key (photoshoot_id, media_id)
);
create index on public.photoshoot_images (media_id);
create index on public.photoshoots (category, sort_order);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger photoshoots_touch before update on public.photoshoots for each row execute function public.touch_updated_at();

grant select on public.media, public.photoshoots, public.photoshoot_images to anon, authenticated;
grant insert, update, delete on public.media, public.photoshoots, public.photoshoot_images to authenticated;
grant all on public.media, public.photoshoots, public.photoshoot_images to service_role;

alter table public.media enable row level security;
alter table public.photoshoots enable row level security;
alter table public.photoshoot_images enable row level security;

create policy "public reads published shoots" on public.photoshoots for select to anon, authenticated using (status = 'published');
create policy "admin manages shoots" on public.photoshoots for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public reads published shoot images" on public.photoshoot_images for select to anon, authenticated
  using (exists (select 1 from public.photoshoots s where s.id = photoshoot_id and s.status = 'published'));
create policy "admin manages shoot images" on public.photoshoot_images for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public reads published media" on public.media for select to anon, authenticated
  using (exists (select 1 from public.photoshoot_images i join public.photoshoots s on s.id = i.photoshoot_id where i.media_id = media.id and s.status = 'published'));
create policy "admin manages media" on public.media for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public reads portfolio files" on storage.objects for select to anon, authenticated using (bucket_id = 'portfolio');
create policy "admin uploads portfolio files" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and public.has_role(auth.uid(),'admin'));
create policy "admin updates portfolio files" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and public.has_role(auth.uid(),'admin'));
create policy "admin deletes portfolio files" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and public.has_role(auth.uid(),'admin'));