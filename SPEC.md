# ProgMan 動作仕様書

## 概要
- 目的: Excel ベースの進捗管理を Web 化し、同時編集・共有を容易にする。
- 技術: React + TypeScript + Vite / Express + Socket.IO + SQLite。
- DB: `server/data/progman.db`（初回起動時に自動作成）。

## システム構成
- クライアント: `client/`（Zustand, Tailwind, socket.io-client）
- サーバー: `server/`（API, WebSocket, SQLite）
- ベースパス: 画面は`/progress-manager/*`、開発時は Vite が API/Socket をプロキシ。

## URL / パス
- 画面: `/progress-manager/projects`, `/progress-manager/schedule/:projectId`, `/progress-manager/comments/:projectId/:date?`
- API（外部から）: `/progress-manager/api/*` → 逆プロキシでサーバー `/api/*` へ。
- Socket.IO（外部から）: `/progress-manager/socket.io/` → 逆プロキシでサーバー `/socket.io/` へ。

## データモデル
- Project: `id, name, base_date?, created_at`
- Schedule: `id, project_id, category, item, owner?, start_date?, duration?, end_date?, progress?, actual_start?, actual_duration?, actual_end?, sort_order, updated_at?`
- CommentPage: `id?, project_id, comment_date(YYYY-MM-DD), created_at?`（`UNIQUE(project_id, comment_date)`）
- Comment: `id?, project_id, owner, comment_date(YYYY-MM-DD), body, updated_at?`（`UNIQUE(project_id, owner, comment_date)`）

## 画面仕様
- 製番一覧: 一覧表示/新規作成/名称・基準日編集/削除、コメント画面への導線。
- スケジュール: カテゴリ毎の表。カテゴリ行で担当一括編集、セル編集は日付（カレンダー/直接入力）・日数・進捗。終了日は表示専用（クライアント側は開始含む`duration-1`日で算出）。
- 担当コメント:
  - URL は `/comments/:projectId/:date?`。`:date` 未指定時は最新ページに自動遷移し、存在しない日付指定時も最新へ誘導。
  - コメントは「コメントページ（日付バージョン）」単位で保存。未来・過去いずれも作成/編集/削除可能で、空ページ作成も許容する。
  - ページ操作 UI: 最新日表示、日付リスト（降順）、カレンダー入力での新規作成（「●月●日バージョンのコメントページを新規作成」ボタン）、選択ページ削除、担当フィルタ。
  - ページ選択時のみコメントの編集が可能（未選択時は入力欄を無効化）。保存は 1 秒デバウンスで実行。
  - 各カテゴリカードには進捗管理表で設定した担当者を「（担当: 氏名）」形式で表示し、未設定時は「未設定」と明示する。担当フィルタはカテゴリ名と担当者名どちらにもマッチする。
  - ページ上部に「マイルストーン」2段ボードを表示（コメントページ操作パネルより前に配置）。
    - 上段: 各マイルストーンの名称セル（色付き、白文字）。
    - 下段: 予定日（`start_date`）を `YYYY/M/D (曜)` で表示。左右は太線枠、各セルに罫線。
    - 抽出元: 進捗表のカテゴリが「マイルストーン」の行。
    - データが無い場合はボード非表示（フォールバック可）。
  - 固定セクション（全体報告+左右担当）を取得してページ日付ごとに upsert。
  - デフォルトのカテゴリ配置は左列「デザイン→メカ→ハード→ゲージ」、右列「企画→画像→サブソフト→メインソフト→サウンド」。不足カテゴリは左右列の短い方に追加し、サブソフトも表示対象に含める。
  - 既存データでカテゴリが「サブ」や「デバック（旧デバッグ表記）」の場合は「サブソフト」として自動表示し、DB も起動時に正規化する。

## API 仕様（主要）
- Projects
  - GET `/api/projects` 全件（作成降順）
  - POST `/api/projects` `{ name, base_date? }` 作成
  - PUT `/api/projects/:id` `{ name?, base_date? }` 更新（基準日変更時は「sort_order 最先頭で開始日あり」のタスク開始日との差で予定日を一括シフト）
  - DELETE `/api/projects/:id` プロジェクトと配下スケジュール削除
