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

function startGame(): void {
  state = newGame();
  preloadQuestionImages(currentQuestion(state));
  render();
}

function handleAnswer(pickedId: number): void {
  answer(state, pickedId);
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

function render(): void {
  switch (state.phase) {
    case "title":
      renderTitle(root, startGame);
      break;
    case "quiz":
      renderQuiz(root, state, { onAnswer: handleAnswer, onNext: handleNext });
      break;
    case "result":
      renderResult(root, state, startGame);
      break;
  }
}

render();
