-- テーブル定義
create table echoes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  mode text not null check (mode in ('bubble', 'will')),
  view_count integer default 0 not null,
  max_views integer not null,
  resonance_count integer default 0 not null,
  report_count integer default 0 not null
);

-- RLS (Row Level Security) の設定
alter table echoes enable row level security;

create policy "Allow public read access" on echoes for select using (true);
create policy "Allow public insert access" on echoes for insert with check (true);
create policy "Allow public update access" on echoes for update using (true);
create policy "Allow public delete access" on echoes for delete using (true);

-- 投稿をランダムに1件取得する関数
create or replace function get_random_echo(post_mode text)
returns setof echoes as $$
begin
  return query
  select * from echoes
  where mode = post_mode
  order by random()
  limit 1;
end;
$$ language plpgsql;

-- 閲覧数をインクリメントし、上限に達したら物理削除する関数
create or replace function increment_view(post_id uuid)
returns json as $$
declare
  v_count int;
  m_views int;
  deleted boolean := false;
  updated_rec record;
begin
  select view_count, max_views into v_count, m_views
  from echoes
  where id = post_id
  for update;

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  v_count := v_count + 1;

  if v_count >= m_views then
    delete from echoes where id = post_id;
    deleted := true;
  else
    update echoes
    set view_count = v_count
    where id = post_id
    returning * into updated_rec;
  end if;

  return json_build_object(
    'status', case when deleted then 'deleted' else 'active' end,
    'view_count', v_count,
    'max_views', m_views
  );
end;
$$ language plpgsql;

-- 共鳴する関数 (resonance_count +1, max_views +10)
create or replace function resonate_post(post_id uuid)
returns json as $$
declare
  r_count int;
  m_views int;
  updated_rec record;
begin
  update echoes
  set resonance_count = resonance_count + 1,
      max_views = max_views + 10
  where id = post_id
  returning resonance_count, max_views into updated_rec;

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  return json_build_object(
    'status', 'success',
    'resonance_count', updated_rec.resonance_count,
    'max_views', updated_rec.max_views
  );
end;
$$ language plpgsql;

-- 通報する関数 (report_count + 1)
create or replace function report_post(post_id uuid)
returns json as $$
declare
  updated_rec record;
begin
  update echoes
  set report_count = report_count + 1
  where id = post_id
  returning report_count into updated_rec;

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  return json_build_object(
    'status', 'success',
    'report_count', updated_rec.report_count
  );
end;
$$ language plpgsql;

-- =============================================
-- 公式お知らせ (announcements) テーブル
-- =============================================

create table announcements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  content text not null,
  is_pinned boolean default false not null,
  publish_start timestamp with time zone not null,
  publish_end timestamp with time zone not null
);

-- RLS
alter table announcements enable row level security;

create policy "Allow public read access" on announcements for select using (true);
create policy "Allow public insert access" on announcements for insert with check (true);
create policy "Allow public update access" on announcements for update using (true);
create policy "Allow public delete access" on announcements for delete using (true);

-- 掲載期間が有効なお知らせを取得する関数（期限切れは返さない）
create or replace function get_active_announcements()
returns setof announcements as $$
begin
  return query
  select * from announcements
  where now() >= publish_start
    and now() <  publish_end
  order by is_pinned desc, publish_start desc;
end;
$$ language plpgsql;

-- 期限切れのお知らせを物理削除する関数（定期クリーンアップ用）
create or replace function delete_expired_announcements()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from announcements where now() >= publish_end;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql;

-- =============================================
-- プロモーション機能 (is_promoted カラム追加)
-- =============================================

-- echoes テーブルに is_promoted フラグを追加
alter table echoes add column if not exists is_promoted boolean default false not null;

-- プロモーション投稿を優先してランダム取得する関数
-- promoted な投稿があれば 30% の確率でそちらを返す。なければ通常のランダム取得にフォールバック
create or replace function get_random_echo(post_mode text)
returns setof echoes as $$
declare
  promoted_count int;
begin
  -- プロモーション投稿の件数を確認
  select count(*) into promoted_count
  from echoes
  where mode = post_mode and is_promoted = true;

  -- プロモーション投稿がある かつ 30% の確率でプロモーションを返す
  if promoted_count > 0 and random() < 0.3 then
    return query
      select * from echoes
      where mode = post_mode and is_promoted = true
      order by random()
      limit 1;
  else
    return query
      select * from echoes
      where mode = post_mode
      order by random()
      limit 1;
  end if;
end;
$$ language plpgsql;

-- =============================================
-- 長文(will)の初期寿命を 500 → 100 に変更するマイグレーション
-- 共鳴による延長分（resonance_count * 10）は維持しつつ基礎値を400減らす
-- view_count + 1 を下回らないよう GREATEST で保護
-- =============================================
update echoes
set max_views = greatest(view_count + 1, max_views - 400)
where mode = 'will'
  and max_views >= 500;
