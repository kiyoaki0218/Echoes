# Echoes 残響 - 更新実績・変更履歴 (CHANGELOG)

このドキュメントは、これまでに実施したプログラムの具体的な編集内容、編集箇所、および更新実績を記録するためのものです。
今後は未実装タスクを管理する `TODO.md`（更新予定）とセットで更新・運用を行います。

---

## 📜 更新履歴一覧

### 📅 2026-10-04 (12回目)
#### 10. プロモーション投稿機能
- **編集箇所**:
  - `supabase.sql`
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
  - `src/app/page.tsx`
  - `TODO.md`
  - `CHANGELOG.md`
- **わかりやすい編集内容**:
  - 管理者ダッシュボードの各投稿に「★」ボタンを追加。クリックするとその投稿をプロモーション（優先表示）ON/OFFできる。
  - プロモーション中の投稿には amber色の「★ PR」バッジがテーブル・モバイルカードの両方に表示される。
  - メイン画面でも、プロモーション投稿が表示された際はモードタグ（泡沫/遺言）の横に amber色「★ PR」バッジを表示。
  - プロモーション優先ロジックはDB側のRPC関数で管理：プロモーション投稿が存在する場合、30%の確率でプロモーション投稿を優先返却し、残り70%は通常ランダム取得。プロモーション投稿がなければ通常ランダム取得にフォールバック。
  - 操作はadmin権限のみ可能（viewer権限にはボタン非表示）。
- **具体的なプログラムの編集内容**:
  - `supabase.sql`: `echoes` テーブルに `is_promoted` カラム（boolean, default false, not null）を `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` で追加。`get_random_echo(post_mode)` 関数を `CREATE OR REPLACE` で上書き。promoted投稿件数を事前に取得し、件数>0 かつ `random() < 0.3` の場合は `is_promoted = true` の投稿からランダム返却、それ以外は全件からランダム返却するロジックに変更。
  - `src/app/actions/admin.ts`: `togglePromoteEcho(id: string, isPromoted: boolean)` Server Action を追加。admin権限チェック後、Supabase の `echoes` テーブルの `is_promoted` を指定値に update。
  - `src/app/admin/page.tsx`: `togglePromoteEcho` を追加インポート。`Star` アイコンを追加インポート。`Echo` 型に `is_promoted?: boolean` を追加。`handleTogglePromote(id, current)` ハンドラーを追加（楽観的UI更新付き）。デスクトップテーブルのモードバッジ列に amber 色の「★ PR」バッジを追加。テーブル操作列に admin 専用のプロモーション切り替えボタン（★アイコン、ON時は fill-amber-400）を追加。モバイルカードにも同様のバッジとボタンを追加。
  - `src/app/page.tsx`: `Echo` 型に `is_promoted?: boolean` を追加。`Star` アイコンを追加インポート。モードタグ表示部分（泡沫/遺言バッジ）を `flex` コンテナに変更し、`is_promoted === true` の場合に amber 色「★ PR」バッジを横並びで表示。

### 📅 2026-10-04 (11回目)
#### 9. 管理者公式お知らせ（公式タグ）投稿・管理 & 期間自動削除システム
- **編集箇所**:
  - `supabase.sql`
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
  - `src/app/page.tsx`
  - `TODO.md`
  - `CHANGELOG.md`
- **わかりやすい編集内容**:
  - 管理者ダッシュボードに「公式お知らせ」タブを新設。タブ切り替えで投稿管理とお知らせ管理を切り替えられる。
  - お知らせはタイトル・本文・掲載開始日時・掲載終了日時・ピン留めフラグを持ち、admin権限のみ作成・編集・削除が可能。viewer権限は閲覧専用。
  - 掲載期間が現在時刻の範囲内にあるお知らせのみメイン画面に表示され、期間外（掲載前・期限切れ）は自動的に非表示になる。
  - メイン画面のヘッダー直下に「公式」バッジ付きのお知らせバナーを固定表示。複数件ある場合は前後ナビゲーション（カルーセル）で切り替え可能。
  - ピン留め設定したお知らせは最上部に優先表示され、ピンアイコンで識別できる。
  - ダッシュボードのお知らせ一覧には掲載前・掲載中・期限切れのステータスバッジを色分け表示。「期限切れ削除」ボタンで一括クリーンアップも可能。
