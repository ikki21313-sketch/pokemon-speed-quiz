import type { GameState } from "../../game/types";
import { currentQuestion, isLastQuestion } from "../../game/state";
import {
  esc,
  progressDotsHtml,
  speedBarHtml,
  animateSpeedBars,
  hydrateImages,
  pokeImgHtml,
} from "../components";

export interface QuizHandlers {
  onAnswer: (pickedId: number) => void;
  onNext: () => void;
}

export function renderQuiz(
  root: HTMLElement,
  state: GameState,
  handlers: QuizHandlers,
  justRevealed = false
): void {
  const q = currentQuestion(state);
  const answered = q.pickedId !== null;
  const disguise = q.disguise;

  const targetSpeed = answered
    ? `<div class="speed-value">すばやさ <strong>${q.target.speed}</strong></div>${speedBarHtml(q.target.speed)}`
    : `<div class="speed-value">すばやさ <strong>???</strong></div>`;

  const choicesHtml = q.choices
    .map((p, idx) => {
      // 化けギミック: 正体出現前は「化けの皮」のポケモンを表示する
      const isDisguisedSlot = disguise !== null && disguise.pos === idx;
      const display = isDisguisedSlot && !disguise.revealed ? disguise.shown : p;
      const isCorrectCard = p.id === q.fast.id;
      const isPicked = p.id === q.pickedId;
      const cls = ["card", "choice-card"];
      if (answered && isCorrectCard) cls.push("choice-correct");
      if (isDisguisedSlot && disguise.revealed && justRevealed) cls.push("glitch");
      const badge = !answered
        ? ""
        : isPicked
          ? `<span class="badge ${q.correct ? "badge-correct" : "badge-wrong"}">${q.correct ? "せいかい！" : "ざんねん…"}</span>`
          : "";
      const speed = answered
        ? `<div class="speed-value">すばやさ <strong>${p.speed}</strong></div>${speedBarHtml(p.speed)}`
        : `<div class="speed-value">すばやさ <strong>???</strong></div>`;
      return `
        <button class="${cls.join(" ")}" data-pick="${p.id}" ${answered ? "disabled" : ""}>
          ${badge}
          ${pokeImgHtml(display, "poke-img")}
          <div class="poke-name">${esc(display.jaName)}</div>
          ${speed}
        </button>
      `;
    })
    .join("");

  const revealBanner =
    disguise?.revealed && !answered
      ? `<p class="reveal-banner" role="alert">！？ ${esc(disguise.shown.jaName)}は ${esc(q.choices[disguise.pos].jaName)}が ばけたすがた だった！<br>もういちど えらぼう！</p>`
      : "";

  root.innerHTML = `
    <div class="screen screen-quiz">
      <header class="quiz-header">
        <div class="q-number">もんだい ${state.index + 1}<span class="q-total">/${state.questions.length}</span></div>
        <div class="dots">${progressDotsHtml(state)}</div>
      </header>
      <div class="card target-card">
        <div class="target-label">お手本</div>
        ${pokeImgHtml(q.target, "poke-img")}
        <div class="poke-name">${esc(q.target.jaName)} <span class="poke-no">No.${q.target.id}</span></div>
        ${targetSpeed}
      </div>
      <p class="question-text">${esc(q.target.jaName)}より すばやいのは どっち？</p>
      ${revealBanner}
      <div class="choices">${choicesHtml}</div>
      <footer class="quiz-footer">
        ${answered ? `<button class="btn btn-primary" id="next-btn">${isLastQuestion(state) ? "けっかを見る" : "つぎの問題へ"}</button>` : ""}
      </footer>
    </div>
  `;

  hydrateImages(root);
  if (answered) animateSpeedBars(root);

  if (!answered) {
    for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-pick]")) {
      btn.addEventListener("click", () =>
        handlers.onAnswer(Number(btn.dataset.pick))
      );
    }
  } else {
    root
      .querySelector<HTMLButtonElement>("#next-btn")!
      .addEventListener("click", handlers.onNext);
  }
}
