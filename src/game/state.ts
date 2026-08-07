import type { GameState, Question } from "./types";
import { TOTAL_Q } from "./types";
import { buildQuestions } from "./question";
import { loadPokeData } from "../data/loader";

export function newGame(): GameState {
  return {
    questions: buildQuestions(loadPokeData(), TOTAL_Q),
    index: 0,
    score: 0,
    phase: "quiz",
  };
}

export function currentQuestion(state: GameState): Question {
  return state.questions[state.index];
}

/** 回答を確定し正誤を返す。回答済みの問題には何もしない。 */
export function answer(state: GameState, pickedId: number): boolean | null {
  const q = currentQuestion(state);
  if (q.pickedId !== null) return null;
  q.pickedId = pickedId;
  q.correct = pickedId === q.fast.id;
  if (q.correct) state.score++;
  return q.correct;
}

export function isLastQuestion(state: GameState): boolean {
  return state.index >= state.questions.length - 1;
}

/** 次の問題へ。最終問題なら結果画面へ遷移する。 */
export function advance(state: GameState): void {
  if (isLastQuestion(state)) {
    state.phase = "result";
  } else {
    state.index++;
  }
}