- **具体的なプログラムの編集内容**:
  - `supabase.sql`: `announcements` テーブルを新規作成（id/created_at/updated_at/title/content/is_pinned/publish_start/publish_end）。RLS全操作許可ポリシーを追加。`get_active_announcements()` 関数（`now() >= publish_start AND now() < publish_end` の条件で絞り込み、is_pinned降順→publish_start降順でソート）を追加。`delete_expired_announcements()` 関数（期限切れを物理削除して削除件数を返す）を追加。
  - `src/app/actions/admin.ts`: `Announcement` 型を export。`getAdminAnnouncements()`（全件、管理画面用）、`getActiveAnnouncements()`（RPCで期間内のみ、メイン画面用・認証不要）、`createAnnouncement(params)`、`updateAnnouncement(id, params)`（updated_at自動更新）、`deleteAnnouncement(id)`、`purgeExpiredAnnouncements()`（RPC呼び出し）の6関数を追加。write系は全て admin 権限チェック付き。
  - `src/app/admin/page.tsx`: インポートに `getAdminAnnouncements`・`createAnnouncement`・`updateAnnouncement`・`deleteAnnouncement`・`purgeExpiredAnnouncements`・`Announcement` 型と `Megaphone`・`Pin`・`PinOff`・`Plus`・`Pencil`・`Clock` アイコンを追加。`pageTab`（"echoes" | "announcements"）state を追加してヘッダー下にタブUIを実装。お知らせ用 state 群（`announcements`・`annLoading`・`annError`・`annModalOpen`・`annEditing`・フォーム各フィールド・`annSaving`・`annFormError`）を追加。`fetchAnnouncements`・`openAnnCreate`・`openAnnEdit`・`handleAnnSave`・`handleAnnDelete`・`handlePurgeExpired`・`getAnnStatus`・`toDatetimeLocal` 関数を追加。既存の投稿管理UIを `{pageTab === "echoes" && ...}` で囲み、お知らせ管理UI（カード一覧＋作成/編集モーダル）を `{pageTab === "announcements" && ...}` ブロックとして追加。
  - `src/app/page.tsx`: `getActiveAnnouncements` と `Announcement` 型、`Megaphone`・`Pin`・`ChevronLeft`・`ChevronRight` アイコンを追加インポート。`announcements` と `annIndex`（カルーセル用）の state を追加。`useEffect` 内で `getActiveAnnouncements()` を呼び出して初期取得。ヘッダー直下にお知らせバナーUIを追加（公式バッジ・ピン留めアイコン・タイトル・本文2行表示・複数件カルーセルナビ、0件時は非表示）。

### 📅 2026-10-04 (10回目)
#### 8. ダッシュボードからの投稿機能（個人アカウントとして）
- **編集箇所**:
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
  - `TODO.md`
  - `CHANGELOG.md`
- **わかりやすい編集内容**:
  - 管理者ダッシュボードのヘッダーに「投稿する」ボタン（`PenTool` アイコン）を追加。admin権限を持つユーザーのみ表示され、viewer権限では非表示。
  - ボタン押下でモーダルが開き、泡沫（短文・60文字）と遺言（長文・800文字）を切り替えて通常投稿と同じ条件で投稿できる。
  - テキストエリアの右下にリアルタイム文字数カウンターを表示（90%超で amber 色に変化）。
  - 投稿完了後、ダッシュボードの一覧とサマリー統計を自動更新。
  - サーバー側でもadmin権限チェック・文字数バリデーション・max_views自動設定（bubble=100/will=500）を実施。
