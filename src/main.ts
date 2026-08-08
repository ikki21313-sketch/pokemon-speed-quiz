import "./styles/main.css";
import type { GameState } from "./game/types";
import { newGame, answer, advance, isLastQuestion, currentQuestion } from "./game/state";
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

/** 現在の問題で選択中の選択肢 ID(確定前) */
let selection = new Set<number>();

function startGame(): void {
  state = newGame();
  selection = new Set();
  preloadQuestionImages(currentQuestion(state));
  render();
}

function handleToggle(id: number): void {
  if (selection.has(id)) {
    selection.delete(id);
  } else {
    selection.add(id);
  }
  render();
}

function handleConfirm(): void {
  if (selection.size === 0) return;
  const result = answer(state, [...selection]);
  if (result === "revealed") {
    // ゾロアークが出現。回答は確定させず、選び直しのためリセットして再描画
    selection = new Set();
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
  selection = new Set();
  render();
  window.scrollTo({ top: 0 });
}

function render(justRevealed = false): void {
  switch (state.phase) {
    case "title":
      renderTitle(root, startGame);
      break;
    case "quiz":
      renderQuiz(
        root,
        state,
        { onToggle: handleToggle, onConfirm: handleConfirm, onNext: handleNext },
        selection,
        justRevealed
      );
      break;
    case "result":
      renderResult(root, state, startGame);
      break;
  }
}

render();
