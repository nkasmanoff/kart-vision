-- Create a dedicated frames table to replace the frame_annotations JSONB column.
-- Each row is one extracted frame from an analysis session.

create table if not exists public.frames (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.analysis_sessions(id) on delete cascade,
  frame_index  integer     not null,          -- 0-based order; maps to storage path {frame_index}_thumb.jpg
  timestamp    numeric     not null,          -- seconds from start of video
  scene        text,                          -- 'in_race' | 'not_in_race' | null
  position     text,                          -- '1'..'12', 'x' (unknown), or null
  coins        smallint,                      -- 0..20 or null
  events       text[]      not null default '{}',

  constraint frames_session_frame_unique unique (session_id, frame_index)
);

create index if not exists frames_session_id_idx
  on public.frames (session_id);

create index if not exists frames_session_id_frame_index_idx
  on public.frames (session_id, frame_index);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Ownership is determined via the parent analysis_sessions row.

alter table public.frames enable row level security;

create policy "Users can insert their own frames"
  on public.frames for insert
  with check (
    exists (
      select 1 from public.analysis_sessions
      where id = session_id and user_id = auth.uid()
    )
  );

create policy "Users can select their own frames"
  on public.frames for select
  using (
    exists (
      select 1 from public.analysis_sessions
      where id = session_id and user_id = auth.uid()
    )
  );

create policy "Users can update their own frames"
  on public.frames for update
  using (
    exists (
      select 1 from public.analysis_sessions
      where id = session_id and user_id = auth.uid()
    )
  );

create policy "Users can delete their own frames"
  on public.frames for delete
  using (
    exists (
      select 1 from public.analysis_sessions
      where id = session_id and user_id = auth.uid()
    )
  );

-- ── Data migration ────────────────────────────────────────────────────────────
-- Copy every frame out of the frame_annotations JSONB blob into the new table.
-- frame_index is derived from the element's order in the JSON array, which
-- matches the storage file names ({frame_index}_thumb.jpg / _hires.jpg).

insert into public.frames (session_id, frame_index, timestamp, scene, position, coins, events)
select
  s.id                                                          as session_id,
  (row_number() over (
    partition by s.id
    order by (f.value->>'timestamp')::numeric
  ) - 1)::integer                                              as frame_index,
  (f.value->>'timestamp')::numeric                             as timestamp,
  nullif(f.value->>'scene', '')                                as scene,
  nullif(f.value->>'position', '')                             as position,
  case
    when (f.value->>'coins') is null then null
    else (f.value->>'coins')::smallint
  end                                                          as coins,
  coalesce(
    array(select jsonb_array_elements_text(f.value->'events')),
    array[]::text[]
  )                                                            as events
from
  public.analysis_sessions s
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(s.frame_annotations->'frames') = 'array'
        then s.frame_annotations->'frames'
      else '[]'::jsonb
    end
  ) as f(value)
where
  s.frame_annotations is not null
  and jsonb_typeof(s.frame_annotations->'frames') = 'array'
  and jsonb_array_length(s.frame_annotations->'frames') > 0;

-- ── Clean up ──────────────────────────────────────────────────────────────────
-- The frame_annotations column is now redundant; drop it to reclaim space
-- and keep the schema clean.  The total_frames / labeled_frames counts it
-- held are easily re-derived from the frames table when needed.

alter table public.analysis_sessions
  drop column if exists frame_annotations;