- **具体的なプログラムの編集内容**:
  - `src/app/actions/admin.ts`: `createAdminEcho(content: string, mode: "bubble" | "will")` Server Action を追加。admin権限チェック（viewer・未認証は拒否）、トリム後の空文字チェック、モード別文字数上限チェック（bubble=60/will=800）、Supabase への insert（max_views を mode に応じて自動設定）を実装。
  - `src/app/admin/page.tsx`: `createAdminEcho` と `PenTool` アイコンを追加インポート。`postModalOpen`・`postContent`・`postMode`・`posting`・`postError` の5つの state を追加。`handleOpenPostModal()`（state初期化してモーダルを開く）と `handlePost()`（Server Action呼び出し→成功時に一覧・統計を再取得）ハンドラーを追加。ヘッダーのボタン群に role === "admin" のみ表示される「投稿する」ボタンを追加。JSX末尾に投稿フォームモーダル（オーバーレイ＋カード形式）を追加。モーダル内にモード切替タブ・テキストエリア（文字数カウンター付き）・エラー表示・キャンセル/投稿ボタンを実装。

### 📅 2026-10-04 (9回目)
#### 7. 一般ユーザーからの「通報」機能 ＆ ダッシュボード連動
- **編集箇所**:
  - `supabase.sql`
  - `src/app/page.tsx`
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
  - `TODO.md`
  - `CHANGELOG.md`
- **わかりやすい編集内容**:
  - メイン画面の投稿UIにおいて、共鳴ボタンの横に通報ボタンを「小さく」配置。
  - 通報は `localStorage`（`reported_echoes`）を使用して1投稿につき1ブラウザ1回のみに制限。
  - 通報発生時にDBの `report_count` カラムをインクリメント。
  - ダッシュボード（管理画面）に「通報投稿」サマリーカードを追加し、通報された投稿（`report_count > 0`）を警告ハイライト表示（ローズ色背景・枠線および通報バッジ表示）。
  - ダッシュボードのソート項目に「通報数」を追加。
  - ダッシュボードで管理者権限（`admin`）を持つユーザーのみ通報カウントを0にリセットできるボタン（`RotateCcw`）を追加（`viewer` ロールではリセット不可）。
  - ダッシュボードの表示ページ切り替え（ページネーションボタン）を下部だけでなく上部付近にも配置。
- **具体的なプログラムの編集内容**:
  - `supabase.sql`: `echoes` テーブルに `report_count` (integer, default 0, not null) カラムを追加。通報インクリメント関数 `report_post` RPCを追加。
  - `src/app/page.tsx`: `Echo` 型に `is_reported?: boolean` を対応。`getReportedIds` / `saveReportedIds` ヘルパー関数と `reportedIds` / `reportLoading` state を追加。RPC `report_post` を実行する `handleReport` ハンドラーを追加。メイン表示UIの共鳴ボタン横に通報ボタン（`Flag` アイコン、通報済み非活性表示）を小さく追加。
  - `src/app/actions/admin.ts`: `getAdminEchoes` の `sortBy` 型に `"report_count"` を追加。`getAdminStats` で通報投稿数 `reportedCount` の集計を追加。管理者専用アクション `resetAdminReport(id)` を追加（`role !== "admin"` の場合に拒否）。
  - `src/app/admin/page.tsx`: インポートに `resetAdminReport` および `Flag`, `RotateCcw`, `ShieldAlert` を追加。`Echo` 型・`SortBy` 型・`SORT_LABELS` に通報数を追加。`handleResetReport` ハンドラーを追加。サマリーカードに通報投稿集計カードを追加。上部および下部に `renderPagination` を配置。テーブル・モバイルカードで通報件数がある場合に警告ハイライトと通報件数バッジ、および管理者向け通報リセットボタンを表示。

### 📅 2026-09-23 (8回目)
#### 6. 閲覧専用（ビューアー）権限の追加
- **編集箇所**:
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
  - `.env.local`（コメント追記のみ）
- **わかりやすい編集内容**:
  - 管理者パスコード（`ADMIN_PASSCODE`）とは別に閲覧専用パスコード（`VIEWER_PASSCODE`）を追加。ログイン時に入力したパスコードでロールが自動判別される。
  - 閲覧専用ユーザーはダッシュボードの閲覧・検索・ソートはすべて利用できるが、投稿の削除ボタンが非活性（グレーアウト）になり操作不可になる。
  - ダッシュボードのヘッダーに「閲覧専用モード — 削除・編集操作は無効」バッジを表示してロールを明示。
  - サーバー側でも `deleteAdminEcho` に権限チェックを追加し、viewer が直接 Action を呼んでも拒否される二重ガードを実装。
