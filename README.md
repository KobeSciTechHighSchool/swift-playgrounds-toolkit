# Swift Playground マップ検証ツール

Swift Playgrounds の「コードを学ぼう」に登場するマップと模範解答の整合性をブラウザ上で検証できるスタンドアロン Web アプリです。タブ区切りマップと Swift 風コマンド列を貼り付けるだけで、ジェムの取得状況やスイッチの開閉、通行不可マスとの衝突などを自動チェックします。

## 主な機能

- 🧭 **マップ入力支援**: タブ区切りマップの行・列数を自動カウントし、プレビューをリアルタイム描画。
- 🧪 **模範解答シミュレーション**: `moveForward()`, `turnRight()` 等の命令や `for n times { ... }` ループを解釈し、移動ルートを再現。
- 🧝 **ステータスダッシュボード**: 総ステップ数、ジェム/スイッチ達成率、エラーカウントを視覚的に表示。
- � **エラーログ & レポート出力**: 問題箇所をローマ数字付きで列挙し、詳細ログを JSON 形式でダウンロード可能。
- 🎨 **プロフェッショナル UI**: ダーク/ライト対応のガラスモーフィズムデザインと操作性の高いインターフェイス。

## セットアップ

> ⚠️ Node.js 18+ が必要です。PowerShell で `npm` コマンドが利用できる状態にしてください。

```powershell
cd "C:\Users\ken-ishihara@kobe-c.ed.jp\PortableApps\Swift Playground"
npm install
npm run start
```

`npm run start` でローカルサーバー (lite-server) が起動します。

## 使い方

1. ブラウザで `http://localhost:3000` (lite-server のデフォルト) を開きます。
2. 左ペインの「マップ入力」にタブ区切りでマップを貼り付けます。
3. 右ペインの「模範解答」に Swift 風コマンドを入力します。
4. 「検証を実行」を押すと、ステータス・メトリクス・ログ・マッププレビューが更新されます。
5. 結果レポートを保存したい場合は「レポートを保存」ボタンを押してください。

### サンプル入力

#### マップ

```
止	止	止	→			♦
止	止	止	止	止	止	W1
止	止	止	止	止	W1	止
	止	止	止	止		止
♦			W2	止		止
止	止	止	止	W2	♦	止
```

#### 模範解答

```
moveForward()
moveForward()
moveForward()
collectGem()
turnRight()
moveForward()
moveForward()
moveForward()
moveForward()
collectGem()
turnRight()
moveForward()
moveForward()
moveForward()
moveForward()
collectGem()
```

## 開発メモ

- `scripts/app.js`: マップ/命令のパーサ、シミュレーター、UI ロジック
- `styles/main.css`: ガラスモーフィズム調のテーマとレスポンシブデザイン
- `index.html`: 各 UI セクションの骨組み

今後は、スイッチの初期状態判定や詳細ログのエクスポート形式拡充などを検討しています。
