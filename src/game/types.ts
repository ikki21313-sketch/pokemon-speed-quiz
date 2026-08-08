export type PokeTuple = [id: number, jaName: string, speed: number];

export interface Pokemon {
  id: number;
  jaName: string;
  speed: number;
}

/** ゾロアークギミック: 選択肢の1枚が別のポケモンに化けている */
export interface Disguise {
  pos: 0 | 1;        // 化けている choices のインデックス
  shown: Pokemon;    // 見た目として表示するポケモン(化けの皮)
  revealed: boolean; // 正体が出現済みか
}

export interface Question {
  target: Pokemon;             // お手本(素早さは3匹の中間値)
  fast: Pokemon;               // 正解(target より速い)
  slow: Pokemon;               // 不正解(target より遅い)
  choices: [Pokemon, Pokemon]; // fast と slow をシャッフルした表示順
  disguise: Disguise | null;   // 化けギミック(なければ null)
  pickedId: number | null;     // 回答したポケモンID(未回答は null)
  correct: boolean | null;     // 正誤(未回答は null)
}

export interface GameState {
  questions: Question[];
  index: number;
  score: number;
  phase: "title" | "quiz" | "result";
}

export const TOTAL_Q = 10;

/** 化けギミックの発生率 */
export const TRICK_RATE = 0.05;
