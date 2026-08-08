# ポケモン すばやさクイズ — 設計書

Claude Code でローカル実装するための設計書。本書をリポジトリ直下に置き、Claude Code に「DESIGN.md に従って実装して」と指示することを想定する。

---

## 1. プロジェクト概要

PokeAPI のデータを用いた、ポケモンの素早さ（S）種族値を比較するブラウザゲーム。お手本ポケモン1匹に対し、2匹の選択肢から「お手本より素早さが高い」ほうを当てる。10問連続で正解数を競い、終了後に履歴を確認できる。

- 対象: 個人利用・非商用のファンプロジェクト
- 動作環境: モダンブラウザ（PC / スマホ）
- サーバー: 不要（静的サイト。ローカルでは Vite dev server で開発）

---

## 2. ライセンス・利用規約要件（必須要件）

本プロジェクトは以下を **機能要件と同格の必須要件** として扱う。実装・構成はすべてこの制約下で行うこと。

### 2.1 PokeAPI フェアユースポリシーへの準拠

PokeAPI の公式ポリシーは「取得したリソースは必ずローカルにキャッシュすること」を求めている。よって:

- **R-1**: 実行時（ゲームプレイ中）に PokeAPI へリクエストを送らない設計とする。データはビルド前に一括取得し、静的ファイルとしてリポジトリに同梱する。
- **R-2**: データ取得スクリプト（`scripts/sync-data.mjs`）は PokeAPI 本体ではなく、PokeAPI が GitHub で公開している CSV データ（`raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/`）から取得する。API サーバーへの負荷をゼロにするため。
- **R-3**: データ取得スクリプトの実行は開発者が手動で行うものとし（`npm run sync-data`）、CI などで高頻度に自動実行しない。

### 2.2 クレジット・ライセンス表記（BSD-3-Clause）

PokeAPI のデータは BSD-3-Clause で提供される。再配布条件を満たすため:

- **R-4**: リポジトリに `THIRD_PARTY_NOTICES.md` を作成し、以下を記載する。
  - PokeAPI の著作権表示（Copyright (c) 2013–現在 Paul Hallett and PokéAPI contributors）
  - BSD-3-Clause ライセンス全文
  - 「Pokémon および ポケモンのキャラクター名は任天堂の商標である」旨
- **R-5**: ゲーム画面のフッターまたはタイトル画面に「データ出典: PokéAPI (pokeapi.co)」のクレジットを表示する。

### 2.3 任天堂側の知的財産への配慮

ポケモンの名称・画像等の権利は任天堂・クリーチャーズ・ゲームフリーク（株式会社ポケモン）に帰属する。PokeAPI は非公式プロジェクトであり、権利許諾を代行するものではない。よって:

- **R-6**: 本プロジェクトは **非商用** とする。広告・課金・販売を行わない。README に非商用のファンプロジェクトである旨と免責を明記する。
- **R-7**: 公式と誤認させる表現（公式ロゴの使用、「公式」を名乗る等）をしない。
- **R-8**: **画像はリポジトリに同梱しない**。立ち絵は実行時に PokeAPI の sprites リポジトリ（`raw.githubusercontent.com/PokeAPI/sprites/...`）から参照する。画像は名称・数値データよりも著作物性が高く、自リポジトリでの再配布を避けるため（画像取得はブラウザによる参照であり 2.1 のキャッシュ要件の対象外。ブラウザの HTTP キャッシュに委ねる）。
- **R-9**: 権利者から削除・変更の要請があった場合は速やかに応じる方針を README に記載する。

### 2.4 README 記載事項チェックリスト

- [ ] 非公式・非商用のファンプロジェクトである旨
- [ ] データ出典（PokéAPI）とリンク
- [ ] 商標・著作権の帰属表示
- [ ] `THIRD_PARTY_NOTICES.md` への参照
- [ ] 削除要請への対応方針

---

## 3. 技術スタック

| 項目 | 選定 | 理由 |
|---|---|---|
| 言語 | TypeScript | 型でデータ構造と問題生成ロジックを保証 |
| ビルド | Vite | 設定が薄く、静的出力が簡単 |
| UI | Vanilla TS + CSS（フレームワークなし） | 画面3枚の小規模アプリのため。React 等は過剰 |
| テスト | Vitest | 問題生成ロジックの検証に使用 |
| データ取得 | Node スクリプト（`scripts/sync-data.mjs`） | ビルド前に1回だけ実行 |
| フォント | Google Fonts（DotGothic16 / Zen Maru Gothic） | レトロゲーム風の見た目。オフライン要件はない |