- **具体的なプログラムの編集内容**:
  - admin.ts: `VIEWER_PASSCODE` 定数を追加（env 未設定時は `"viewer"` にフォールバック）。`AdminRole = "admin" | "viewer"` 型を追加。`getAdminRole()` 関数を追加（クッキーの `admin_token` 値が `"authenticated"` なら `"admin"`、`"viewer"` なら `"viewer"`、それ以外は `null` を返す）。`loginAdmin` を拡張し、管理者パスコード一致時は `"authenticated"`、閲覧専用パスコード一致時は `"viewer"` をクッキーにセット。`getAdminEchoes`・`getAdminStats` の認証チェックを `getAdminRole()` ベースに変更（role が null なら Unauthorized）。`deleteAdminEcho` に `role !== "admin"` のチェックを追加し、viewer がアクセスすると「この操作には管理者権限が必要です」エラーを返す。
  - admin/page.tsx: `getAdminRole` をインポート追加。`AdminRole` 型と `role` state を追加。`useEffect` で初回マウント時に `getAdminRole()` を呼び出し `role` に保存。ヘッダーの説明文を `role === "viewer"` の場合に amber 色の「閲覧専用モード」バッジに切り替え。テーブルの削除 `<button>` とモバイルカードの削除 `<button>` をそれぞれ `role === "admin"` の場合のみ活性ボタンで表示し、それ以外は `cursor-not-allowed` の薄いアイコンに差し替え。
  - .env.local: `ADMIN_PASSCODE` と `VIEWER_PASSCODE` の設定例をコメントとして追記。

---

### 📅 2026-09-23 (7回目)
#### 6. ダッシュボードに昇順/降順ソート機能を追加
- **編集箇所**:
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
- **わかりやすい編集内容**:
  - デスクトップのテーブルヘッダー「投稿日時」「閲覧数」「残り回数」「共鳴数」をクリックで昇順/降順に切り替え可能にした。同じ列を再クリックで方向が反転し、別の列をクリックすると降順からリスタート。ソート中の列は ▲/▼ アイコンでハイライト表示。
  - モバイルではカードリスト上部に「並び替え」セレクタ（列選択）＋「昇順/降順」トグルボタンを配置。
  - テーブルに「残り回数」列を新規追加。10 以下になると赤でハイライト。モバイルカードにも同じく残り回数を表示。
- **具体的なプログラムの編集内容**:
  - admin.ts: `getAdminEchoes()` に `sortBy: "created_at" | "view_count" | "resonance_count" | "remaining_views"` と `sortDir: "asc" | "desc"` 引数を追加。`remaining_views` は DB の計算列ではないため `view_count` で代替ソートし方向を逆転させる処理を実装。`.order(dbSortColumn, { ascending: dbSortAsc })` で Supabase クエリに適用。
  - admin/page.tsx: `SortBy` / `SortDir` 型を定義。`SORT_LABELS` 定数マップを追加。`sortBy`・`sortDir` state を追加。`fetchEchoes` の引数に `sb`・`sd` を追加し `useEffect` の依存配列にも含めた。ヘッダーの「更新」ボタンにも `sortBy`/`sortDir` を渡すよう修正。`handleSort()` 関数（同列クリックで方向反転・別列クリックで降順リセット）を追加。`SortIcon` コンポーネント（未選択: `ArrowUpDown` 薄表示 / 選択中昇順: `ArrowUp` / 選択中降順: `ArrowDown`）を追加。`SortTh` コンポーネント（クリック可能な `<th>` + アイコン）を追加し「投稿日時」「閲覧数」「残り」「共鳴数」ヘッダーに適用。テーブルに「残り」列を追加（`Math.max(0, max_views - view_count)` を表示、10 以下で `text-red-400`）。モバイル向けに `<select>` + 昇降トグルボタンのソートセレクターを `md:hidden` で追加。`lucide-react` から `ArrowUpDown`・`ArrowUp`・`ArrowDown` を追加インポート。

---

