# 進捗管理Webツール (ProgMan)

Excel形式の進捗管理をWebツール化した、リアルタイム同期対応の進捗管理システム

## 機能

- 複数プロジェクトの管理
- リアルタイム同時編集
- 自動進捗率計算（日数ベース）
- 終了日自動計算
- カレンダー/直接入力両対応の日付入力

## 技術スタック

- **フロントエンド**: React, TypeScript, Tailwind CSS, Zustand, Socket.io-client
- **バックエンド**: Node.js, Express, Socket.io, SQLite
- **ビルドツール**: Vite

## セットアップ

### 必要要件

- Node.js 18以上
- npm または yarn

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/k-koshiro/ProgMan.git
cd ProgMan

# 依存関係のインストール（方法1: 一括インストール）
npm run install:all

# または個別にインストール（方法2）
npm install  # ルートディレクトリ
cd client && npm install
cd ../server && npm install
```

### 開発サーバーの起動

```bash
# フロントエンド・バックエンド同時起動（方法1）
./start.sh
# または
npm run dev

# 個別に起動（方法2）
# ターミナル1: サーバー起動
cd server
npm run dev

# ターミナル2: クライアント起動  
cd client
npm run dev
```

- フロントエンド: http://localhost:5173/progress-manager/
- バックエンド: http://localhost:5001

## 使用方法

### 開発環境（直接アクセス）
1. ブラウザで http://localhost:5173/progress-manager/ にアクセス

### Caddy経由（本番環境）
1. ブラウザで http://com3887/progress-manager/ にアクセス
2. 「新規プロジェクト作成」ボタンでプロジェクトを作成
3. プロジェクトを選択してスケジュール管理画面へ
4. 各セルをクリックして編集
   - 担当者: テキスト入力
   - 開始日: カレンダー選択 or 直接入力（YYYY-MM-DD形式）
   - 日数: 数値入力
5. 進捗率は開始日と日数から自動計算
6. 複数ブラウザ/タブで同時編集可能

## プロジェクト構造

```
ProgMan/
├── client/           # フロントエンドアプリケーション
│   ├── src/
│   │   ├── components/   # UIコンポーネント
│   │   ├── pages/        # ページコンポーネント
│   │   ├── store/        # 状態管理
│   │   └── types/        # TypeScript型定義
├── server/           # バックエンドサーバー
│   ├── src/
│   │   ├── db/          # データベース関連
│   │   ├── routes/      # APIルート
│   │   └── sockets/     # WebSocket処理
└── README.md
```

## データベース

SQLiteを使用（`server/data/progman.db`に保存）

## 今後の拡張予定

- ガントチャート表示
- Excel形式でのインポート/エクスポート
- ユーザー認証・権限管理
- 休日・営業日考慮の日数計算
- プロジェクトテンプレート機能