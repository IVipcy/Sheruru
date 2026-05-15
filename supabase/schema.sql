-- =============================================================
-- GYAOSUU Database Schema for Supabase
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- =============================================================

-- Enable pgvector extension
create extension if not exists vector;

-- =============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- =============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  department text,
  employee_id text,
  avatar_url text,
  total_conversations integer not null default 0,
  total_good_count integer not null default 0,
  total_bad_count integer not null default 0,
  sherpa_solve_count integer not null default 0,
  good_badge_rank integer not null default 0,
  is_sherpa boolean not null default false,
  selected_badge text not null default 'good' check (selected_badge in ('good', 'sherpa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 2. CONVERSATIONS
-- =============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('qa', 'consultation', 'procedure')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  message_count integer not null default 0
);

alter table public.conversations enable row level security;
create policy "Users can view own conversations" on public.conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on public.conversations for update using (auth.uid() = user_id);

create index idx_conversations_user on public.conversations(user_id);

-- =============================================================
-- 3. MESSAGES
-- =============================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  emotion text default 'neutral',
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
create policy "Users can view own messages" on public.messages for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "Users can insert own messages" on public.messages for insert
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

create index idx_messages_conversation on public.messages(conversation_id, created_at);

-- =============================================================
-- 4. FEEDBACK (Good / Bad)
-- =============================================================
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('good', 'bad')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.feedback enable row level security;
create policy "Users can view own feedback" on public.feedback for select using (auth.uid() = user_id);
create policy "Users can insert own feedback" on public.feedback for insert with check (auth.uid() = user_id);

-- Trigger: update profile good/bad counts + badge rank
create or replace function public.update_badge_on_feedback()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  good_count integer;
  new_rank integer;
begin
  if new.feedback_type = 'good' then
    update public.profiles set total_good_count = total_good_count + 1, updated_at = now() where id = new.user_id;
  else
    update public.profiles set total_bad_count = total_bad_count + 1, updated_at = now() where id = new.user_id;
  end if;

  select total_good_count into good_count from public.profiles where id = new.user_id;
  new_rank := case
    when good_count >= 30 then 3
    when good_count >= 10 then 2
    else 1
  end;
  update public.profiles set good_badge_rank = new_rank, updated_at = now() where id = new.user_id;
  return new;
end;
$$;

create trigger on_feedback_created
  after insert on public.feedback
  for each row execute function public.update_badge_on_feedback();

-- =============================================================
-- 5. CATEGORIES
-- =============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('qa', 'consultation', 'procedure', 'all')),
  display_order integer not null default 0
);

alter table public.categories enable row level security;
create policy "Anyone can view categories" on public.categories for select using (true);

-- Seed categories
insert into public.categories (name, mode, display_order) values
  ('商品・サービス知識', 'qa', 1),
  ('対応機器・書類', 'qa', 2),
  ('料金・見積', 'qa', 3),
  ('ITAD基礎・法規', 'qa', 4),
  ('接客・提案', 'consultation', 5),
  ('競合・差別化', 'consultation', 6),
  ('顧客タイプ別対応', 'consultation', 7),
  ('SFA・案件管理', 'procedure', 8),
  ('見積・受注手続き', 'procedure', 9),
  ('MLITAD連携', 'procedure', 10);

-- =============================================================
-- 6. UNSOLVED QUESTIONS
-- =============================================================
create table public.unsolved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  question_text text not null,
  ai_answer_text text,
  category_id uuid references public.categories(id) on delete set null,
  mode text not null check (mode in ('qa', 'consultation', 'procedure')),
  status text not null default 'open' check (status in ('open', 'answered', 'resolved')),
  empathy_count integer not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.unsolved_questions enable row level security;
create policy "Anyone can view unsolved questions" on public.unsolved_questions for select using (true);
create policy "Users can insert own questions" on public.unsolved_questions for insert with check (auth.uid() = user_id);
create policy "Users can update own questions" on public.unsolved_questions for update using (auth.uid() = user_id);