- Schedules
  - GET `/api/schedules/:projectId` 一覧。レスポンス生成時、`start_date + duration` で `end_date` を算出（開始日非包含。クライアントと+1日の差が出る）。
  - PUT `/api/schedules/:id` 一部更新。`duration/actual_duration` の0は `null` へ。`category/item/sort_order/project_id` は不変。
- Upload
  - POST `/api/upload/excel` フォーム`file`（`.xlsx/.xlsm/.xls`）と `projectId`。見出し自動検出、全角→半角、複数日付形式対応。先頭の開始日を `base_date` に同期し、既存スケジュールを全置換。
- Comments
  - GET `/api/comments/sections` 固定配置を返却（サーバー内ハードコード）
  - GET `/api/comments/:projectId/pages` コメントページ一覧と `latestDate` を返却（降順）
  - POST `/api/comments/:projectId/pages` `{ comment_date }` でページ作成（重複時 409）
  - DELETE `/api/comments/:projectId/pages/:date` ページ削除（対応するコメントも一括削除）
  - GET `/api/comments/:projectId?date=YYYY-MM-DD` 指定日付ページのコメント一覧を返却。`date` 省略時は最新ページ。未存在は 404
  - POST `/api/comments` Upsert（`project_id, owner, comment_date` で一意。ページ未作成の場合は自動で `comment_pages` に登録）

- Version: GET `/api/version` `{ commit, timestamp, buildTime }`

## WebSocket
- 参加: `join-project` で `project-{id}` ルーム、`join-comment-page` で `project-{id}-{date}` ルームへ。
- 通知: `update-schedule` 受信→最新一覧を `schedules-updated` で配信。コメントは HTTP 保存時に `comments-updated`（`{ date, comments }`）を対象ページへ、ページ作成/削除時に `comment-page-created` / `comment-page-deleted` をプロジェクト全体へブロードキャスト。

## 既知の注意点
- 終了日算出の差異（サーバーは開始非包含、クライアントは開始包含）により1日ずれる。統一要。
- 初期スケジュール生成用 `initializeProjectSchedules` は未呼び出し（Excel 取り込みで初期化する想定）。
- `.env` の `VITE_API_BASE_URL`/`VITE_SOCKET_PATH` は現行コードで未参照（パスは固定文字列）。運用時は逆プロキシで `/progress-manager/*` を維持。
- 認証/権限は未実装（CORS/allowedHosts でローカル/社内ホスト想定）。

## リファクタリング候補メモ
- **候補E: コメントカテゴリの単一ソース化**（優先度 1.50 / 難易度 2 / 効果 3）
  - 左右列の配置と既定順序をサーバー・クライアントで共有するモジュールに寄せる。
  - 目的: fetch 失敗時のフォールバック差異や共有ロジックの重複を排除。
- **候補B: カテゴリ正規化ロジック共通化**（優先度 1.33 / 難易度 3 / 効果 4）
  - `normalizeSectionName` と DB 正規化処理を共有ユーティリティ化し、マッピング変更時の反映漏れを防ぐ。
- **候補A: CommentsPage 分割**（優先度 1.25 / 難易度 4 / 効果 5）
  - 大規模コンポーネントをデータ取得フックと表示コンポーネントへ分離。副作用やデバウンス処理を単体テスト可能にする。
- **候補C: useCommentStore 整理**（優先度 1.00 / 難易度 3 / 効果 3）
  - API と Socket の責務を分離し、テスト用モックを組みやすくする。
- **候補D: server/db/queries.ts 分割**（優先度 1.00 / 難易度 4 / 効果 4）
  - ドメイン別のクエリモジュールに分解し、移行処理やテスト追加を容易にする。

## 開発/起動
```
npm run install:all
npm run dev            # client:5173 / server:5001（プロキシ有）
# 本番相当:
cd server && npm run build && npm start
cd client && npm run build && npm run preview
# DB 確認:
node test-db.js
```
