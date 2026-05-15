-- =============================================================================
-- 【超簡単】やることは次のどちらか 1 つだけ
-- =============================================================================
--
-- A) いちばん効く整理：mode が all の行だけ全部消す（今の DB だと 6 件だけ）
--    → ファイル knowledge_vectors_delete_mode_all.sql を開いて、そのまま Run（1 文だけ）
--
-- B) 何も消さず、中身だけ見たいとき
--    → 下の「一覧用 SELECT」を Run
-- =============================================================================

select
  mode,
  coalesce(category, '(null)') as category,
  coalesce(source_file, '(null)') as source_file,
  count(*) as n
from public.knowledge_vectors
group by 1, 2, 3
order by n desc;

-- -----------------------------------------------------------------------------
-- 以下は必要になったら使う（行の先頭の -- を消してから Run）
-- -----------------------------------------------------------------------------

-- 2) mode が all の行だけプレビュー
-- select id, mode, category, source_file, left(content, 120) as preview
-- from public.knowledge_vectors
-- where mode = 'all'
-- order by created_at desc;

-- 3) 削除（消しすぎ注意。試すときは begin → delete → rollback が安全）
-- begin;
-- delete from public.knowledge_vectors where mode = 'all';
-- rollback;

-- 3b) カテゴリ名で消す（実際の表記に合わせて ILIKE を修正）
-- delete from public.knowledge_vectors
-- where category ilike any (array['%競合%', '%差別化%', '%市場規模%', '%官公庁%']);

-- 3c) ファイル名で消す
-- delete from public.knowledge_vectors where source_file ilike '%sales-know-how%';
-- delete from public.knowledge_vectors where source_file ilike '%textbook%';

-- 3d) 未解決BOXの自動学習だけ全削除
-- delete from public.knowledge_vectors where category = '未解決BOX回答';

-- 3e) 1 件だけ消す（id は Table Editor でコピー）
-- delete from public.knowledge_vectors where id = '00000000-0000-0000-0000-000000000000'::uuid;
