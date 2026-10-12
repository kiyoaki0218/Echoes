# 🔁 タスク12: 引用リポスト（引用残響）機能 設計ノート

- **タグ**: #phase4 #feature #quote-echo
- **関連ノート**: [[TODO]], [[CHANGELOG]]
- **ステータス**: ✅ 実装完了（2026-10-12）

---

## 🎯 目的・概要
ユーザーが閲覧中の残響（投稿）に対して、自身の想いやコメントを添えて新たに投稿できる「引用残響（引用リポスト）」機能を実装する。

---

## 🎨 UI / UX 仕様

### 1. 引用ボタンの設置
- メイン閲覧画面のアクションバー（共鳴ボタン等の並び）に「引用」ボタンを配置。
- アイコン: `Quote` または `MessageSquareShare`
- クリック時: 投稿モーダルを開き、引用対象をセット。

### 2. 投稿モーダル内の引用プレビュー
- 投稿モーダル内に「引用中の残響」カードを表示。
  - 引用元のモード（泡沫/遺言）バッジ
  - 引用元のテキスト（抜粋・全文）
  - 引用解除ボタン（✕）

### 3. メイン画面・マイリストでの引用表示
- 引用を含む投稿が表示された場合、本文下部に「引用された残響」カードを品格あるデザイン（ボーダー、微小な透明度、フォント微小）でインライン表示。
- 引用元の残響が物理削除された場合でも、スナップショット（または「この残響は風化して消滅しました」）を美しく表示。

---

## 🗄️ データベース設計 (`supabase.sql`)

```sql
-- 引用リポスト用カラムの追加
alter table echoes add column if not exists quoted_id uuid;
alter table echoes add column if not exists quoted_content text;
alter table echoes add column if not exists quoted_mode text;
```

---

## 📝 実装ステップ
1. [x] `docs/tasks/12-quote-repost.md` 仕様ドキュメント作成（Obsidian連携）
2. [ ] `supabase.sql` に引用カラム定義追加
3. [ ] `src/types` / `src/app/page.tsx` の Echo 型に quoted カラム追加
4. [ ] 投稿モーダルに引用プレビュー & 引用投稿処理を実装
5. [ ] メイン画面およびマイリスト画面に引用残響カード表示を実装
6. [ ] ビルド検証 & TODO/CHANGELOG セット更新 & GitHub プッシュ