---

## 4. ディレクトリ構成

```
pokemon-speed-quiz/
├── DESIGN.md                  # 本書
├── README.md                  # R-6, R-9, 2.4 参照
├── THIRD_PARTY_NOTICES.md     # R-4
├── package.json
├── vite.config.ts
├── index.html
├── scripts/
│   └── sync-data.mjs          # CSV取得 → src/data/pokedata.json 生成
├── src/
│   ├── main.ts                # エントリ。画面遷移の制御
│   ├── data/
│   │   ├── pokedata.json      # 生成物: [[id, 日本語名, 素早さ], ...] 全1025件
│   │   └── loader.ts          # JSON読込と型付け
│   ├── game/
│   │   ├── types.ts           # 型定義
│   │   ├── question.ts        # 問題生成ロジック（純粋関数）
│   │   └── state.ts           # ゲーム進行状態の管理
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── title.ts       # タイトル画面
│   │   │   ├── quiz.ts        # 出題・回答画面
│   │   │   └── result.ts      # 結果・履歴画面
│   │   ├── components.ts      # 共通部品（進捗ドット、速度バー等）
│   │   └── images.ts          # 画像URL生成とフォールバック
│   └── styles/
│       └── main.css
└── tests/
    └── question.test.ts       # 問題生成の制約テスト
```

---

## 5. データ設計

### 5.1 データソース（sync-data.mjs の入力）

| ファイル | 用途 | 抽出条件 |
|---|---|---|
| `pokemon_stats.csv` | 素早さ種族値 | `stat_id = 6`（speed）、`pokemon_id` 1〜1025 |
| `pokemon_species_names.csv` | 日本語名 | `local_language_id = 11`（ja）、なければ `1`（ja-Hrkt） |

図鑑 No.1〜1025 の範囲では `pokemon_id` と `pokemon_species_id` は一致する。

### 5.2 生成物: `src/data/pokedata.json`

サイズ最小化のためタプル配列とする（実測 約27KB）。

```jsonc
// [図鑑No, 日本語名, 素早さ種族値]
[[1,"フシギダネ",45],[25,"ピカチュウ",90], ...]
```

### 5.3 型定義（`src/game/types.ts`）

```ts
export type PokeTuple = [id: number, jaName: string, speed: number];

export interface Pokemon {
  id: number;
  jaName: string;
  speed: number;
}

export interface Question {
  target: Pokemon;            // お手本
  choices: Pokemon[];         // 選択肢4匹。うち 1〜3 匹が target より速い（=正解）
  disguise: Disguise | null;  // 化けギミック（§11）
  pickedIds: number[] | null; // 確定した選択（未回答は null）
  correct: boolean | null;    // 正誤（未回答は null）
}

export interface GameState {
  questions: Question[];      // 長さ TOTAL_Q
  index: number;              // 現在の問題番号（0-based）
  score: number;
  phase: "title" | "quiz" | "result";
}
```

### 5.4 画像URL（`src/ui/images.ts`）

R-8 に基づき実行時参照。フォールバックを3段階で行う。

1. 公式アートワーク: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png`
2. 通常スプライト: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`
3. プレースホルダ: インライン SVG のモンスターボール（データURI）

`onerror` ハンドラで段階的に切替える。回答確定時に次問の3枚を `new Image()` で先読みする。

---

## 6. 問題生成ロジック（`src/game/question.ts`）

### 6.1 仕様（4択・複数選択）

- お手本1匹+選択肢4匹を選出する。ただし以下をすべて満たすこと。
  - **C-1**: 5匹の ID がすべて異なる
  - **C-2**: 5匹の素早さがすべて異なる（同速による引き分けを排除）
  - **C-3**: 1ゲーム10問の中で同じポケモンを再登場させない（試行回数上限到達時のみ緩和可）
  - **C-4**: 選択肢の素早さはお手本との差が **±10 以内**（`SPEED_RANGE`）
  - **C-5**: お手本より速い選択肢（=正解）は **1〜3匹**
- プレイヤーは速いと思う選択肢を複数選択し「けってい」で確定する。**正解の選択肢を過不足なく全て選んでいれば正解**。
- 純粋関数として実装し、乱数は注入可能にする（テスト容易性のため `rng: () => number` を引数に取る）。

