import type { GameState, Question } from "./types";
import { TOTAL_Q, TRICK_RATE, correctChoice } from "./types";
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

/** 化けギミックの正体を出現させる(クリック起因・放置タイマー起因の両方から使う) */
export function revealDisguise(state: GameState): boolean {
  const q = currentQuestion(state);
  if (q.pickedId === null && q.disguise && !q.disguise.revealed) {
    q.disguise.revealed = true;
    return true;
  }
  return false;
}

/** 化け問題で、正解が化けたゾロアーク側にある(=実体の正解が隠れている)か */
export function isAnswerHidden(q: Question): boolean {
  if (!q.disguise) return false;
  const ansId = correctChoice(q).poke.id;
  return q.disguise.slots.some((s) => q.choices[s.pos].poke.id === ansId);
}

/** 未出現の化け問題で「見た目上お手本より速そうなカード」が1枚でもあるか */
export function hasVisibleFaster(q: Question): boolean {
  return q.choices.some((c, i) => {
    const slot = q.disguise?.slots.find((s) => s.pos === i);
    const visible = slot && !q.disguise!.revealed ? slot.shown : c;
    return visible.speed > q.target.speed;
  });
}

/**
 * 回答を処理する。
 * - 化けギミック未出現の場合:
 *   - 化けていないカードで1発目に正解を当てたら出現をスキップし、
 *     仮の問題のまま正解確定
 *   - それ以外(不正解、または化けているカードを選んだ)は正誤判定せず
 *     正体を出現させ "revealed" を返す(再回答可能)
 * - それ以外は回答を確定し正誤を返す。お手本より速い唯一の選択肢なら正解。
 *   回答済みの問題には何もしない。
 */
export function answer(
  state: GameState,
  pickedId: number
): boolean | "revealed" | null {
  const q = currentQuestion(state);
  if (q.pickedId !== null) return null;
  const isCorrectPick = pickedId === correctChoice(q).poke.id;
  if (q.disguise && !q.disguise.revealed) {
    const isDisguisedPick = q.disguise.slots.some(
      (s) => q.choices[s.pos].poke.id === pickedId
    );
    if (!isCorrectPick || isDisguisedPick) {
      q.disguise.revealed = true;
      return "revealed";
    }
  }
  q.pickedId = pickedId;
  q.correct = isCorrectPick;
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
