# Repository Guidelines

本書は ProgMan（React/Vite クライアント + Express/SQLite サーバー）の貢献作業を円滑にするための実践ガイドです。最小の手順で開発・検証・レビューを進められるよう要点のみ記します。

## プロジェクト構成 / モジュール
- ルート: 共有スクリプトと設定（`package.json`, `start.sh`）。
- `client/`: React + TypeScript（Vite）。主要ディレクトリ: `src/components/`, `src/pages/`, `src/store/`, `src/utils/`, `src/types/`。
- `server/`: Express + Socket.IO + SQLite。主要ディレクトリ: `src/routes/`, `src/db/`, `src/sockets/`, `src/data/`。
- パス: API は `/progress-manager/api/*`、クライアント資産は `/progress-manager/` 配下で提供。

## ビルド・テスト・開発コマンド
- 依存関係: `npm run install:all`（client/server を一括インストール）。
- 同時起動: `npm run dev` または `./start.sh`（双方をウォッチで起動）。
- サーバー: `cd server && npm run dev` / ビルド `npm run build` / 実行 `npm start`。
- クライアント: `cd client && npm run dev` / ビルド `npm run build` / 確認 `npm run preview`。
- DB 確認: 初回サーバー起動後に `node test-db.js`。

## コーディング規約 / 命名
- 言語: TypeScript（client/server 共通）。インデント 2 スペース、シングルクォート、セミコロン必須。
- コンポーネント: PascalCase（例 `ProgressBar.tsx`）。
- フック: `use` 接頭辞（例 `useDebounce.ts`）。
- ユーティリティ: camelCase（例 `dateCalculations.ts`）、型は `src/types/` に PascalCase。
- API ルートは `/api/*`。クライアントのリクエストは `/progress-manager` 接頭辞を維持。

## テスト方針
- 公式ランナーは未導入。`utils/` や `db/` に小さく純粋な関数を優先。
- 手動確認: クライアント＋サーバーを起動→プロジェクト作成→スケジュール編集→ブラウザ 2 タブでリアルタイム更新を確認。
- 追加する場合: `*.test.ts`/`*.test.tsx` をソースと同階層に配置し、ランナーを `package.json` に明記。

## コミット / プルリクエスト
- コミット: 短く命令形。日本語カテゴリ接頭辞を推奨（例 `修正: …`, `機能追加: …`）。
- PR 必須項目: 目的/概要、関連 Issue、確認手順、UI 変更はスクリーンショット/GIF、DB 変更やマイグレーションは明記。
- 小さく焦点化した変更を好みます。

## セキュリティ / 設定
- 秘密情報はコミットしない。クライアント環境変数: `VITE_API_BASE_URL`, `VITE_SOCKET_PATH`。
- 既定ポート: クライアント 5173、サーバー 5001。ソケットは `/progress-manager/socket.io/`。
- ベースパス変更時はサーバー/クライアントの整合（`/progress-manager/*`）を必ず取る。

## エージェント向け指示
- 回答は簡潔な日本語（2–4文）。大きな作業前に意図を一言共有し、完了後は要点のみ報告。
- 箇条書き/コードブロックは必要時のみ。コマンド・パス・再現手順を優先。
