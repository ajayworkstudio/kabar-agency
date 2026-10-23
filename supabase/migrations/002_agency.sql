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
