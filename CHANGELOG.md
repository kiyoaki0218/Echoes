# Echoes 残響 - 更新実績・変更履歴 (CHANGELOG)

このドキュメントは、これまでに実施したプログラムの具体的な編集内容、編集箇所、および更新実績を記録するためのものです。
今後は未実装タスクを管理する `TODO.md`（更新予定）とセットで更新・運用を行います。

---

## 📜 更新履歴一覧

### 📅 2026-09-23 (2回目)
#### 2. ダッシュボードへのサマリー（統計）カード追加
- **編集箇所**:
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
- **わかりやすい編集内容**:
  - ダッシュボード上部に「本日の投稿数」「総投稿数」「総共鳴数」「アクティブな残響数」の4枚の統計カードを追加。
  - ページ読み込み時に自動取得し、「更新」ボタン押下時にも再取得する。
  - 取得中はスケルトンアニメーション（shimmer）を表示。
- **具体的なプログラムの編集内容**:
  - admin.ts: `getAdminStats()` Server Action を新規追加。Supabase に3本のクエリを `Promise.all` で並列発行し、総件数（`count: "exact"`）・本日分（JST換算の当日0時をUTCに変換して `.gte()` フィルター）・総共鳴数（全行の `resonance_count` を取得して reduce で合算）を取得。戻り値は `{ totalCount, todayCount, totalResonance, activeCount }` 形式。
  - admin/page.tsx: `getAdminStats` を追加インポート。`lucide-react` から `FileText`・`BarChart2`・`Heart`・`Zap` を追加インポート。`stats`（`Stats | null`）・`statsLoading`（`boolean`）の state を追加。`fetchStats` を `useCallback` で定義し、独立した `useEffect` で初回マウント時に実行。「更新」ボタンのハンドラに `fetchStats()` 呼び出しを追加。ヘッダー直下に4列グリッドのカードUIを追加（各カードはアイコン・ラベル・数値で構成、取得中は `animate-pulse` のスケルトンを表示）。

---

### 📅 2026-09-29
#### 1. ダッシュボードのページネーション導入 & 初期表示の高速化
- **編集箇所**:
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
- **わかりやすい編集内容**:
  - ダッシュボードで全件を一括取得していた処理を、1ページあたり50件ずつ取得するページネーション方式に変更。
  - 「前へ」「次へ」ボタンおよびページ番号ボタンをダッシュボード下部に追加。
  - モードフィルター（すべて/短文/長文）の切り替えと同時にサーバー側で絞り込みを行い、ページを1に戻す処理を追加。
  - 総件数・現在ページ表示を追加し、件数の把握を容易にした。
- **具体的なプログラムの編集内容**:
  - admin.ts: `getAdminEchoes()` 関数に `page: number`・`mode: "all" | "bubble" | "will"` 引数を追加。Supabase の `.select("*", { count: "exact" })` と `.range(from, to)` および `.eq("mode", mode)` を使用し、サーバー側でページ・モード絞り込みと総件数取得を実施。戻り値を `{ data, totalCount }` 形式に変更。定数 `PAGE_SIZE = 50` を追加。
  - admin/page.tsx: `useCallback` を追加インポート。`currentPage`・`totalCount` の state を追加。`fetchEchoes` を `useCallback` でメモ化し、`page`・`mode` 引数を受け取る形式に変更。`useEffect` を `currentPage`・`filterMode` の変化に依存させ、フィルター変更時はページ1に戻る `handleFilterChange` を実装。`totalPages` 計算ロジック・`getPageNumbers()` 関数（最大7件の省略付きページ番号リスト）を実装。ページネーションUI（前へ/次へ/ページ番号）を追加。総件数・現在ページ/総ページ数表示を追加。`lucide-react` から `ChevronLeft`・`ChevronRight` を追加インポート。

---
### 📅 2026-09-28
#### 1. `TODO.md`（未実装タスク一覧・運用ガイド）の作成
- **編集箇所**: [`TODO.md`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/TODO.md)
- **具体的なプログラム・ドキュメントの編集内容**:
  - Phase 2 〜 Phase 5 までの未実装タスクを整理・一覧化。
  - 実装完了後に `TODO.md` から項目を削除する運用ルールを制定。

