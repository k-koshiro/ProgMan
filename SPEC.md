# ProgMan 動作仕様書

## 概要
- 目的: Excel的な進捗管理をWeb化し、同時編集・共有を容易にする。
- 技術: React + Vite（TS）/ Express（TS）+ SQLite + Socket.IO。
- ベースパス: クライアント/APIともに`/progress-manager`配下。

## システム構成
- クライアント: `client/`（React, Zustand, Tailwind）
- サーバ: `server/`（Express, SQLite, Socket.IO）
- DB: `server/data/progman.db`（自動生成）

## URL / パス
- 画面: `/progress-manager/projects`, `/progress-manager/schedule/:projectId`
- API: `/progress-manager/api/*`
- Socket: クライアント`/progress-manager/socket.io/`（プロキシ前提）

## データモデル
- Project: `{ id, name, created_at }`
- Schedule: `{ id, project_id, category, item, owner?, start_date?, duration?, end_date?, progress?, actual_start?, actual_duration?, actual_end?, sort_order, updated_at? }`

## 画面仕様
- 製番一覧
  - 一覧/作成/名称変更/削除（確認ダイアログ）。
  - カードクリックで対象のスケジュールへ遷移。
- スケジュール
  - カテゴリごとに表示し、カテゴリ行に平均進捗バー。
  - 担当者はカテゴリ単位で一括編集。
  - 予定/実績: 開始日（カレンダー/直接入力 YYYY-MM-DD）、日数（数値）。
  - 終了日は表示専用（開始日+日数−1日）。
  - 進捗は0–100%（5%刻みで丸め、範囲内にクランプ）。

## 同期/リアルタイム
- 更新フロー: HTTP PUTで保存 → `update-schedule`をemit → サーバが対象ルームへ`schedules-updated`を配信。
- 初期化: プロジェクト作成時/スケジュール0件の取得時に`initialData`から自動生成。

## API 仕様（主要）
- GET `/api/projects`: 全件取得（作成日時降順）。
- POST `/api/projects` `{ name }`: 作成（スケジュール初期化はベストエフォート）。
- PUT `/api/projects/:id` `{ name }`: 名称更新。
- DELETE `/api/projects/:id`: プロジェクトと配下スケジュールを削除。
- GET `/api/schedules/:projectId`: 取得（必要時は初期化）。
- PUT `/api/schedules/:id` `Partial<Schedule>`: 一部更新（`category/item/project_id/sort_order`は不変）。
- GET `/api/version`: `{ commit, timestamp, buildTime }`。

## WebSocket 仕様
- 参加: `join-project`で`project-{id}`ルームに参加。
- 通知: `update-schedule`受信→DB最新を取得→`schedules-updated`を同一ルームへブロードキャスト。

## 既知の注意点
- 終了日計算の差異: クライアントは「開始含む日数（−1日）」、サーバは`start+duration`計算の実装箇所あり。保存/表示で1日差が出る可能性があるため統一検討が必要。
- 認証/権限: 未実装（社内ネットワーク前提）。

## 開発/起動
```bash
# 依存関係
npm run install:all
# 同時起動
./start.sh    # または npm run dev
# 個別
cd server && npm run dev
cd client && npm run dev
# DB簡易確認
node test-db.js
```