create index idx_unsolved_status on public.unsolved_questions(status, created_at desc);

-- =============================================================
-- 7. UNSOLVED ANSWERS
-- =============================================================
create table public.unsolved_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.unsolved_questions(id) on delete cascade,
  answerer_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text not null,
  is_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.unsolved_answers enable row level security;
create policy "Anyone can view answers" on public.unsolved_answers for select using (true);
create policy "Users can insert own answers" on public.unsolved_answers for insert with check (auth.uid() = answerer_id);
-- Best answer: only the question author may update rows (e.g. is_accepted); answerers have no UPDATE policy otherwise
create policy "Question author can update answers on their questions"
on public.unsolved_answers for update
using (
  exists (
    select 1 from public.unsolved_questions q
    where q.id = question_id and q.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.unsolved_questions q
    where q.id = question_id and q.user_id = auth.uid()
  )
);

-- Trigger: update sherpa status
create or replace function public.update_sherpa_on_answer()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  answer_count integer;
begin
  select count(*) into answer_count from public.unsolved_answers where answerer_id = new.answerer_id;
  if answer_count >= 3 then
    update public.profiles set is_sherpa = true, sherpa_solve_count = answer_count, updated_at = now()
    where id = new.answerer_id;
  else
    update public.profiles set sherpa_solve_count = answer_count, updated_at = now()
    where id = new.answerer_id;
  end if;
  return new;
end;
$$;

create trigger on_answer_created
  after insert on public.unsolved_answers
  for each row execute function public.update_sherpa_on_answer();

-- When an answer is posted, set question to "answered" (non-authors cannot UPDATE unsolved_questions under RLS)
create or replace function public.set_unsolved_question_answered_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.unsolved_questions
  set status = 'answered'
  where id = new.question_id and status = 'open';
  return new;
end;
$$;

create trigger on_unsolved_answer_set_question_status
  after insert on public.unsolved_answers
  for each row execute function public.set_unsolved_question_answered_status();

-- =============================================================
-- 8. NOTIFICATIONS
-- =============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('answer_posted', 'question_resolved', 'badge_earned')),
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

create index idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;

-- =============================================================
-- 9. KNOWLEDGE VECTORS (RAG)
-- =============================================================
create table public.knowledge_vectors (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  category text,
  mode text not null default 'all' check (mode in ('qa', 'consultation', 'procedure', 'all')),
  source_file text,
  chunk_index integer default 0,
  metadata jsonb default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

alter table public.knowledge_vectors enable row level security;
create policy "Anyone can read knowledge" on public.knowledge_vectors for select using (true);

-- Vector similarity search index (IVFFlat for performance)
create index idx_knowledge_embedding on public.knowledge_vectors
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =============================================================
-- 10. MATCH FUNCTION (RAG search)
-- =============================================================
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_mode text default null
)
returns table (
  id uuid,
  content text,
  category text,
  mode text,
  source_file text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    kv.id,
    kv.content,
    kv.category,
    kv.mode,
    kv.source_file,
    1 - (kv.embedding <=> query_embedding) as similarity
  from public.knowledge_vectors kv
  where 1 - (kv.embedding <=> query_embedding) > match_threshold
    and (filter_mode is null or kv.mode = filter_mode or kv.mode = 'all')
  order by kv.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- =============================================================
-- 11. DASHBOARD STATS VIEW
-- =============================================================
create or replace view public.dashboard_stats as
select
  count(distinct c.id) as total_conversations,
  count(distinct m.id) as total_messages,
  count(distinct f.id) filter (where f.feedback_type = 'good') as total_goods,
  count(distinct f.id) filter (where f.feedback_type = 'bad') as total_bads,
  count(distinct uq.id) filter (where uq.status = 'open') as open_questions,
  count(distinct uq.id) filter (where uq.status = 'resolved') as resolved_questions
from public.conversations c
left join public.messages m on m.conversation_id = c.id
left join public.feedback f on f.message_id = m.id
left join public.unsolved_questions uq on true;
