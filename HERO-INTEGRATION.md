# Little Stable ヒーロー移植ガイド

この変更は little-stable の事前準備のみです。fm-hp-poc／stable-ops は変更していません。

## コピー対象と依存

コードは次の2ディレクトリを、そのまま同じ相対位置へコピーしてください。

```text
lib/stable/config.ts
lib/stable/world.ts
lib/stable/simulation.ts
lib/stable/environment.ts
lib/stable/viewport.ts
lib/stable/traffic.ts
components/stable/StableHero.tsx
components/stable/StableHero.module.css
components/stable/styles.d.ts
```

`traffic.ts` は既存の馬同士の衝突回避処理、`config.ts` は新設した設定型・検証・座標計算です。
実行時の追加依存は **three 0.185.1**。React／React DOM は移植先のものを使用します。
TypeScript開発時には **@types/three 0.185.4** も必要です。
shadcn、lucide、Vinext、Workers型、`@/*`、独自のtsconfig設定に依存しません。
`npm run typecheck:stable` は React・DOM 型のみで両ディレクトリを検査します。

静止画はコードとは別のリソースです。生成済みの `public/stable-poster.png`（1600×900、約182KB）を移植先のpublicへコピーするか、CDNへ配置して `posterSrc` を指定します。
画像URLを必須propsにしているので、コードの2ディレクトリに移植先のpublicパスを埋め込む必要はありません。
`app/globals.css`、`app/page.tsx`、`app/hero-preview/`、`components/ui/` はコピーしません。

## 最小使用例

```tsx
'use client';
import { StableHero, HERO_OPTIONS } from './components/stable/StableHero';

export function FarmHero() {
  return (
    <div style={{ position: 'relative', aspectRatio: '2.1', background: 'linear-gradient(#304860, #839899)' }}>
      <StableHero posterSrc="/stable-poster.png" options={HERO_OPTIONS}
        ariaLabel="厩舎と牧草地、トラックで暮らす馬たち" />
    </div>
  );
}
```

親は高さ（またはaspect-ratio）を与えてください。見出し・ナビ・スクリムは親が重ねます。
この部品は見出し、クレジット、ブランド名、操作UI、エラーテキストを出しません。
`role="img"` のアクセシブルな名前だけをpropsで指定できます。
失敗・コンテキスト喪失時はポスターへ戻り、最初の描画成功後に3Dへフェードします。
透過3Dが表示された後はポスターも消えるので、親の背景を透かせます。
SSRではポスターがHTMLにあり、Three.jsはeffect内の動的importで読み込みます。

## createWorld のオプション

従来の3引数呼び出しを維持し、第4引数を追加しています。

```ts
export type WorldOptions = {
  fit?: 'contain' | 'cover';
  offset?: { x?: number; y?: number };
  background?: 'environment' | 'transparent' | { color: string };
  interactive?: boolean;
  autoPause?: boolean;
  minDaylight?: number;
  reducedMotion?: 'throttle' | 'static';
  config?: StableConfig;
  initialEnvironment?: Environment;
  onReady?: () => void;
};
```

| オプション | createWorldの既定値 | ヒーロー推奨値 |
|---|---|---|
| fit | contain | cover |
| offset | x:0 / y:0 | x:0 / y:0.06 |
| background | environment | transparent |
| interactive | true | false |
| autoPause | false | true |
| minDaylight | 0 | 0.25 |
| reducedMotion | throttle | static |
| config | 15馬房・10頭 | fromStableOps(APIレスポンス) |
| initialEnvironment | 現在時刻 | 必要ならサーバー計算済み値 |

`HERO_OPTIONS` が上記の推奨値をまとめています。`StableHero` に部分的なoptionsを渡してもヒーロー既定値とマージされます。
offsetは**枠の幅・高さに対する割合**です。正のxは箱庭を右、正のyは下へ動かします。
coverは投影済みの箱庭境界から `min(fitY, fitX/aspect)` で計算し、操作ズーム1〜3とは独立しています。
`interactive:false` ではポインタ／ホイールのリスナを登録せず、ズームAPIはno-opです。
ヒーローの装飾キャンバス層自体もpointer-events:noneで、ページスクロールとブラウザのピンチ拡大を奪いません。
画面外ではrAFの予約を取り消します。復帰時の最初のdtは0で、経過時間をシミュレーションへ加算しません。
reduced-motionの変更にも追従します。staticはアニメーションを止め、サイズ・環境が変わった場合だけ1フレーム更新します。

## 夜の描画

`lit = minDaylight + (1 - minDaylight) * day` を連続的な明るさへ適用しました。
環境光・指向性光の強さ、太陽の高さ、影、空の基本補間にはlitを使います。
青い夜の光色、薄暮の色の判定、馬房灯の点灯、馬の行動時刻には生のday/hourを使います。
夜でも灯りが消えず、時刻を昼に固定することもありません。独自の夜空色は追加していません。

**推奨値は0.25**。22:00 JSTの実レンダリングで、青い屋根・牧草地と暖色の馬房灯が両立し、馬・柵・通路の形が読めることを目視確認しました。
16:9とスマホ縦3:4で確認しています。2.1:1の確認枠も `/hero-preview` にあります。
スマホ縦は左右を切り取ります。枠全体へ拡大するため、全厩舎と全トラックを同時に収めるモードではありません。
白文字のコントラスト調整は移植先のスクリムで行ってください。

