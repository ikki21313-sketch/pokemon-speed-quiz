export type PokeTuple = [id: number, jaName: string, speed: number];

export interface Pokemon {
  id: number;
  jaName: string;
  speed: number;
}

/** ゾロアークギミック: 選択肢の1枚が別のポケモンに化けている */
export interface Disguise {
  pos: number;       // 化けている choices のインデックス
  shown: Pokemon;    // 見た目として表示するポケモン(化けの皮)
  revealed: boolean; // 正体が出現済みか
}

export interface Question {
  target: Pokemon;             // お手本
  choices: Pokemon[];          // 選択肢4匹。うち 1〜3 匹が target より速い(=正解)
  disguise: Disguise | null;   // 化けギミック(なければ null)
  pickedIds: number[] | null;  // 確定した選択(未回答は null)
  correct: boolean | null;     // 正誤(未回答は null)
}

/** target より速い選択肢(=選ぶべき正解)の ID 一覧 */
export function correctIds(q: Question): number[] {
  return q.choices
    .filter((c) => c.speed > q.target.speed)
    .map((c) => c.id);
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

/** 素早さの出題範囲: お手本との差の上限 */
export const SPEED_RANGE = 10;

/** 化けギミックの発生率 */
export const TRICK_RATE = 0.05;
