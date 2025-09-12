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
- 画面: `/progress-manager/projects`, `/progress-manager/schedule/:projectId`, `/progress-manager/comments/:projectId`
- API（外部から）: `/progress-manager/api/*` → 逆プロキシでサーバー `/api/*` へ。
- Socket.IO（外部から）: `/progress-manager/socket.io/` → 逆プロキシでサーバー `/socket.io/` へ。

## データモデル
- Project: `id, name, base_date?, created_at`
- Schedule: `id, project_id, category, item, owner?, start_date?, duration?, end_date?, progress?, actual_start?, actual_duration?, actual_end?, sort_order, updated_at?`
- Comment: `id?, project_id, owner, comment_date(YYYY-MM-DD), body, updated_at?`（`UNIQUE(project_id, owner, comment_date)`）

## 画面仕様
- 製番一覧: 一覧表示/新規作成/名称・基準日編集/削除、コメント画面への導線。
- スケジュール: カテゴリ毎の表。カテゴリ行で担当一括編集、セル編集は日付（カレンダー/直接入力）・日数・進捗。終了日は表示専用（クライアント側は開始含む`duration-1`日で算出）。
- 担当コメント:
  - ページ上部に「マイルストーン」2段ボードを表示（スクリーンショット準拠）。
    - 上段: 各マイルストーンの名称セル（色付き、白文字）。
    - 下段: 予定日（`start_date`）を `YYYY/M/D` で表示。左右は太線枠、各セルに罫線。
    - 抽出元: 進捗表のカテゴリが「マイルストーン」の行。
    - データが無い場合はボード非表示（将来フォールバック可）。
  - 固定セクション（全体報告+左右担当）を取得して当日分を upsert。履歴表示・担当フィルタあり。

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
  - GET `/api/comments/:projectId` 一覧（`comment_date DESC, updated_at DESC`）
  - POST `/api/comments` Upsert（`project_id, owner, comment_date`で一意。`comment_date`省略時は当日）

- Version: GET `/api/version` `{ commit, timestamp, buildTime }`

## WebSocket
- 参加: `join-project` で `project-{id}` ルームへ。
- 通知: `update-schedule` 受信→最新一覧を `schedules-updated` で配信（保存はHTTP側）。`update-comment` 受信→ `comments-updated` で配信。

## 既知の注意点
- 終了日算出の差異（サーバーは開始非包含、クライアントは開始包含）により1日ずれる。統一要。
- 初期スケジュール生成用 `initializeProjectSchedules` は未呼び出し（Excel 取り込みで初期化する想定）。
- `.env` の `VITE_API_BASE_URL`/`VITE_SOCKET_PATH` は現行コードで未参照（パスは固定文字列）。運用時は逆プロキシで `/progress-manager/*` を維持。
- 認証/権限は未実装（CORS/allowedHosts でローカル/社内ホスト想定）。

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