```ts
export function buildQuestions(
  data: PokeTuple[],
  count: number,
  rng: () => number = Math.random,
  options?: { tricks?: Pokemon[]; trickRate?: number }
): Question[];
```

### 6.2 アルゴリズム

1. 使用済み ID 集合 `used` を用意
2. 各問について最大500回試行（300回超過後は `used` 制約のみ緩和）:
   - お手本候補をランダムに1匹引く
   - C-1〜C-4 を満たす候補プールから、同速を避けつつ4匹選出
   - 正解数が 1〜3（C-5）なら採用
3. 採用した5匹を `used` に追加して Question を構築（§11 のギミック注入もここで行う）

---

## 7. 画面仕様

### 7.1 画面遷移

```
[タイトル] --スタート--> [出題(1〜10問)] --10問終了--> [結果・履歴] --もう一度--> [出題]
```

### 7.2 タイトル画面（`title.ts`）

- ゲームタイトル、ルール説明（4行程度）、スタートボタン
- フッターにクレジット表記（R-5）: 「データ出典: PokéAPI (pokeapi.co) / 非公式ファンプロジェクト」

### 7.3 出題画面（`quiz.ts`）

| 要素 | 未回答時 | 回答後 |
|---|---|---|
| ヘッダー | 問題番号（n/10）と10個の進捗ドット（正解=緑、不正解=赤、現在=強調） | 同左（結果反映） |
| お手本カード | 立ち絵・名前・図鑑No、素早さは `???` 表示 | 素早さ実数値と速度バーを表示 |
| 設問文 | 「〇〇より すばやいのを ぜんぶ えらぼう！（こたえは 1〜3匹）」 | 同左 + 「せいかい！/ざんねん…」バナー |
| 選択肢カード×4 | 立ち絵・名前、素早さは `???`。クリックで選択トグル（黄枠+チェック表示、`aria-pressed`） | 全員の素早さと速度バー表示。正解カードを緑枠、誤って選んだカードを赤枠で強調。ボタンは無効化 |
| フッター | 「けってい」ボタン（1匹以上選択で有効） | 「つぎの問題へ」（10問目は「けっかを見る」）ボタン |

- 速度バー: 素早さ200を上限とした割合で横バーを描画。回答時に 0% → 実値へ CSS transition でアニメーション（`prefers-reduced-motion` 時は無効）
- 回答確定処理: 「けってい」で `pickedIds` 記録 → 正誤判定（正解集合との過不足なし一致） → スコア加算 → 次問画像の先読み → 再描画

### 7.4 結果・履歴画面（`result.ts`）

- スコア（n/10）を大きく表示し、点数帯別のコメントを1行添える
- 10問ぶんの履歴リスト。各行に以下を表示:
  - 正誤マーク（○/×）と設問文
  - 5匹のチップ（小画像・名前・素早さ実数値）。お手本=青枠+「お手本」タグ、正解=緑枠、誤答選択=赤枠、選択したポケモンに「選択」タグ
- 「もういちど あそぶ」ボタン → 問題を再生成して出題画面へ

### 7.5 デザイントークン

| トークン | 値 | 用途 |
|---|---|---|
| `--blue` | `#1c4fb8` | 背景 |
| `--ink` | `#1c2b4a` | 文字・枠線 |
| `--cream` | `#fdf6e3` | カード面 |
| `--yellow` | `#ffcb05` | 主ボタン・速度バー |
| `--green` / `--red` | `#2fae63` / `#e85454` | 正解 / 不正解 |

見た目の方針: 白カード＋3px の太枠＋ハードシャドウのレトロゲーム風。表示フォントは DotGothic16（数値・英字見出し）、本文は Zen Maru Gothic。モバイル（幅420px以下）で画像サイズを縮小するレスポンシブ対応。キーボード操作（Tab + Enter）とフォーカスリングを保証する。

---

## 8. データ取得スクリプト仕様（`scripts/sync-data.mjs`）

1. `pokemon_stats.csv` と `pokemon_species_names.csv` を `raw.githubusercontent.com` から取得（R-2）
2. 5.1 の条件で抽出・結合し、1025件揃っているか検証（欠損があればエラー終了）
3. `src/data/pokedata.json` に書き出し、件数とファイルサイズをログ出力
4. `package.json` に `"sync-data": "node scripts/sync-data.mjs"` を定義（R-3: 手動実行のみ）

生成済み JSON はリポジトリにコミットする（clone 直後にスクリプト実行なしで動くこと）。

