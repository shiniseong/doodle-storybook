create schema if not exists doodle_storybook_db;

create table if not exists doodle_storybook_db.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'polar' check (provider = 'polar'),
  status text not null default 'incomplete' check (
    status = any (array['trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid'])
  ),
  plan_code text not null default 'monthly_unlimited_6900_krw',
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider_customer_id text,
  provider_subscription_id text,
  last_webhook_event_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_user_id_idx
  on doodle_storybook_db.subscriptions(user_id);

create unique index if not exists subscriptions_provider_subscription_id_key
  on doodle_storybook_db.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;

create table if not exists doodle_storybook_db.usage_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  free_story_quota_total integer not null default 2 check (free_story_quota_total >= 0),
  free_story_quota_used integer not null default 0 check (free_story_quota_used >= 0),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists doodle_storybook_db.polar_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null default '{}'::jsonb
);

create or replace function doodle_storybook_db.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_subscriptions_updated_at on doodle_storybook_db.subscriptions;
create trigger touch_subscriptions_updated_at
before update on doodle_storybook_db.subscriptions
for each row
execute function doodle_storybook_db.touch_updated_at();

drop trigger if exists touch_usage_quotas_updated_at on doodle_storybook_db.usage_quotas;
create trigger touch_usage_quotas_updated_at
before update on doodle_storybook_db.usage_quotas
for each row
execute function doodle_storybook_db.touch_updated_at();

alter table doodle_storybook_db.subscriptions enable row level security;
alter table doodle_storybook_db.usage_quotas enable row level security;
alter table doodle_storybook_db.polar_webhook_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'doodle_storybook_db'
      and tablename = 'subscriptions'
      and policyname = 'subscriptions_select_own'
  ) then
    create policy subscriptions_select_own
      on doodle_storybook_db.subscriptions
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
      and tablename = 'usage_quotas'
      and policyname = 'usage_quotas_select_own'
  ) then
    create policy usage_quotas_select_own
      on doodle_storybook_db.usage_quotas
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

insert into doodle_storybook_db.usage_quotas (user_id)
select u.id
from auth.users u
on conflict (user_id) do nothing;

with completed_counts as (
  select s.user_id, least(2, count(*))::integer as used_count
  from doodle_storybook_db.storybooks s
  where s.status = 'completed'
  group by s.user_id
)
update doodle_storybook_db.usage_quotas q
set
  free_story_quota_used = coalesce(c.used_count, 0),
  updated_at = timezone('utc', now())
from auth.users u
left join completed_counts c
  on c.user_id = u.id
where q.user_id = u.id;
