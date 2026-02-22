-- Analysis sessions table: stores frame annotations and race data per user
create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  video_name text not null default '',
  sample_interval numeric not null default 1,
  frame_annotations jsonb not null,
  race_data jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Index for listing a user's sessions
create index if not exists analysis_sessions_user_id_idx on public.analysis_sessions(user_id);
create index if not exists analysis_sessions_created_at_idx on public.analysis_sessions(created_at desc);

-- Row Level Security: users can only access their own sessions
alter table public.analysis_sessions enable row level security;

create policy "Users can insert own sessions"
  on public.analysis_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can select own sessions"
  on public.analysis_sessions for select
  using (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.analysis_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.analysis_sessions for delete
  using (auth.uid() = user_id);
