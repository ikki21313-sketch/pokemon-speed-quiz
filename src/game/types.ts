export type PokeTuple = [id: number, jaName: string, speed: number];

export interface Pokemon {
  id: number;
  jaName: string;
  speed: number; // 素早さ種族値
}

/** 努力値の振り方 */
export type Spread = "max" | "semi" | "none";

export const SPREAD_LABEL: Record<Spread, string> = {
  max: "最速",
  semi: "準速",
  none: "無振り",
};

export const SPREADS: Spread[] = ["max", "semi", "none"];

/**
 * 振り方を加味した素早さ実数値。
 * - 無振り: 種族値 + 20
 * - 準速:   種族値 + 20 + 32
 * - 最速:   (種族値 + 20 + 32) × 1.1 の切り捨て
 */
export function computedSpeed(base: number, spread: Spread): number {
  if (spread === "none") return base + 20;
  if (spread === "semi") return base + 52;
  return Math.floor((base + 52) * 1.1);
}

/** 出題に登場する1体分(ポケモン+振り方+計算後実数値) */
export interface Entry {
  poke: Pokemon;
  spread: Spread;
  speed: number; // computedSpeed(poke.speed, spread)
}

/** ゾロアークギミック: 選択肢の1枚が別のポケモンに化けている */
export interface Disguise {
  pos: number;       // 化けている choices のインデックス
  shown: Entry;      // 見た目として表示するポケモン+振り方(化けの皮)
  revealed: boolean; // 正体が出現済みか
}

export interface Question {
  target: Entry;             // お手本
  choices: Entry[];          // 選択肢4体。正体出現後の実体で「お手本より速い」がちょうど1体
  disguise: Disguise | null; // 化けギミック(なければ null)
  pickedId: number | null;   // 回答したポケモンID(未回答は null)
  correct: boolean | null;   // 正誤(未回答は null)
}

/** お手本より速い唯一の正解選択肢を返す */
export function correctChoice(q: Question): Entry {
  return q.choices.find((c) => c.speed > q.target.speed)!;
}

export interface GameState {
  questions: Question[];
  index: number;
  score: number;
  phase: "title" | "quiz" | "result";
}

export const TOTAL_Q = 10;

/** 選択肢の数 */
export const CHOICE_COUNT = 4;

/**
 * 選択肢4枚の振り方構成(固定)。見栄えのため「最速1・準速2・無振り1」とする。
 * スロットへの割り当てはシャッフルし、正解位置は独立に選ぶため
 * ラベルと正誤の無相関(P(正解|ラベル)=25%)は維持される。
 */
export const CHOICE_SPREADS: Spread[] = ["max", "semi", "semi", "none"];

/** 出題範囲: 選択肢の計算後実数値とお手本の計算後実数値の差の上限 */
export const COMPUTED_RANGE = 20;

/**
 * お手本の計算値の許容レンジ (C-7)。
 * どの振り方×速い/遅いの窓にも該当ポケモンが存在することを保証し、
 * 振り方ラベルと正誤の独立性(バイアス対策)を成立させるための制限。
 */
export const TARGET_COMPUTED_MIN = 65;
export const TARGET_COMPUTED_MAX = 175;

/** 化けギミックの発生率 */
export const TRICK_RATE = 0.05;

/** 化けギミック発生時に「ゾロアークが正解」になる割合 */
export const TRICK_ANSWER_RATE = 0.5;

/** 化け問題で放置時に正体が自動出現するまでの時間 (ms) */
export const REVEAL_IDLE_MS = 10_000;

/** ゾロアーク(通常の出題プールから除外する図鑑No) */
export const ZOROARK_ID = 571;

/** 速度バーの上限 (最速 S200 = floor(252×1.1) = 277 を収める) */
export const SPEED_BAR_MAX = 280;
