# Little Stable — 小さな厩舎

Three.jsで作成した、10頭の馬が自由に暮らすローポリゴンの3D箱庭デモです。

## デモの内容

- 固定の正投影クォータービュー。カメラの移動・回転操作はありません。
- 赤い屋根の厩舎、牧草地、楕円の競馬場、木々、干し草と水飲み場。
- ブロックで構成された毛色の異なる10頭の馬。
- 休憩・採食・走行・移動を自律的に切り替え、入口を通って各エリアを行き来します。
- 一時停止 / 再生、1倍 / 2倍速、現在の行動別頭数表示。
- 縦・横画面に合わせて箱庭全体を収めるレスポンシブ表示。

## ローカル実行

Node.js 22.18以降（推奨24以降）を使用します。

```sh
npm ci
npm run dev
```

表示されたローカルURLをブラウザで開きます。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`dist/client/` が静的配信用の成果物です。プレビューは `http://localhost:4173` で開きます。
静的ホスティングのルートに配置できます。サブディレクトリ配信の場合はアセットのベースパスの設定が別途必要です。

## iPhone向けの設計

- WebGL 2対応のSafariを対象としています。
- 馬のパーツ・静的な建物や柵・木々をInstancedMeshにまとめ、描画呼び出しを削減。
- DPR上限1.5、最大30fps（動きを減らす設定では24fps）。
- リアルタイムのシャドウマップやポストプロセスは使用せず、簡易接地影を使用。
- タブ非表示中は描画とシミュレーションの更新を停止。
- 外部3Dモデル、画像テクスチャ、外部フォントのダウンロードは不要。
- WebGLコンテキスト消失・復帰を処理し、画面離脱時にGPUリソースを解放。

**iPhone実機・ブラウザ画面上での描画検証は未実施です。** 実機のSafariで表示、回転、一時停止、速度変更、バックグラウンド復帰を確認してください。fpsは上限値であり実測の保証値ではありません。

## 構成

| ファイル | 役割 |
| --- | --- |
| `app/page.tsx` | 日本語UI、Reactの初期化・破棄 |
| `lib/world.ts` | Three.jsシーン、モデル、描画、リソース管理 |
| `lib/simulation.ts` | シード付き乱数、馬の状態遷移と経路 |
| `tests/simulation.test.mjs` | 長時間の移動範囲、全行動への遷移、入口利用、再現性 |

描画とシミュレーションを分離しています。移動はウェイポイント方式で、馬同士の物理衝突や競走順位の計算は実装していません。厩舎は馬が見えるように屋根を一部省略したカットアウェイ表現です。

## 技術

Three.js / TypeScript / React / Vinext / Vite / Tailwind CSS / shadcn Button。
`.openai/hosting.json` は非公開Sitesプレビューのプロジェクト設定です。GitHubの公開設定とは独立しています。

Three.jsの仕様は [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) と [レスポンシブ描画](https://threejs.org/manual/en/responsive.html) を参照。
