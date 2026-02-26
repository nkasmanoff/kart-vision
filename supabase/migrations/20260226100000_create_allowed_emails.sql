-- Allowlist table: only emails in this table can create an account.
-- Manage entries directly in the Supabase dashboard Table Editor.

create table if not exists public.allowed_emails (
  email       text        primary key,   -- stored lowercase
  created_at  timestamptz not null default now()
);

-- The sign-up server action runs with the anon key and needs to check this
-- table before calling auth.signUp().  Read-only access for everyone is fine
-- because (a) the check is server-side and cannot be bypassed, and (b) the
-- table holds no sensitive data beyond whether an email is approved.
alter table public.allowed_emails enable row level security;

create policy "Anyone can check the allowlist"
  on public.allowed_emails for select
  using (true);
