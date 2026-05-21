create policy "Authenticated can insert knowledge"
  on public.knowledge_vectors
  for insert
  to authenticated
  with check (true);