### 📅 2026-09-23 (6回目)
#### 5. 投稿の個別直リンク機能を追加
- **編集箇所**:
  - `src/app/page.tsx`
  - `src/app/admin/page.tsx`
- **わかりやすい編集内容**:
  - ダッシュボードのテーブル各行（デスクトップ）・カード各件（モバイル）に「新しいタブで直表示」ボタン（`ExternalLink` アイコン）を追加。
  - クリックすると `/?echo=<id>` をブラウザの新しいタブで開き、対象の投稿のみをメインページに直接表示できる。
  - メインページは `?echo=<id>` クエリを受け取った場合、ランダム表示ではなく指定 ID の投稿を Supabase から直接取得して初期表示する（管理者プレビューのため閲覧カウントはインクリメントしない）。
- **具体的なプログラムの編集内容**:
  - page.tsx: `Suspense` を React からインポート追加。`useSearchParams` を `next/navigation` からインポート追加。`export default function Home()` を `function HomeContent()` にリネームし、冒頭で `useSearchParams()` を呼び出して `echoIdFromUrl` を取得。`useEffect` 初期化処理で `echoIdFromUrl` がある場合は Supabase から `.eq("id", echoIdFromUrl).single()` で取得し `setCurrentEcho` / `setMode` に設定（取得失敗時は通常のランダム表示にフォールバック）。ファイル末尾に `export default function Home()` を追加し `<Suspense fallback={null}><HomeContent /></Suspense>` を返す（`useSearchParams` の静的プリレンダリング要件を満たすため）。
  - admin/page.tsx: `lucide-react` から `ExternalLink` を追加インポート。デスクトップテーブルの操作 `<td>` を `<div className="flex...gap-1">` で囲み、削除ボタンの前に `<a href={\`/?echo=${echo.id}\`} target="_blank" rel="noopener noreferrer">` の直リンクボタンを追加。モバイルカードのカードヘッダーも同様に削除ボタンを `<div className="flex...gap-1 shrink-0">` で囲み直リンクボタンを追加。

---

### 📅 2026-09-23 (5回目)
#### 4. ダッシュボードのスマホ対応（レスポンシブ化）
- **編集箇所**: `src/app/admin/page.tsx`
- **わかりやすい編集内容**:
  - モバイル端末（`md` 未満）ではテーブルを非表示にし、代わりにカード型リストを表示するよう切り替え。
  - ヘッダーのボタンをモバイルではアイコンのみ表示（`hidden md:inline` でテキストを隠す）。
  - 検索・日時フィルターパネルをモバイルではトグルボタンで開閉できるよう変更（絞り込み適用中は「適用中」バッジを表示）。
  - サマリーカードのフォントサイズ・余白をモバイル向けに縮小調整。
  - モードフィルタータブをループで生成するよう整理し、モバイルでは文字・余白を小さく調整。
- **具体的なプログラムの編集内容**:
  - `lucide-react` から `Menu` を追加インポート。
  - `searchOpen` state を追加し、モバイル用検索パネルの開閉を管理。`handleSearch` 呼び出し時に `setSearchOpen(false)` してパネルを閉じる。
  - ヘッダーボタンに `px-3 md:px-4`・`<span className="hidden md:inline">` を適用。
  - サマリーカードグリッドを `gap-3 md:gap-4`、パディングを `p-3 md:p-4`、文字サイズを `text-[11px] md:text-xs` / `text-xl md:text-2xl` に変更。
  - 検索パネルに `<button className="md:hidden ...">` のトグルボタンを追加。パネル本体を `${searchOpen ? "block" : "hidden md:block"}` で制御。日付ピッカーに `flex-1 min-w-[130px]` を追加して折り返しを許可。
  - モードフィルターを `["all","bubble","will"]` のループに変更し、`px-4 md:px-6 py-1.5 md:py-2 text-xs md:text-sm` でサイズ調整。
  - テーブルブロックを `<div className="hidden md:block ...">` で包み、デスクトップ専用に。
  - モバイル用カードブロック `<div className="md:hidden space-y-3 ...">` を新規追加。各カードはヘッダー（モードバッジ・日時・削除ボタン）、本文（折りたたみ対応）、フッター（閲覧数・共鳴数）で構成。
  - 空件数表示と `error` 表示を `loading` 判定の外に独立させてシンプル化。