## stable-ops API の型と変換

```ts
type Coat = 'bay' | 'dark_bay' | 'brown' | 'black' | 'chestnut'
  | 'dark_chestnut' | 'gray' | 'white' | 'unknown';
type FarmLocation = { latitude: number; longitude: number; timezone: string; label?: string };
type Stall = {
  index: number; row: 'west' | 'east'; order: number;
  label: string; horseRef: string | null;
};
type HorseConfig = {
  ref: string; stallIndex: number; coat: Coat;
  coatLabel?: string; coatHex?: string;
};
type StableConfig = {
  version: 1; generatedAt: string;
  farm: { name: string; location: FarmLocation };
  stalls: { capacity: number; occupied: number; layout: Stall[] };
  horses: HorseConfig[];
};
function fromStableOps(value: unknown): StableConfig;
```

`fromStableOps(json)` はAPIレスポンスを直接検証・コピーし、馬房座標は追加しません。
index/refの一意性、馬と馬房の相互参照、頭数、レイアウト、緯度経度、タイムゾーンを検証します。
不正な設定は例外になり、ヒーローではポスターへフォールバックします。無設定時だけ従来デモへフォールバックします。
未知の毛色コードはunknownへ正規化し、妥当な6桁coatHexがあればそちらを優先します。
過大なJSONからのGPU割当を防ぐため、capacityと列内orderは最大256室相当に制限しています。
indexは連番でなくても構いません。orderの空きも座標として保持します。

最長列から建屋・屋根・通路・入口・土台の長さを計算します。西だけ／東だけ／0馬房にも対応します。
夜型は配列後方約20%で決定的に割り当てます。10頭の既定設定では従来どおり最後の2頭です。
モデルやトラックの形は保ちます。10頭を超える設定では追加馬をまず馬房に置き、牧草地の10か所を順番に共有することで同じ地点への初期配置を避けています。

## 天気の注入

```ts
type EnvironmentOptions = {
  initialWeather?: Weather | null;
  polling?: boolean;
  location?: FarmLocation;
};
watchEnvironment(onChange, options?);
weatherUrl(location?);
environmentAt(now, weather?, failed?, timezone?);
```

サーバーで取得・キャッシュしたOpen-Meteoレスポンスを `parseWeather(json)` でWeatherへ変換し、シリアライズ可能なpropsとして渡せます。

```tsx
const config = fromStableOps(publicApiResponse);
const options = { ...HERO_OPTIONS, config };
const environment = {
  initialWeather: cachedWeather,
  polling: false,
  location: config.farm.location,
};
<StableHero posterSrc="/stable-poster.png" options={options} environment={environment} />
```

options/environmentはモジュール定数やuseMemo等で参照を安定させてください。変更時はシーンを再生成します。
StableHeroの既定値は**ブラウザ天気通信なし**です。初期値を最初のフレームに反映し、時計は引き続き実時刻で更新します。
`initialEnvironment` を明示した場合は、その固定スナップショットを使用し、天気watchを作りません（検証・静止画用）。
デモは従来どおり伊勢崎・Asia/Tokyoの天気をブラウザ取得します。位置を指定すると時計の日付・時刻判定もそのtimezoneになります。
天気データの利用条件に応じたクレジット表示は移植先のページ側で管理してください。

## ポスターの再生成

Chromeと、実行用のPlaywrightが必要です（移植先の実行時依存には不要）。

1. このリポジトリで `npm ci` → `npm run dev`。
2. Playwrightが入ったNode環境から `node scripts/generate-poster.mjs` を実行。
3. Playwrightが別の場所にある場合は `PLAYWRIGHT_MODULE` にその `index.mjs` のfile URLを指定。別ポートなら `STABLE_ORIGIN` を指定。
4. `public/stable-poster.png` が14:00 JST・1600×900で再生成されます。

これは実際の3D描画を静止画として書き出す手順です。AIによる別デザインの生成や、UIを含む画面画像ではありません。
画像と3Dの時刻が違う場合、読込後に実時刻のライティングへ切り替わります。

## 検証と既定デモへの影響

- 元の回帰テスト12件を保持し、設定・毛色・0頭・可変馬房・天気注入・SSR評価の7件を追加（計19件）。
- `npm run typecheck` / `npm run typecheck:stable` / `npm run lint` / `npm test` / `npm run build`。
- `node scripts/verify-hero.mjs`：実WebGLで非対話リスナ0件、alpha、画面外・非表示・コンテキスト停止復帰、破棄、0頭・21馬房、静止モード、外部通信なし、無言ポスター失敗パスを検証。
- 既存デモの一時停止・再生表示・速度変更・全体表示・頭数表示も検証。

既定の15馬房・10頭・毛色・形状・操作・天気・昼夜の判定を維持しました。
共通の改善としてタブ非表示でもrAF自体を止め、初回・復帰直後のdtを0にしています。
デモ用globals.cssは移植しない構成で、その見た目を保っています。
既存の未使用shadcnカタログにあったlintエラーは、対象ファイルと既存違反ルールだけのoverrideで区別しました。新しいヒーローの規則は緩和していません（複合画像のroleと移植用native imgには理由付きの局所除外があります）。
コアの拡張子なし相対importを標準のNext.jsでも型検査できるよう、Node回帰テストにだけ小さなresolveローダーを追加しています。
