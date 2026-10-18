-- テーブル定義
create table if not exists echoes (
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

drop policy if exists "Allow public read access" on echoes;
create policy "Allow public read access" on echoes for select using (true);

drop policy if exists "Allow public insert access" on echoes;
create policy "Allow public insert access" on echoes for insert with check (true);

drop policy if exists "Allow public update access" on echoes;
create policy "Allow public update access" on echoes for update using (true);

drop policy if exists "Allow public delete access" on echoes;
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

create table if not exists announcements (
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

drop policy if exists "Allow public read access" on announcements;
create policy "Allow public read access" on announcements for select using (true);

drop policy if exists "Allow public insert access" on announcements;
create policy "Allow public insert access" on announcements for insert with check (true);

drop policy if exists "Allow public update access" on announcements;
create policy "Allow public update access" on announcements for update using (true);

drop policy if exists "Allow public delete access" on announcements;
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
  -- 表示回数が少ない投稿へ微ブースト（重み付きランダム）を適用
  if promoted_count > 0 and random() < 0.3 then
    return query
      select * from echoes
      where mode = post_mode and is_promoted = true
      order by random() * (1.0 + 0.15 / (view_count + 1.0)) desc
      limit 1;
  else
    return query
      select * from echoes
      where mode = post_mode
      order by random() * (1.0 + 0.15 / (view_count + 1.0)) desc
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

-- =============================================
-- 累計投稿数カウンター (echo_stats)
-- 物理削除される投稿の累計を追跡するためのテーブル
-- =============================================

create table if not exists echo_stats (
  key text primary key,
  value bigint default 0 not null
);

-- 初期レコードを挿入（なければ）
insert into echo_stats (key, value)
values ('total_echo_count', 0)
on conflict (key) do nothing;

-- RLS
alter table echo_stats enable row level security;
drop policy if exists "Allow public read access" on echo_stats;
create policy "Allow public read access"  on echo_stats for select using (true);

drop policy if exists "Allow public update access" on echo_stats;
create policy "Allow public update access" on echo_stats for update using (true);

-- 累計カウンターをインクリメントする関数
create or replace function increment_echo_stats()
returns void as $$
begin
  update echo_stats
  set value = value + 1
  where key = 'total_echo_count';
end;
$$ language plpgsql;

-- 既存の投稿数で累計カウンターを初期化するSQL（初回のみ実行）
-- update echo_stats set value = (select count(*) from echoes) where key = 'total_echo_count';

-- =============================================
-- 引用リポスト（引用残響）機能
-- =============================================
alter table echoes add column if not exists quoted_id uuid;
alter table echoes add column if not exists quoted_content text;
alter table echoes add column if not exists quoted_mode text;

-- =============================================
-- フィードバック・意見フォーム (feedbacks) テーブル
-- =============================================
create table if not exists feedbacks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  category text not null check (category in ('opinion', 'request', 'bug', 'other')),
  content text not null,
  status text default 'unread' not null check (status in ('unread', 'read', 'resolved'))
);

alter table feedbacks enable row level security;

drop policy if exists "Allow public insert feedbacks" on feedbacks;
create policy "Allow public insert feedbacks" on feedbacks for insert with check (true);

drop policy if exists "Allow public select feedbacks" on feedbacks;
create policy "Allow public select feedbacks" on feedbacks for select using (true);

drop policy if exists "Allow public update feedbacks" on feedbacks;
create policy "Allow public update feedbacks" on feedbacks for update using (true);

drop policy if exists "Allow public delete feedbacks" on feedbacks;
create policy "Allow public delete feedbacks" on feedbacks for delete using (true);

-- =============================================
-- Phase 6: ダッシュボード分析・測定データ基盤 (タスク18)
-- =============================================
-- 投稿は閲覧上限到達で物理削除されるため、消滅後の分析には事前蓄積が必須。
-- 個人を特定できる情報・クライアント識別子は一切保存しない
-- （投稿ID・日付・集計値のみを保持し、本文すら保存しない）。

-- 日次集計テーブル: 投稿ごと・日ごとの表示数/共鳴数を蓄積
-- day は JST 基準（ダッシュボードの「本日」表記と揃える）
create table if not exists echo_daily_stats (
  post_id uuid not null,
  day date not null,
  views integer default 0 not null,
  resonances integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, day)
);

