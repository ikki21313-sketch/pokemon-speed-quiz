export type PokeTuple = [id: number, jaName: string, speed: number];

export interface Pokemon {
  id: number;
  jaName: string;
  speed: number;
}

export interface Question {
  target: Pokemon;             // お手本(素早さは3匹の中間値)
  fast: Pokemon;               // 正解(target より速い)
  slow: Pokemon;               // 不正解(target より遅い)
  choices: [Pokemon, Pokemon]; // fast と slow をシャッフルした表示順
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