---

## 9. テスト要件（`tests/question.test.ts`）

固定シードの乱数を注入し、以下を検証する。

| # | 検証内容 |
|---|---|
| T-1 | `buildQuestions` が指定問数を返す |
| T-2 | 選択肢は4匹で、素早さがお手本 ±10 以内かつ同速なし（C-2/C-4） |
| T-3 | 各問で ID・素早さが相異なり、正解数が 1〜3（C-1/C-5） |
| T-5 | 1ゲーム内でポケモンが重複しない（通常ケース、C-3） |
| T-6 | 1000ゲーム生成しても例外・制約違反が発生しない |
| T-7 | データ件数が1025件で、素早さが 1〜300 の整数である |
| Z-1〜Z-5 | ゾロアークギミックの発生率・不変条件（§11） |

---

## 10. 実装タスク分割（Claude Code への指示順）

1. **足場**: Vite + TypeScript + Vitest のプロジェクト初期化、ディレクトリ作成
2. **データ**: `scripts/sync-data.mjs` 実装 → 実行して `pokedata.json` 生成 → `loader.ts` と `types.ts`
3. **ロジック**: `question.ts` 実装 → `question.test.ts` を書き全テスト通過
4. **UI**: `main.ts` の画面遷移 → `title.ts` → `quiz.ts` → `result.ts` → CSS
5. **画像**: `images.ts`（フォールバック・先読み）
6. **コンプライアンス**: `README.md` / `THIRD_PARTY_NOTICES.md` 作成、フッタークレジット確認（2.4 チェックリスト消化）
7. **仕上げ**: モバイル表示・キーボード操作・reduced-motion の確認、`npm run build` で静的出力確認

## 11. ゾロアークギミック(追加設計)

### 11.1 仕様

- **G-1**: 各問について 5%(`TRICK_RATE = 0.05`)の確率で、4択のうちどれか1枚が「化けている」状態になる。正体はゾロアークまたはヒスイゾロアークからランダムに選ぶ。
- **G-2**: 化けている選択肢は、見た目(立ち絵・名前)は元のポケモン(化けの皮)のまま表示するが、実体(素早さ・正誤判定)は正体のものを使う。
- **G-3**: 化けている問題で回答を行うと、正誤を問わずその回答は確定させず、化けている選択肢にノイズ演出が走って正体が出現する。
- **G-4**: 正体出現後、その問題は再び回答可能になる。2回目の回答で正誤を確定する。
- **G-5**: 整合性維持のため、正体は化けの皮と同じ側(お手本より速い/遅い)の選択肢にのみ化ける。これにより正解数(1〜3)は出現後も変わらない。正体の素早さは C-4(±10 範囲)の対象外とする(サプライズ要素のため)。
- **G-6**: 正体と5匹の間で ID 重複または同速(C-1/C-2 違反)が生じる場合、その問ではギミックを発生させない。
- **G-7**: 結果画面の履歴では正体を表示し、「ばけていた！」タグを付ける。

### 11.2 データ

`scripts/sync-data.mjs` が `pokemon.csv` から `zoroark` / `zoroark-hisui` の pokemon_id を引き、`pokemon_stats.csv` の素早さと合わせて `src/data/zoroark.json` を生成する(実測: ゾロアーク #571 S105、ヒスイゾロアーク pokemon_id 10239 S110)。フォルム違いのスプライトは 10000 番台の pokemon_id で参照できる。

### 11.3 実装

- `types.ts`: `Disguise { pos, shown, revealed }` を `Question.disguise` に追加
- `question.ts`: `buildQuestions(..., { tricks, trickRate })` でギミック注入(純粋関数のまま)
- `state.ts`: `answer()` は未出現の disguise があれば正誤判定せず `"revealed"` を返す(選択はリセットされ再選択可能)
- `quiz.ts`: 出現前は化けの皮を表示、出現時に `.glitch` アニメーション+再回答バナー
- テスト Z-1〜Z-5 で発生率 0/1 の挙動と G-5/G-6 の不変条件を検証

## 12. 非機能要件

- 初回表示: データ同梱のためネットワーク不要で即時（画像のみ遅延読込）
- 実行時の PokeAPI 本体へのリクエスト数: **0**（R-1 の受入基準）
- 依存パッケージ: 実行時依存ゼロ（devDependencies のみ）
- 対応ブラウザ: 直近2バージョンの Chrome / Edge / Firefox / Safari