-- 消滅記録テーブル: 物理削除された投稿の最終状態を保存
-- 本文（content）は保存せず、長さ（content_length）のみ保持する
create table if not exists echo_lifecycles (
  post_id uuid primary key,
  mode text not null,
  content_length integer not null,
  created_at timestamp with time zone not null,
  died_at timestamp with time zone default timezone('utc'::text, now()) not null,
  death_reason text not null default 'deleted' check (death_reason in ('view_limit', 'deleted')),
  final_view_count integer not null,
  final_max_views integer not null,
  final_resonance_count integer not null,
  is_promoted boolean default false not null,
  had_quote boolean default false not null
);

-- RLS: 日次集計は読み取り公開・書き込み公開（既存テーブルと同じ anon 設計）。
-- 削除ポリシーは意図的に設定しない（測定データの誤削除防止）。
alter table echo_daily_stats enable row level security;
drop policy if exists "Allow public read access" on echo_daily_stats;
create policy "Allow public read access"  on echo_daily_stats for select using (true);
drop policy if exists "Allow public insert access" on echo_daily_stats;
create policy "Allow public insert access" on echo_daily_stats for insert with check (true);
drop policy if exists "Allow public update access" on echo_daily_stats;
create policy "Allow public update access" on echo_daily_stats for update using (true);

-- RLS: 消滅記録は読み取り公開のみ。書き込みは SECURITY DEFINER トリガー経由のみ。
alter table echo_lifecycles enable row level security;
drop policy if exists "Allow public read access" on echo_lifecycles;
create policy "Allow public read access" on echo_lifecycles for select using (true);

-- echoes から行が消えた瞬間（物理削除）を自動記録するトリガー
-- RPC経由の寿命到達削除も、管理者の強制削除も、どの経路でも捕捉する
create or replace function record_echo_lifecycle()
returns trigger as $$
begin
  insert into echo_lifecycles (
    post_id, mode, content_length, created_at, died_at, death_reason,
    final_view_count, final_max_views, final_resonance_count,
    is_promoted, had_quote
  ) values (
    old.id,
    old.mode,
    length(coalesce(old.content, '')),
    old.created_at,
    now(),
    coalesce(nullif(current_setting('app.echo_death_reason', true), ''), 'deleted'),
    old.view_count,
    old.max_views,
    old.resonance_count,
    coalesce(old.is_promoted, false),
    case when old.quoted_id is not null or old.quoted_content is not null then true else false end
  )
  on conflict (post_id) do nothing;
  return old;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_record_echo_lifecycle on echoes;
create trigger trg_record_echo_lifecycle
after delete on echoes
for each row execute function record_echo_lifecycle();

