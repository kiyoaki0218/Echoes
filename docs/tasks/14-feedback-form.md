# 💌 タスク14: 意見（フィードバック）フォームの設置 設計ノート

- **タグ**: #phase5 #feedback #admin #database #ui-ux
- **関連ノート**: [[TODO]], [[CHANGELOG]]
- **ステータス**: ✅ 実装完了（2026-10-17）

---

## 🎯 目的・概要
ユーザーから運営・開発者に対して、匿名・アカウントレスで意見・要望・不具合報告を直接届けることができるフィードバックフォームを設置し、管理画面で内容を確認・対応管理できるようにする。

---

## 🗄️ データベース設計 (`supabase.sql`)

```sql
create table if not exists feedbacks (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  category text not null check (category in ('opinion', 'request', 'bug', 'other')),
  content text not null,
  status text default 'unread' not null check (status in ('unread', 'read', 'resolved'))
);
```

---

## 🎨 UI / UX 仕様

### 1. メイン画面フッター
- フッターメニューに「ご意見」ボタン（`MessageSquareHeart` アイコン）を設置。
- タップでフィードバック送信モーダルを展開。

### 2. フィードバック送信モーダル
- カテゴリ選択（「ご意見」「機能要望」「不具合」「その他」）。
- 最大1000文字のテキストエリア。
- 送信完了時のチェックアニメーションと自動クローズ。

### 3. 管理者ダッシュボード
- 「ご意見・ご要望」タブの追加（未読バッジ付き）。
- 未読・既読・対応済みのステータスフィルターおよびセレクトボックスによる即時更新。
- 不要なご意見の削除機能。
