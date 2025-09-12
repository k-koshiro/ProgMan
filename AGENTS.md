# Repository Guidelines

## Project Structure & Module Organization
- ルート: 共有スクリプトと設定（`package.json`, `start.sh`）。
- `client/`: React + TypeScript（Vite）。主要ディレクトリ: `src/components/`, `src/pages/`, `src/store/`, `src/utils/`, `src/types/`。
- `server/`: Express + Socket.IO + SQLite。主要ディレクトリ: `src/routes/`, `src/db/`, `src/sockets/`, `src/data/`。
- パス: API は `/progress-manager/api/*`、クライアント資産は `/progress-manager/` 配下で提供。
- テスト: ソースと同階層に `*.test.ts` / `*.test.tsx` を配置。

## Build, Test, and Development Commands
- 依存関係一括: `npm run install:all`
- 同時起動: `npm run dev` または `./start.sh`（クライアント+サーバーをウォッチ）
- サーバー: `cd server && npm run dev` / ビルド `npm run build` / 実行 `npm start`
- クライアント: `cd client && npm run dev` / ビルド `npm run build` / プレビュー `npm run preview`
- DB 確認: 初回サーバー起動後 `node test-db.js`

## Coding Style & Naming Conventions
- 言語は TypeScript（client/server 共通）。インデント 2 スペース、シングルクォート、セミコロン必須。
- コンポーネント: PascalCase（例 `ProgressBar.tsx`）。
- フック: `use` 接頭辞（例 `useDebounce.ts`）。
- ユーティリティ: camelCase、型は `src/types/` に PascalCase。
- API ルートは `/api/*`。クライアントのリクエストは `/progress-manager` 接頭辞を維持。

## Testing Guidelines
- 公式ランナーは未導入。`utils/` や `db/` に小さく純粋な関数を優先。
- テストはソース同階層に配置し、命名は `*.test.ts` / `*.test.tsx`。
- ランナーを追加する場合は `package.json` にスクリプトを明記し、実行方法を README/PR に記載。
- 手動確認: クライアント＋サーバー起動 → プロジェクト作成 → スケジュール編集 → ブラウザ 2 タブでリアルタイム更新を確認。

## Commit & Pull Request Guidelines
- コミットは短く命令形。日本語カテゴリ接頭辞を推奨（例 `修正: …`, `機能追加: …`）。
- PR には目的/概要、関連 Issue、確認手順、UI 変更はスクリーンショット/GIF、DB 変更やマイグレーションを明記。
- 小さく焦点化した変更を好みます。

## Security & Configuration Tips
- 秘密情報はコミットしない。クライアント環境変数: `VITE_API_BASE_URL`, `VITE_SOCKET_PATH`。
- 既定ポート: クライアント `5173`、サーバー `5001`。ソケットは `/progress-manager/socket.io/`。
- ベースパス変更時はサーバー/クライアントの整合（`/progress-manager/*`）を必ず取る。

## Agent-Specific Instructions
- 回答は簡潔。大きな作業前に意図共有、完了後は要点のみ報告。
- 明示指示があるまで `git commit` / `git push` は禁止。必要時は対象ファイルとコミットメッセージ案を提示して承認を得る。
- 変更は原則 `apply_patch` で適用。コマンド・パス・再現手順を優先して示す。

### ドキュメント更新ルール（厳守）
- 実装・仕様変更・UI追加などの進捗が発生するたびに、`SPEC.md` を即時更新すること。
- 更新内容には「目的／振る舞い／API・データモデル差分／画面仕様の変更点／既知の注意点」を簡潔に含める。
- 変更を伴うPRやパッチには、`SPEC.md` 更新を含めるか、更新不要の理由を記載する。

### ローカル画像参照（Windows/WSL）
- スクリーンショットは WSL から次のパスで参照可能: `/mnt/c/Users/koshiro/Pictures/Screenshots/`
- 例: `ls -la /mnt/c/Users/koshiro/Pictures/Screenshots` で一覧取得可。
- UI 調整時はこのフォルダの画像を基準にし、変更を SPEC.md に反映すること。

## 実行・権限ポリシー（重要）
- 本エージェント実行環境ではポート待受が制限されるため、サーバー/クライアントの常駐起動は行いません。起動は利用者側で実施、または明示承認を得て指示に従います。
- 起動手順（利用者側）: `npm run install:all` → 同時起動 `npm run dev`。本番相当は `cd server && npm run build && npm start` / `cd client && npm run build && npm run preview`。
- 初回サーバー起動時に `comments` テーブルが作成されます。API は `/progress-manager/api/comments/*`、ソケットイベントは `comments-updated` を使用。
- 逆プロキシ利用時: Vite `server.allowedHosts` に実ホストを追加。Socket.IO はパス `/progress-manager/socket.io/`、CORS はアクセス元ホスト（必要なら `origin: true`）。ベースパス整合（`/progress-manager/*`）を維持。