-- 閲覧数をインクリメントする関数（Phase 6: 日次表示集計を追加）
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

  -- 測定: 当日（JST）の表示数を蓄積
  insert into echo_daily_stats (post_id, day, views)
  values (post_id, (now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (post_id, day)
  do update set views = echo_daily_stats.views + 1;

  if v_count >= m_views then
    -- 消滅理由をトリガーに伝える（トランザクションローカル）
    perform set_config('app.echo_death_reason', 'view_limit', true);
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

-- 共鳴する関数 (Phase 6: 日次共鳴集計を追加)
-- 注: 共鳴の取り消し（アン共鳴）はクライアント側の直接UPDATEで行われるため日次集計には含まれない
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

  -- 測定: 当日（JST）の共鳴数を蓄積
  insert into echo_daily_stats (post_id, day, resonances)
  values (post_id, (now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (post_id, day)
  do update set resonances = echo_daily_stats.resonances + 1;

  return json_build_object(
    'status', 'success',
    'resonance_count', updated_rec.resonance_count,
    'max_views', updated_rec.max_views
  );
end;
$$ language plpgsql;

-- 日別トレンド取得（JST基準）: 投稿数・表示数・共鳴数・消滅数
-- 投稿数は「生存中の投稿(echoes)」+「消滅済み(echo_lifecycles)」の和で全数をカバー
create or replace function get_daily_trend(since_days integer)
returns json as $$
declare
  v_today date;
  v_start date;
  v_result json;
begin
  v_today := (now() at time zone 'Asia/Tokyo')::date;
  v_start := v_today - greatest(coalesce(since_days, 30), 1) + 1;

  with days as (
    select generate_series(v_start, v_today, interval '1 day')::date as day
  ),
  v as (
    select day, sum(views) as views, sum(resonances) as resonances
    from echo_daily_stats
    where day >= v_start
    group by day
  ),
  p as (
    select day, sum(posts) as posts
    from (
      select (created_at at time zone 'Asia/Tokyo')::date as day, count(*) as posts
      from echoes
      where (created_at at time zone 'Asia/Tokyo')::date >= v_start
      group by 1
      union all
      select (created_at at time zone 'Asia/Tokyo')::date, count(*)
      from echo_lifecycles
      where (created_at at time zone 'Asia/Tokyo')::date >= v_start
      group by 1
    ) t
    group by day
  ),
  d as (
    select (died_at at time zone 'Asia/Tokyo')::date as day, count(*) as deaths
    from echo_lifecycles
    where (died_at at time zone 'Asia/Tokyo')::date >= v_start
    group by 1
  ),
  agg as (
    select
      days.day,
      coalesce(p.posts, 0)        as posts,
      coalesce(v.views, 0)        as views,
      coalesce(v.resonances, 0)   as resonances,
      coalesce(d.deaths, 0)       as deaths
    from days
    left join v on v.day = days.day
    left join p on p.day = days.day
    left join d on d.day = days.day
  )
  select coalesce(json_agg(json_build_object(
    'day',        to_char(day, 'YYYY-MM-DD'),
    'posts',      posts,
    'views',      views,
    'resonances', resonances,
    'deaths',     deaths
  ) order by day), '[]'::json)
  into v_result
  from agg;

  return v_result;
end;
$$ language plpgsql;

-- 寿命サマリー: 消滅投稿の集計（微ブースト/PR効果検証の基礎データ）
create or replace function get_lifecycle_summary()
returns json as $$
declare
  v_result json;
begin
  select json_build_object(
    'total_died',          count(*),
    'avg_final_views',     coalesce(round(avg(final_view_count)::numeric, 2), 0),
    'max_final_views',     coalesce(max(final_view_count), 0),
    'avg_lifespan_hours',  coalesce(round(avg(extract(epoch from (died_at - created_at)) / 3600.0)::numeric, 2), 0),
    'by_mode', coalesce((
      select json_agg(json_build_object(
        'mode', mode, 'count', cnt, 'avg_final_views', avg_views
      ) order by mode)
      from (
        select mode, count(*) as cnt, round(avg(final_view_count)::numeric, 2) as avg_views
        from echo_lifecycles group by mode
      ) t
    ), '[]'::json),
    'by_reason', coalesce((
      select json_agg(json_build_object('reason', death_reason, 'count', cnt) order by cnt desc)
      from (
        select death_reason, count(*) as cnt
        from echo_lifecycles group by death_reason
      ) t
    ), '[]'::json),
    'view_distribution', coalesce((
      select json_agg(json_build_object('bucket', bucket, 'count', cnt) order by ord)
      from (
        select
          case
            when final_view_count < 10 then '0-9'
            when final_view_count < 30 then '10-29'
            when final_view_count < 50 then '30-49'
            when final_view_count < 80 then '50-79'
            else '80+'
          end as bucket,
          count(*) as cnt,
          case
            when final_view_count < 10 then 1
            when final_view_count < 30 then 2
            when final_view_count < 50 then 3
            when final_view_count < 80 then 4
            else 5
          end as ord
        from echo_lifecycles
        group by 1, 3
      ) t
    ), '[]'::json)
  )
  into v_result
  from echo_lifecycles;

  return v_result;
end;
$$ language plpgsql;

-- =============================================
-- PR効果測定 & 微ブースト検証（タスク19対応）
-- =============================================

-- PR期間テーブル: プロモーションON/OFFの開始・終了時刻を記録
-- ended_at が null の行が「現在PR中」。効果測定は日次統計と突き合わせる
create table if not exists echo_pr_periods (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone
);

-- RLS: 読取公開。書き込みはサーバーアクション経由（既存テーブルと同じ anon 設計）
alter table echo_pr_periods enable row level security;
drop policy if exists "Allow public read access" on echo_pr_periods;
create policy "Allow public read access"  on echo_pr_periods for select using (true);
drop policy if exists "Allow public insert access" on echo_pr_periods;
create policy "Allow public insert access" on echo_pr_periods for insert with check (true);
drop policy if exists "Allow public update access" on echo_pr_periods;
create policy "Allow public update access" on echo_pr_periods for update using (true);

-- PR効果測定: PR期間中の日次表示/共鳴 vs PR外（同一投稿の比較＝最も妥当な差分）
create or replace function get_pr_effect()
returns json as $$
declare
  v_result json;
begin
  with periods as (
    select post_id, started_at, coalesce(ended_at, now()) as ended_at
    from echo_pr_periods
  ),
  -- PR投稿の日次統計をPR期間内外に分類
  -- day は JST 基準日。その日のUTC範囲は [day-9h, day-9h+1day)
  classified as (
    select
      s.post_id,
      s.views,
      s.resonances,
      exists (
        select 1 from periods p
        where p.post_id = s.post_id
          and p.started_at < (s.day::timestamp - interval '9 hours') + interval '1 day'
          and p.ended_at   > (s.day::timestamp - interval '9 hours')
      ) as in_pr
    from echo_daily_stats s
    where exists (select 1 from periods p where p.post_id = s.post_id)
  ),
  agg as (
    select
      count(*) filter (where in_pr)                              as pr_day_rows,
      coalesce(sum(views) filter (where in_pr), 0)               as pr_views,
      coalesce(sum(resonances) filter (where in_pr), 0)          as pr_resonances,
      count(*) filter (where not in_pr)                          as non_pr_day_rows_same,
      coalesce(sum(views) filter (where not in_pr), 0)           as non_pr_views_same,
      coalesce(sum(resonances) filter (where not in_pr), 0)      as non_pr_resonances_same
    from classified
  ),
  others as (
    -- 一度もPRしていない投稿の全期間（参照群）
    select
      count(*)                                as non_pr_day_rows_other,
      coalesce(sum(s.views), 0)               as non_pr_views_other,
      coalesce(sum(s.resonances), 0)          as non_pr_resonances_other
    from echo_daily_stats s
    where not exists (select 1 from periods p where p.post_id = s.post_id)
  ),
  pa as (
    select
      count(*)                                              as total_periods,
      count(*) filter (where pe.ended_at_raw is null)       as active_periods,
      count(distinct pe.post_id)                            as pr_posts
    from (
      select post_id, ended_at as ended_at_raw from echo_pr_periods
    ) pe
  ),
  lifts as (
    select
      case when (agg.non_pr_views_same::numeric / greatest(agg.non_pr_day_rows_same, 1)) > 0
        then round(((agg.pr_views::numeric / greatest(agg.pr_day_rows, 1)) - (agg.non_pr_views_same::numeric / greatest(agg.non_pr_day_rows_same, 1)))
             / (agg.non_pr_views_same::numeric / greatest(agg.non_pr_day_rows_same, 1)) * 100.0, 1)
        else null end as lift_views,
      case when (agg.non_pr_resonances_same::numeric / greatest(agg.non_pr_day_rows_same, 1)) > 0
        then round(((agg.pr_resonances::numeric / greatest(agg.pr_day_rows, 1)) - (agg.non_pr_resonances_same::numeric / greatest(agg.non_pr_day_rows_same, 1)))
             / (agg.non_pr_resonances_same::numeric / greatest(agg.non_pr_day_rows_same, 1)) * 100.0, 1)
        else null end as lift_resonances
    from agg
  )
  select json_build_object(
    'total_periods',   pa.total_periods,
    'active_periods',  pa.active_periods,
    'pr_posts',        pa.pr_posts,
    'pr', json_build_object(
      'day_rows',              agg.pr_day_rows,
      'views',                 agg.pr_views,
      'resonances',            agg.pr_resonances,
      'avg_daily_views',       case when agg.pr_day_rows > 0 then round(agg.pr_views::numeric / agg.pr_day_rows, 2) else 0 end,
      'avg_daily_resonances',  case when agg.pr_day_rows > 0 then round(agg.pr_resonances::numeric / agg.pr_day_rows, 2) else 0 end
    ),
    'non_pr_same_posts', json_build_object(
      'day_rows',              agg.non_pr_day_rows_same,
      'views',                 agg.non_pr_views_same,
      'resonances',            agg.non_pr_resonances_same,
      'avg_daily_views',       case when agg.non_pr_day_rows_same > 0 then round(agg.non_pr_views_same::numeric / agg.non_pr_day_rows_same, 2) else 0 end,
      'avg_daily_resonances',  case when agg.non_pr_day_rows_same > 0 then round(agg.non_pr_resonances_same::numeric / agg.non_pr_day_rows_same, 2) else 0 end
    ),
    'non_pr_other_posts', json_build_object(
      'day_rows',              others.non_pr_day_rows_other,
      'views',                 others.non_pr_views_other,
      'resonances',            others.non_pr_resonances_other,
      'avg_daily_views',       case when others.non_pr_day_rows_other > 0 then round(others.non_pr_views_other::numeric / others.non_pr_day_rows_other, 2) else 0 end,
      'avg_daily_resonances',  case when others.non_pr_day_rows_other > 0 then round(others.non_pr_resonances_other::numeric / others.non_pr_day_rows_other, 2) else 0 end
    ),
    'lift_daily_views_pct',       lifts.lift_views,
    'lift_daily_resonances_pct',  lifts.lift_resonances
  )
  into v_result
  from agg, others, pa, lifts;

  return v_result;
end;
$$ language plpgsql;

-- 微ブースト効果検証: 露出の偏り・飢餓投稿・寿命完遂率
-- ブーストが効いている場合、未表示(view=0)や飢餓(長期間2回以下)は少数に収まり、
-- 寿命完遂率（寿命到達による自然消滅の割合）が高くなる
create or replace function get_boost_stats()
returns json as $$
declare
  v_result json;
begin
  select json_build_object(
    'alive_total',     alive.alive_total,
    'never_shown',     alive.never_shown,
    'starved',         alive.starved,
    'full_life_ratio', dl.full_life_ratio,
    'view_distribution', coalesce((
      select json_agg(json_build_object(
        'bucket', bucket, 'count', cnt, 'avg_age_days', avg_age
      ) order by ord)
      from (
        select
          case
            when view_count = 0  then '0'
            when view_count <= 2 then '1-2'
            when view_count <= 5 then '3-5'
            when view_count <= 10 then '6-10'
            when view_count <= 20 then '11-20'
            else '21+'
          end as bucket,
          count(*) as cnt,
          round(avg(extract(epoch from (now() - created_at)) / 86400.0)::numeric, 1) as avg_age_days,
          case
            when view_count = 0  then 1
            when view_count <= 2 then 2
            when view_count <= 5 then 3
            when view_count <= 10 then 4
            when view_count <= 20 then 5
            else 6
          end as ord
        from echoes
        group by 1, 4
      ) t
    ), '[]'::json)
  )
  into v_result
  from (
    select
      count(*)                                              as alive_total,
      count(*) filter (where view_count = 0)                as never_shown,
      count(*) filter (where view_count <= 2
                        and created_at < now() - interval '3 days') as starved
    from echoes
  ) alive,
  (
    select
      case when count(*) > 0
        then round(100.0 * count(*) filter (where death_reason = 'view_limit') / count(*), 1)
        else 0
      end as full_life_ratio
    from echo_lifecycles
  ) dl;

  return v_result;
end;
$$ language plpgsql;
