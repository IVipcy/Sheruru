-- Fix: "回答あり" tab + ベストアンサー
-- 1) Non-authors could not set unsolved_questions.status to 'answered' (RLS).
-- 2) unsolved_answers had no UPDATE policy, so is_accepted could never be saved.

drop policy if exists "Question author can update answers on their questions" on public.unsolved_answers;

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

drop trigger if exists on_unsolved_answer_set_question_status on public.unsolved_answers;

create trigger on_unsolved_answer_set_question_status
  after insert on public.unsolved_answers
  for each row execute function public.set_unsolved_question_answered_status();
