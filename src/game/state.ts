import type { GameState, Question } from "./types";
import { TOTAL_Q, TRICK_RATE, correctIds } from "./types";
import { buildQuestions } from "./question";
import { loadPokeData, loadTricksters } from "../data/loader";

export function newGame(): GameState {
  return {
    questions: buildQuestions(loadPokeData(), TOTAL_Q, Math.random, {
      tricks: loadTricksters(),
      trickRate: TRICK_RATE,
    }),
    index: 0,
    score: 0,
    phase: "quiz",
  };
}

export function currentQuestion(state: GameState): Question {
  return state.questions[state.index];
}

/**
 * 回答(選択した ID の集合)を処理する。
 * - 化けギミック未出現なら正誤判定せず正体を出現させ "revealed" を返す(再回答可能)
 * - それ以外は回答を確定し正誤を返す。お手本より速い選択肢を過不足なく
 *   全て選んでいれば正解。回答済みの問題には何もしない。
 */
export function answer(
  state: GameState,
  pickedIds: number[]
): boolean | "revealed" | null {
  const q = currentQuestion(state);
  if (q.pickedIds !== null) return null;
  if (q.disguise && !q.disguise.revealed) {
    q.disguise.revealed = true;
    return "revealed";
  }
  q.pickedIds = [...pickedIds];
  const expected = correctIds(q);
  q.correct =
    expected.length === pickedIds.length &&
    expected.every((id) => pickedIds.includes(id));
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
