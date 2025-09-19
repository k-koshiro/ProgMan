# Repository Guidelines

## Project Structure & Module Organization
- ルート直下は共有スクリプトと設定ファイル（`package.json`, `start.sh`, `SPEC.md`）を格納し、開発タスクはここから起動します。
- `client/` は React + TypeScript (Vite)。`src/components/` は再利用 UI、`src/pages/` は画面、`src/store/` は状態管理、`src/utils/` はユーティリティ、`src/types/` は型定義、`public/` は静的資産を保持します。
- `server/` は Express + Socket.IO + SQLite。`src/routes/` が REST ルート、`src/db/` が SQLite アクセス、`src/sockets/` がリアルタイムイベント、`src/data/` がシードや定数です。
- テストは実装ファイルと同じ階層に `*.test.ts` / `*.test.tsx` を置き、Playwright 系は `client/tests/` にまとめます。ローカル DB はサーバー起動時に `server/progress-manager.db` が生成されます。

## Build, Test, and Development Commands
- 依存関係一括: `npm run install:all`（client/server の `npm install` を順次実行）。
- 同時ウォッチ開発: `npm run dev` または `./start.sh`（クライアントとサーバーを一括起動。CLI 環境では常駐起動せず利用者側で実行）。
- サーバー単体: `cd server && npm run dev`（ホットリロード）、`npm run build`（トランスパイル）、`npm start`（ビルド成果物起動）。
- クライアント単体: `cd client && npm run dev`（Vite 開発サーバー）、`npm run build`（本番ビルド）、`npm run preview`（ビルド成果物確認）。
- DB 接続検証: 初回サーバー起動後にルートで `node test-db.js` を実行し、テーブル作成と接続性を確認します。

## Coding Style & Naming Conventions
- 全体を TypeScript で統一。インデント 2 スペース、シングルクォート、セミコロン必須。共有設定は `tsconfig.json` を基準に統一します。
- React コンポーネントは PascalCase（例 `ProgressBoard.tsx`）、カスタムフックは `use` プレフィックス（例 `useSchedules.ts`）。
- ユーティリティ関数は camelCase、共通型は `src/types/` に PascalCase で定義。API 呼び出しは `/progress-manager/api/*` をベースにし、フロントも `/progress-manager/` 配下でルーティングします。

## Testing Guidelines
- 単体テストは対象ファイルと同ディレクトリに配置し、命名は `*.test.ts` / `*.test.tsx`。副作用を避け、純粋関数へ切り出して検証します。
- E2E テストは `client/tests/` の Playwright 仕様を拡張します。新規シナリオを追加する場合は対応スクリプトを `package.json` に登録し、実行手順を README や PR に明記します。
- 手動確認は `npm run dev` でクライアント/サーバーを並行起動し、複数ブラウザタブでリアルタイム更新と Socket イベントを確認します。

## Commit & Pull Request Guidelines
- コミットは短い命令形で、日本語カテゴリ接頭辞（例 `修正:`, `機能追加:`）を付けます。1 コミット 1 トピックを徹底し、関係ない差分を混在させないでください。
- PR には目的、主要変更点、確認手順、関連 Issue、影響範囲を記述し、UI 変更時は `/mnt/c/Users/koshiro/Pictures/Screenshots/` から取得したキャプチャを添付します。
- DB スキーマや API を変更した場合はマイグレーション手順とロールバック方法を説明し、`SPEC.md` を更新した旨を必ず記載します。

## Security & Configuration Tips
- 機密情報はリポジトリに含めず、`.env` などで管理します。クライアント環境変数は `VITE_API_BASE_URL` と `VITE_SOCKET_PATH` を設定してください。
- 既定ポートはクライアント `5173`、サーバー `5001`、Socket.IO パスは `/progress-manager/socket.io/`。逆プロキシを使う場合は `client/vite.config.ts` の `server.allowedHosts` を更新し、CORS 設定と合わせます。
- API/アセット配信は `/progress-manager/` のベースパスに揃え、サーバーとクライアントで不整合がないか確認します。

## Agent-Specific Instructions
- 作業前後に意図と結果を簡潔に共有し、冗長な説明は避けます。
- ファイル編集は `apply_patch` を優先し、実施コマンドや再現手順をログに残します。
- 本環境では常駐プロセスを起動しないため、長時間動作が必要なコマンドは利用者に実行を依頼してください。
