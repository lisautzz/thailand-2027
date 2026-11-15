-- =========================================================
-- SUPABASE-EINRICHTUNG für die Reiseseite
-- Einmal komplett im SQL Editor ausführen (Supabase → SQL Editor → New query).
--
-- Idee: Eine Tabelle "app_state" speichert pro Liste eine Zeile,
-- z. B. key = 'todos', value = [ ...alle To-dos als JSON... ].
-- Das sind genau die Einträge, die vorher im Browser (localStorage) lagen.
-- =========================================================

-- 1) Die Daten-Tabelle
create table if not exists public.app_state (
  key        text primary key,                 -- z. B. 'todos', 'expenses', 'blocks'
  value      jsonb not null,                   -- die komplette Liste als JSON
  updated_at timestamptz not null default now(),
  updated_by text                              -- E-Mail, wer zuletzt gespeichert hat
);

-- 2) Wer darf rein? Nur E-Mail-Adressen aus dieser Liste.
--    Die Liste selbst ist von außen nicht lesbar (keine Policies = kein Zugriff).
create table if not exists public.allowed_emails (
  email text primary key
);

-- 3) Hilfsfunktion: Ist der eingeloggte Nutzer auf der Liste?
--    "security definer" = darf die Liste lesen, obwohl Nutzer das nicht dürfen.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- 4) Row Level Security einschalten – ohne Policy darf niemand etwas
alter table public.app_state enable row level security;
alter table public.allowed_emails enable row level security;

-- 5) Policies: Nur eingeloggte Mitglieder dürfen lesen und schreiben
drop policy if exists "Mitglieder lesen" on public.app_state;
create policy "Mitglieder lesen" on public.app_state
  for select to authenticated
  using (public.is_member());

drop policy if exists "Mitglieder anlegen" on public.app_state;
create policy "Mitglieder anlegen" on public.app_state
  for insert to authenticated
  with check (public.is_member());

drop policy if exists "Mitglieder ändern" on public.app_state;
create policy "Mitglieder ändern" on public.app_state
  for update to authenticated
  using (public.is_member())
  with check (public.is_member());

-- (Löschen ist nicht nötig: Die Seite überschreibt Listen nur.)

-- 6) Live-Updates einschalten: Änderungen werden an alle offenen Seiten geschickt
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;

-- =========================================================
-- 7) EURE E-MAIL-ADRESSEN EINTRAGEN
-- Diesen Teil NICHT mit echten Adressen ins Git-Repo committen
-- (das Repo ist öffentlich). Einfach im SQL Editor anpassen und ausführen:
--
-- insert into public.allowed_emails (email) values
--   ('deine@mail.de'),
--   ('michel@mail.de');
-- =========================================================
