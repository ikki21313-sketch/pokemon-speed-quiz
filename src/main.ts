import "./styles/main.css";
import type { GameState } from "./game/types";
import { REVEAL_IDLE_MS } from "./game/types";
import {
  newGame,
  answer,
  advance,
  isLastQuestion,
  currentQuestion,
  revealDisguise,
} from "./game/state";
import { preloadQuestionImages } from "./ui/images";
import { renderTitle } from "./ui/screens/title";
import { renderQuiz } from "./ui/screens/quiz";
import { renderResult } from "./ui/screens/result";

const root = document.getElementById("app")!;

let state: GameState = {
  questions: [],
  index: 0,
  score: 0,
  phase: "title",
};

/** 化け問題の放置タイマー */
let revealTimer: ReturnType<typeof setTimeout> | null = null;

function clearRevealTimer(): void {
  if (revealTimer !== null) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
}

/** 化け問題を放置したら正体を自動出現させる */
function armRevealTimer(): void {
  clearRevealTimer();
  if (state.phase !== "quiz") return;
  const q = currentQuestion(state);
  if (q.pickedId !== null || !q.disguise || q.disguise.revealed) return;
  revealTimer = setTimeout(() => {
    revealTimer = null;
    if (revealDisguise(state)) render(true);
  }, REVEAL_IDLE_MS);
}

function startGame(): void {
  state = newGame();
  preloadQuestionImages(currentQuestion(state));
  render();
}

function handleAnswer(pickedId: number): void {
  const result = answer(state, pickedId);
  if (result === "revealed") {
    // ゾロアークが出現。回答は確定させず再回答を待つ
    render(true);
    return;
  }
  // 次問の画像を先読み
  if (!isLastQuestion(state)) {
    preloadQuestionImages(state.questions[state.index + 1]);
  }
  render();
}

function handleNext(): void {
  advance(state);
  render();
  window.scrollTo({ top: 0 });
}

function render(justRevealed = false): void {
  clearRevealTimer();
  switch (state.phase) {
    case "title":
      renderTitle(root, startGame);
      break;
    case "quiz":
      renderQuiz(
        root,
        state,
        { onAnswer: handleAnswer, onNext: handleNext },
        justRevealed
      );
      armRevealTimer();
      break;
    case "result":
      renderResult(root, state, startGame);
      break;
  }
}

render();
