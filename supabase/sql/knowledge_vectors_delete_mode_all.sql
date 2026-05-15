-- mode = 'all' のうち、「未解決BOX（自動学習）」以外を削除（RAG が全モードに混ぜる行の整理）
-- 未解決BOXの category は常に「未解決BOX回答」
delete from public.knowledge_vectors
where mode = 'all'
  and (category is null or category <> '未解決BOX回答');
