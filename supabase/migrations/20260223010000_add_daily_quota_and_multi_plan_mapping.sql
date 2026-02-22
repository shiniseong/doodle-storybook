alter table if exists doodle_storybook_db.usage_quotas
  add column if not exists daily_story_quota_used integer not null default 0;

alter table if exists doodle_storybook_db.usage_quotas
  add column if not exists daily_story_quota_date date;

alter table if exists doodle_storybook_db.usage_quotas
  drop constraint if exists usage_quotas_daily_story_quota_used_check;

alter table if exists doodle_storybook_db.usage_quotas
  add constraint usage_quotas_daily_story_quota_used_check
  check (daily_story_quota_used >= 0);

update doodle_storybook_db.subscriptions
set plan_code = 'standard'
where plan_code = 'monthly_unlimited_6900_krw';