---

### 📅 2026-09-23 (4回目)
#### 4. 「自分の残響」モーダルに「すべて」タブ・キーワード検索・日時フィルターを追加
- **編集箇所**: `src/app/page.tsx`
- **わかりやすい編集内容**:
  - 「自分の残響」モーダルのタブに「すべて」を追加（短文/長文/すべての3択）。
  - テキストによるキーワード検索バーを追加（リアルタイム絞り込み）。
  - 投稿日の範囲指定フィルター（開始日〜終了日）を追加。
  - 絞り込み中は「クリア」ボタンを表示し、一括リセット可能。
  - 件数表示を追加（絞り込み中は「検索結果: N件」に切り替え）。
- **具体的なプログラムの編集内容**:
  - `MyEchoStatus` 型に `created_at: string` フィールドを追加。
  - `saveMyEcho()` の引数に `createdAt: string` を追加し、localStorage の各エントリに `created_at` を保存。
  - `fetchMyEchoesStatus()` の Supabase クエリに `created_at` を追加。既存の localStorage エントリに `created_at` がない場合は DB から取得した値を書き戻すマイグレーション処理を実装。
  - `type MyListTab = "all" | "bubble" | "will"` を追加し、`myListTab` の型を `Mode` から `MyListTab` に変更。`openMyList()` のデフォルトタブを `"all"` に変更。
  - `myKeyword`・`myDateFrom`・`myDateTo` の state を追加。
  - `filteredMyEchoes` をタブ・キーワード・日時でクライアントサイド絞り込みする派生値として導出（タブで mode 一致、ilike 相当の大文字小文字無視の includes、JST 基準の日時比較）。
  - `isMyFiltered` フラグと `clearMyFilter()` 関数を追加。
  - モーダル内タブを `["all","bubble","will"]` のループで生成するよう変更。検索バー・日時ピッカー・件数表示を追加。リストのレンダリングソースを `filteredMyEchoes` に統一。
  - lucide-react から `Search` を追加インポート。

---

### 📅 2026-09-23 (3回目)
#### 3. ダッシュボードへのキーワード検索 ＆ 日時フィルター追加
- **編集箇所**:
  - `src/app/actions/admin.ts`
  - `src/app/admin/page.tsx`
- **わかりやすい編集内容**:
  - ダッシュボードのフィルターエリアに、投稿テキストのキーワード検索バーと投稿日の範囲指定（開始日〜終了日）を追加。
  - 「検索」ボタンまたは Enter キー押下で絞り込みを実行。条件がある場合は「クリア」ボタンで一括リセット可能。
  - 検索中は件数表示が「検索結果: N件」に切り替わり、ヒットなしの場合は「条件に一致する投稿がありません」を表示。
- **具体的なプログラムの編集内容**:
  - admin.ts: `getAdminEchoes()` に `keyword: string`・`dateFrom: string`・`dateTo: string` 引数を追加。keyword は Supabase の `.ilike("content", \`%${keyword.trim()}%\`)` で大文字小文字を区別しない部分一致検索を実装。dateFrom / dateTo は `YYYY-MM-DD` 形式を受け取り、`new Date(\`${date}T00:00:00+09:00\`)` で JST 基準の ISO 文字列に変換して `.gte()` / `.lte()` を適用。
  - admin/page.tsx: `lucide-react` から `Search`・`X` を追加インポート。`keyword`・`dateFrom`・`dateTo`（入力中の値）と `appliedKeyword`・`appliedDateFrom`・`appliedDateTo`（確定済みの値）の計6つの state を追加。`isFiltered` フラグ（確定済み条件が1つでもある場合に true）を導出。`fetchEchoes` の引数を `(page, mode, kw, df, dt)` 形式に拡張し、`useEffect` の依存配列に applied 系 state を追加。`handleSearch`（確定処理）・`handleKeyDown`（Enter 対応）・`handleClearSearch`（全リセット）を追加。検索パネル UI（キーワード入力 + 検索/クリアボタン + 日付範囲ピッカー）をサマリーカード直下に配置。

---

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
