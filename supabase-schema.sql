-- ================================================================
--  iConn — Supabase SQL Schema
--  Paste this entire file into your Supabase SQL Editor and run it
-- ================================================================

create extension if not exists "uuid-ossp";

-- ── PROFILES ────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  bio           text default '',
  status_text   text default 'Hey, I''m on iConn!',
  is_online     boolean default false,
  last_seen     timestamptz default now(),
  created_at    timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- ── CONVERSATIONS ────────────────────────────────────────────────
create table if not exists public.conversations (
  id          uuid default uuid_generate_v4() primary key,
  type        text default 'direct' check (type in ('direct','group')),
  name        text,
  avatar_url  text,
  description text default '',
  created_by  uuid references public.profiles(id),
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);
alter table public.conversations enable row level security;
create policy "conv_select" on public.conversations for select
  using (exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid()));
create policy "conv_insert" on public.conversations for insert with check (auth.role() = 'authenticated');
create policy "conv_update" on public.conversations for update
  using (exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid()));

-- ── CONVERSATION MEMBERS ─────────────────────────────────────────
create table if not exists public.conversation_members (
  id              uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  role            text default 'member' check (role in ('admin','member')),
  joined_at       timestamptz default now(),
  unique(conversation_id, user_id)
);
alter table public.conversation_members enable row level security;
create policy "members_select" on public.conversation_members for select
  using (auth.uid() = user_id or
    exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()));
create policy "members_insert" on public.conversation_members for insert with check (auth.role() = 'authenticated');
create policy "members_delete" on public.conversation_members for delete using (auth.uid() = user_id);

-- ── MESSAGES ─────────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null,
  content         text,
  type            text default 'text' check (type in ('text','image','file','system')),
  file_url        text,
  file_name       text,
  reply_to        uuid references public.messages(id),
  is_edited       boolean default false,
  is_deleted      boolean default false,
  created_at      timestamptz default now()
);
alter table public.messages enable row level security;
create policy "msg_select" on public.messages for select
  using (exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));
create policy "msg_insert" on public.messages for insert
  with check (auth.uid() = sender_id and
    exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));
create policy "msg_update" on public.messages for update using (auth.uid() = sender_id);

-- ── REACTIONS ────────────────────────────────────────────────────
create table if not exists public.reactions (
  id         uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);
alter table public.reactions enable row level security;
create policy "react_select" on public.reactions for select using (auth.role() = 'authenticated');
create policy "react_insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "react_delete" on public.reactions for delete using (auth.uid() = user_id);

-- ── TYPING INDICATORS ───────────────────────────────────────────
create table if not exists public.typing_indicators (
  id              uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  updated_at      timestamptz default now(),
  unique(conversation_id, user_id)
);
alter table public.typing_indicators enable row level security;
create policy "typing_all" on public.typing_indicators for all using (auth.role() = 'authenticated');

-- ── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── UPDATE CONVERSATION TIMESTAMP ON NEW MESSAGE ─────────────────
create or replace function public.bump_conversation()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists on_new_message on public.messages;
create trigger on_new_message after insert on public.messages
  for each row execute procedure public.bump_conversation();

-- ── REALTIME ─────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.typing_indicators;
