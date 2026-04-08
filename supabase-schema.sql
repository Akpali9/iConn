-- ================================================================
--  iConn — Supabase SQL Schema (Fully Corrected)
-- ================================================================

create extension if not exists "uuid-ossp";

-- ========== 1. CREATE ALL TABLES (no policies yet) ==========

-- Profiles
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

-- Conversations
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

-- Conversation Members (references conversations & profiles)
create table if not exists public.conversation_members (
  id              uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  role            text default 'member' check (role in ('admin','member')),
  joined_at       timestamptz default now(),
  unique(conversation_id, user_id)
);

-- Messages
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

-- Reactions
create table if not exists public.reactions (
  id         uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- Typing Indicators
create table if not exists public.typing_indicators (
  id              uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete cascade,
  updated_at      timestamptz default now(),
  unique(conversation_id, user_id)
);

-- ========== 2. ENABLE ROW LEVEL SECURITY ==========

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.typing_indicators enable row level security;

-- ========== 3. CREATE POLICIES (all tables exist now) ==========

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Conversations
create policy "conv_select" on public.conversations for select
  using (exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid()));
create policy "conv_insert" on public.conversations for insert with check (auth.role() = 'authenticated');
create policy "conv_update" on public.conversations for update
  using (exists (
    select 1 from public.conversation_members
    where conversation_id = id and user_id = auth.uid() and role = 'admin'
  ));

-- Conversation Members
create policy "members_select" on public.conversation_members for select
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id and cm.user_id = auth.uid()
  ));
create policy "members_insert" on public.conversation_members for insert with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.conversation_members
    where conversation_id = conversation_members.conversation_id
      and user_id = auth.uid()
      and role = 'admin'
  )
);
create policy "members_delete" on public.conversation_members for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.conversation_members
    where conversation_id = conversation_members.conversation_id
      and user_id = auth.uid()
      and role = 'admin'
  )
);

-- Messages
create policy "msg_select" on public.messages for select
  using (exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));
create policy "msg_insert" on public.messages for insert
  with check (auth.uid() = sender_id and
    exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid()));
create policy "msg_update" on public.messages for update using (auth.uid() = sender_id);

-- Reactions
create policy "react_select" on public.reactions for select using (auth.role() = 'authenticated');
create policy "react_insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "react_delete" on public.reactions for delete using (auth.uid() = user_id);

-- Typing Indicators
create policy "typing_select" on public.typing_indicators for select using (auth.role() = 'authenticated');
create policy "typing_insert" on public.typing_indicators for insert with check (auth.uid() = user_id);
create policy "typing_update" on public.typing_indicators for update using (auth.uid() = user_id);
create policy "typing_delete" on public.typing_indicators for delete using (auth.uid() = user_id);

-- ========== 4. FUNCTIONS & TRIGGERS ==========

-- Auto-create profile on signup (with duplicate username handling)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_username text;
  final_username text;
  counter int := 0;
begin
  base_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    counter := counter + 1;
    final_username := base_username || counter::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-add creator as admin to new conversation
create or replace function public.add_creator_to_conversation()
returns trigger language plpgsql security definer as $$
begin
  insert into public.conversation_members (conversation_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;
drop trigger if exists on_conversation_created on public.conversations;
create trigger on_conversation_created after insert on public.conversations
  for each row execute procedure public.add_creator_to_conversation();

-- Bump conversation timestamp on new message
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

-- ========== 5. PERFORMANCE INDEXES ==========

create index if not exists idx_conversation_members_conversation on public.conversation_members(conversation_id);
create index if not exists idx_conversation_members_user on public.conversation_members(user_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_sender on public.messages(sender_id);
create index if not exists idx_reactions_message on public.reactions(message_id);
create index if not exists idx_typing_conversation on public.typing_indicators(conversation_id);

-- ========== 6. REALTIME (safe add) ==========

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reactions') then
    alter publication supabase_realtime add table public.reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'conversation_members') then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'typing_indicators') then
    alter publication supabase_realtime add table public.typing_indicators;
  end if;
end $$;
