create schema if not exists doodle_storybook_db;

create table if not exists doodle_storybook_db.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  agreed_terms_of_service boolean not null default false,
  agreed_adult_payer boolean not null default false,
  agreed_no_direct_child_data_collection boolean not null default false,
  required_agreements_version text not null default '2026-02-24',
  required_agreements_accepted_at timestamptz,
  profile_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists touch_account_profiles_updated_at on doodle_storybook_db.account_profiles;
create trigger touch_account_profiles_updated_at
before update on doodle_storybook_db.account_profiles
for each row
execute function doodle_storybook_db.touch_updated_at();

alter table doodle_storybook_db.account_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'doodle_storybook_db'
      and tablename = 'account_profiles'
      and policyname = 'account_profiles_select_own'
  ) then
    create policy account_profiles_select_own
      on doodle_storybook_db.account_profiles
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'doodle_storybook_db'
      and tablename = 'account_profiles'
      and policyname = 'account_profiles_insert_own'
  ) then
    create policy account_profiles_insert_own
      on doodle_storybook_db.account_profiles
      for insert
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'doodle_storybook_db'
      and tablename = 'account_profiles'
      and policyname = 'account_profiles_update_own'
  ) then
    create policy account_profiles_update_own
      on doodle_storybook_db.account_profiles
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;
