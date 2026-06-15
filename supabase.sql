-- テーブル定義
create table echoes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  mode text not null check (mode in ('bubble', 'will')),
  view_count integer default 0 not null,
  max_views integer not null,
  resonance_count integer default 0 not null
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
