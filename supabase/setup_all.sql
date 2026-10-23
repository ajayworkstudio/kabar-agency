-- One-shot setup: 001_init + 002_agency. Paste into Supabase SQL Editor and Run once.

-- Kabar Agency — initial schema
-- Run in Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- Where news comes from, and how healthy each feed is
create table sources (
  id text primary key,                 -- e.g. 'antara-terkini'
  outlet text not null,                -- e.g. 'Antara' (independence is counted per outlet)
  url text not null,
  kind text not null default 'rss',    -- rss | google_news | trends
  category text,                       -- politik | olahraga | hiburan | umum | ekonomi | teknologi
  enabled boolean not null default true,
  last_ok_at timestamptz,
  last_error text,
  last_item_count int default 0
);

-- One row per article seen in a feed
create table articles (
  id uuid primary key default gen_random_uuid(),
  source_id text references sources(id) on delete set null,
  outlet text not null,
  url text not null unique,
  title text not null,
  snippet text,
  body_excerpt text,                   -- extracted text, used ONLY to ground the writer; never republished
  category text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  story_id uuid
);
create index on articles (published_at desc);
create index on articles (story_id);

-- A story = several articles about the same event
create table stories (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  category text not null default 'umum',
  outlet_count int not null default 1,
  article_count int not null default 1,
  trend_score numeric not null default 0,  -- boost from Google Trends match
  heat numeric not null default 0,         -- ranking score (sources, velocity, recency, trends)
  status text not null default 'developing', -- developing | confirmed | drafted | skipped
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  keywords text[] not null default '{}'
);
create index on stories (heat desc);
create index on stories (status, last_seen_at desc);
alter table articles add constraint articles_story_fk foreign key (story_id) references stories(id) on delete set null;

-- Trending searches (Google Trends ID)
create table trends (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  traffic text,
  seen_at timestamptz not null default now(),
  unique (term, seen_at)
);
create index on trends (seen_at desc);

-- One draft package per story: all formats for all platforms
create table drafts (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references stories(id) on delete cascade,
  status text not null default 'pending',
    -- pending → approved → rendering → scheduled → publishing → published
    -- or rejected / failed
  hook text,
  content jsonb not null,              -- see src/lib/types.ts DraftContent
  fact_check jsonb,                    -- {verdict, issues[]}
  card_urls text[] not null default '{}',
  video_url text,
  -- which outputs to publish, as "platform:format"
  targets text[] not null default '{instagram:carousel,threads:text,tiktok:video,youtube:short}',
  scheduled_for timestamptz,
  approved_at timestamptz,
  error text,
  telegram_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on drafts (status, scheduled_for);

-- What actually went out, per platform
create table posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references drafts(id) on delete cascade,
  platform text not null,              -- instagram | threads | tiktok | youtube
  format text not null,                -- carousel | text | reel | short | video
  status text not null default 'pending', -- pending | published | failed
  external_id text,
  permalink text,
  error text,
  published_at timestamptz,
  metrics jsonb not null default '{}', -- {views, likes, comments, shares, saves}
  metrics_at timestamptz,
  unique (draft_id, platform, format)
);

-- Platform tokens that get refreshed by cron (env vars are the initial seed)
create table platform_tokens (
  platform text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Simple run log shown on the dashboard
create table runs (
  id bigserial primary key,
  job text not null,
  ok boolean not null,
  summary text,
  started_at timestamptz not null default now(),
  duration_ms int
);
create index on runs (started_at desc);

-- Everything is accessed server-side with the service role key.
alter table sources enable row level security;
alter table articles enable row level security;
alter table stories enable row level security;
alter table trends enable row level security;
alter table drafts enable row level security;
alter table posts enable row level security;
alter table platform_tokens enable row level security;
alter table runs enable row level security;

-- Public bucket for media that the platform APIs download by URL
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;
-- Agency: bot employees, their tasks, and daily reports.
-- Run after 001_init.sql.

-- Bot employees. Their settings actually drive the pipeline:
-- which categories they cover, which platforms they publish to, thresholds, report time.
create table agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  role text not null,
  color text not null default '#5E6AD2',
  status text not null default 'active',          -- active | paused
  platforms text[] not null default '{instagram:carousel,threads:text,tiktok:video,youtube:short}',
  categories text[] not null default '{}',         -- empty = all categories
  responsibilities text[] not null default '{}',   -- free-text job description shown on the profile
  settings jsonb not null default '{"minSources":2,"minSourcesPolitics":3,"maxDraftsPerDay":12,"reportHour":7}',
  created_at timestamptz not null default now()
);

-- Every unit of work a bot does (or the admin assigns) is a task
create table tasks (
  id uuid primary key default gen_random_uuid(),
  number serial,                                   -- short id shown as AGN-12
  agent_id uuid references agents(id) on delete set null,
  kind text not null,                              -- draft | research | report | manual
  title text not null,
  description text,
  status text not null default 'todo',             -- backlog | todo | in_progress | in_review | done | failed | canceled
  priority int not null default 0,                 -- 0 none, 1 urgent, 2 high, 3 medium, 4 low
  draft_id uuid references drafts(id) on delete set null,
  payload jsonb not null default '{}',             -- e.g. {"query": "harga beras"} for research
  result jsonb,
  error text,
  created_by text not null default 'system',       -- system | admin
  due_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index on tasks (status, created_at desc);
create index on tasks (agent_id, created_at desc);
create index on tasks (draft_id);

-- One report per bot per day: what it found, drafted and published
create table reports (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  day date not null,                               -- WIB date
  title text not null,
  summary text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (agent_id, day)
);

alter table drafts add column agent_id uuid references agents(id) on delete set null;
create index on drafts (agent_id);

alter table agents enable row level security;
alter table tasks enable row level security;
alter table reports enable row level security;

-- The first employee
insert into agents (slug, name, role, color, platforms, categories, responsibilities)
values (
  'raka',
  'Raka',
  'Editor Berita Sosial Media',
  '#5E6AD2',
  '{instagram:carousel,threads:text,tiktok:video,youtube:short}',
  '{}',
  '{"Memantau 20+ sumber berita nasional dan Google Trends setiap 20 menit",
    "Memverifikasi setiap berita minimal ke 2 outlet (politik 3 outlet)",
    "Menulis draft carousel, caption, Threads, dan skrip video",
    "Mengajukan draft ke admin untuk disetujui sebelum terbit",
    "Mengirim laporan harian berita terbaru setiap pukul 07.00 WIB"}'
)
on conflict (slug) do nothing;
