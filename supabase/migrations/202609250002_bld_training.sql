-- 3BLD training extension. Designed to coexist with the evidence-aware CubeIQ schema.
create type public.bld_solve_result as enum ('success', 'dnf');

create table public.lettering_schemes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Speffz', orientation jsonb not null default '{"up":"U","front":"F"}',
  edge_buffer text not null, corner_buffer text not null, edge_method text not null default 'm2',
  corner_method text not null default 'old-pochmann', settings jsonb not null default '{}',
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create unique index one_active_lettering_scheme_per_user on public.lettering_schemes(user_id) where is_active;

create table public.sticker_labels (
  scheme_id uuid not null references public.lettering_schemes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, physical_sticker_id text not null,
  piece_type text not null check(piece_type in ('edge','corner')), token text not null check(char_length(token) between 1 and 12),
  primary key(scheme_id,physical_sticker_id), foreign key(scheme_id,user_id) references public.lettering_schemes(id,user_id)
);

create table public.letter_pairs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  first_sticker_id text not null, second_sticker_id text not null, first_token text not null, second_token text not null,
  primary_mnemonic text not null default '', encounters integer not null default 0 check(encounters>=0),
  forgotten integer not null default 0 check(forgotten>=0 and forgotten<=encounters),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,first_sticker_id,second_sticker_id), unique(id,user_id)
);
create table public.letter_pair_aliases (
  id bigint generated always as identity primary key, pair_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  mnemonic text not null check(char_length(trim(mnemonic))>0), foreign key(pair_id,user_id) references public.letter_pairs(id,user_id) on delete cascade,
  unique(pair_id,mnemonic)
);

create table public.bld_solves (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  scramble text not null, memo_ms integer not null check(memo_ms>=0), execution_ms integer not null check(execution_ms>=0),
  total_ms integer not null check(total_ms=memo_ms+execution_ms), result public.bld_solve_result not null,
  corner_memo jsonb not null default '[]', edge_memo jsonb not null default '[]', cycle_breaks jsonb not null default '{"edges":[],"corners":[]}',
  scheme_snapshot jsonb, created_at timestamptz not null default now()
);
create table public.practice_attempts (
  id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('flashcard','memo')), pair_id uuid references public.letter_pairs(id) on delete set null,
  correct boolean not null, accuracy real check(accuracy between 0 and 1), details jsonb not null default '{}', created_at timestamptz not null default now()
);

create trigger lettering_schemes_touch before update on public.lettering_schemes for each row execute function public.touch_updated_at();
create trigger letter_pairs_touch before update on public.letter_pairs for each row execute function public.touch_updated_at();
create index bld_solves_user_created on public.bld_solves(user_id,created_at desc);
create index letter_pairs_user on public.letter_pairs(user_id);

alter table public.lettering_schemes enable row level security; alter table public.sticker_labels enable row level security;
alter table public.letter_pairs enable row level security; alter table public.letter_pair_aliases enable row level security;
alter table public.bld_solves enable row level security; alter table public.practice_attempts enable row level security;
create policy lettering_owner on public.lettering_schemes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy labels_owner on public.sticker_labels for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy pairs_owner on public.letter_pairs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy aliases_owner on public.letter_pair_aliases for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy bld_solves_owner on public.bld_solves for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy attempts_owner on public.practice_attempts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
