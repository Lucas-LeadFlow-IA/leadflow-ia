-- =============================================
-- LeadFlow IA - Schéma Supabase
-- =============================================
-- Exécutez ce SQL dans Supabase → SQL Editor
-- =============================================

-- Table utilisateurs (extension de auth.users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text,
  plan text default 'free' check (plan in ('free', 'pro', 'agency')),
  requests_used integer default 0 not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'inactive',
  trial_ends_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table historique des analyses IA
create table if not exists public.history (
  id bigserial primary key,
  user_id uuid references public.users on delete cascade not null,
  module_id text not null,
  module_name text,
  input_data jsonb,
  output text,
  tokens_used integer,
  created_at timestamptz default now()
);

-- Table contacts CRM
create table if not exists public.contacts (
  id bigserial primary key,
  user_id uuid references public.users on delete cascade not null,
  prenom text,
  nom text,
  email text,
  telephone text,
  entreprise text,
  fonction text,
  secteur text,
  statut text default 'prospect' check (statut in ('prospect', 'qualifie', 'demo', 'proposition', 'negotiation', 'gagne', 'perdu')),
  score_bant integer,
  source text,
  notes text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table résultats sauvegardés
create table if not exists public.saved_results (
  id bigserial primary key,
  user_id uuid references public.users on delete cascade not null,
  module_id text not null,
  name text not null,
  result text not null,
  input_data jsonb,
  created_at timestamptz default now()
);

-- Index pour les requêtes fréquentes
create index if not exists history_user_id_idx on public.history(user_id);
create index if not exists history_created_at_idx on public.history(created_at desc);
create index if not exists contacts_user_id_idx on public.contacts(user_id);
create index if not exists saved_results_user_id_idx on public.saved_results(user_id);

-- Mise à jour automatique du champ updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute function update_updated_at();

create trigger contacts_updated_at before update on public.contacts
  for each row execute function update_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================
alter table public.users enable row level security;
alter table public.history enable row level security;
alter table public.contacts enable row level security;
alter table public.saved_results enable row level security;

-- Policies
create policy "users_own_data" on public.users for all using (auth.uid() = id);
create policy "history_own_data" on public.history for all using (auth.uid() = user_id);
create policy "contacts_own_data" on public.contacts for all using (auth.uid() = user_id);
create policy "saved_results_own_data" on public.saved_results for all using (auth.uid() = user_id);

-- =============================================
-- Trigger automatique pour nouveaux users
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- Fonctions utilitaires
-- =============================================

-- Mettre à jour le plan utilisateur après paiement Stripe
create or replace function public.update_user_plan(new_plan text)
returns void as $$
begin
  update public.users 
  set plan = new_plan, updated_at = now()
  where id = auth.uid();
end;
$$ language plpgsql security definer;

-- Incrémenter les requêtes utilisées
create or replace function public.increment_requests()
returns void as $$
begin
  update public.users 
  set requests_used = requests_used + 1, updated_at = now()
  where id = auth.uid();
end;
$$ language plpgsql security definer;

-- Reset les requêtes mensuelles (à exécuter via un cron job)
create or replace function public.reset_monthly_requests()
returns void as $$
begin
  update public.users 
  set requests_used = 0, updated_at = now()
  where plan != 'free';
end;
$$ language plpgsql security definer;