#### 2. モバイル端末向けレイアウト最適化 & 「My Echoes」モーダルタブ連動
- **編集箇所**: [`src/app/page.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/page.tsx)
- **具体的なプログラム・ドキュメントの編集内容**:
  - CSS/スタイリングにおいて Dynamic Viewport Height (`dvh`) を適用し、モバイルブラウザのアドレスバーによる崩れや余計なスクロールを防止。
  - 「My Echoes（自分の投稿一覧）」モーダル表示時、現在ヘッダーで選択されているアクティブモード（泡沫/遺言/すべて）と表示フィルターが連動するロジックを実装。

#### 3. メインページへの「すべて」モードタブ追加 ＆ モードタグ（泡沫/遺言）表示
- **編集箇所**: [`src/app/page.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/page.tsx)
- **具体的なプログラム・ドキュメントの編集内容**:
  - ヘッダーフィルターに「すべて」タブを追加し、全モードの投稿を混在表示できるように拡張。
  - 投稿カード上に「泡沫」「遺言」の種別タグバッジを表示するUIコンポーネントを追加。
  - 新規投稿時、現在選択中のモードが自動適用される連動処理を追加。

#### 4. Google Search Console 検証ファイルの配置
- **編集箇所**: `public/google7bc23dbf1589ebb9.html`
- **具体的なプログラム・ドキュメントの編集内容**:
  - 検索エンジン所有権確認用の認証 HTML ファイルを `public` ディレクトリに設置。

---

### 📅 2026-09-27
#### 1. 管理者ダッシュボード機能の実装 & 認証プロキシ導入
- **編集箇所**:
  - [`src/app/admin/page.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/admin/page.tsx)
  - [`src/app/admin/login/page.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/admin/login/page.tsx)
  - [`src/app/actions/admin.ts`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/actions/admin.ts)
  - [`src/proxy.ts`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/proxy.ts) (旧 `middleware.ts`)
- **具体的なプログラム・ドキュメントの編集内容**:
  - 管理者専用ログイン画面 (`/admin/login`) および管理ダッシュボード画面 (`/admin`) を新規作成。
  - 投稿一覧の閲覧、個別・一括削除を行う Server Actions (`admin.ts`) を作成。
  - セッション保護のためのプロキシ (`proxy.ts`) 処理を追加。
  - ダッシュボード内に投稿ステータス（泡沫/遺言）別のタブフィルターおよび詳細情報の折りたたみ表示トグルを実装。

---

### 📅 2026-09-23
#### 1. 共鳴機能のアップデート (回数制限・取り消し・マイリスト・長文展開)
- **編集箇所**: [`src/app/page.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/page.tsx)
- **具体的なプログラム・ドキュメントの編集内容**:
  - 同一投稿に対するユーザーごとの共鳴上限回数を制限し、共鳴の取り消し（アンリゾナンス）機能を実装。
  - 自分が共鳴した投稿のみを集約して閲覧できる「マイリスト」タブを追加。
  - 投稿本文が長文の場合に「もっと見る」で展開・折りたたみが可能なUIを追加。

---

### 📅 2026-06-15
#### 1. Echoes MVP (初期バージョン) 構築
- **編集箇所**:
  - [`src/app/page.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/page.tsx)
  - [`src/app/layout.tsx`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/app/layout.tsx)
  - [`src/lib/supabase.ts`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/src/lib/supabase.ts)
  - [`supabase.sql`](file:///c:/Users/maruy/.gemini/antigravity/workspace/textSNS/supabase.sql)
- **具体的なプログラム・ドキュメントの編集内容**:
  - Next.js (App Router) + Supabase による匿名SNS「Echoes」の基本システムを構築。
  - 泡沫（一定回数閲覧で自動消滅する投稿）および 遺言（永続保存投稿）の基本データ構造とAPI通信処理を実装。
  - 自分の投稿の削除機能、Supabase URLの自動整形ロジックを導入。
