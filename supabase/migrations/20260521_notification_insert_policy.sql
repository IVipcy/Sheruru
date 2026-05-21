-- 回答者が質問者へ通知を insert できるようにする（API のサービスロールが無い環境のフォールバック）
create policy "Users can insert notifications for others"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() is not null and user_id <> auth.uid());
