import type { GameState } from "../../game/types";
import { correctIds } from "../../game/types";
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
  onToggle: (id: number) => void;
  onConfirm: () => void;
  onNext: () => void;
}

export function renderQuiz(
  root: HTMLElement,
  state: GameState,
  handlers: QuizHandlers,
  selection: ReadonlySet<number>,
  justRevealed = false
): void {
  const q = currentQuestion(state);
  const answered = q.pickedIds !== null;
  const disguise = q.disguise;
  const expected = correctIds(q);

  const targetSpeed = answered
    ? `<div class="speed-value">すばやさ <strong>${q.target.speed}</strong></div>${speedBarHtml(q.target.speed)}`
    : `<div class="speed-value">すばやさ <strong>???</strong></div>`;

  const choicesHtml = q.choices
    .map((p, idx) => {
      // 化けギミック: 正体出現前は「化けの皮」のポケモンを表示する
      const isDisguisedSlot = disguise !== null && disguise.pos === idx;
      const display = isDisguisedSlot && !disguise.revealed ? disguise.shown : p;
      const isSelected = answered
        ? q.pickedIds!.includes(p.id)
        : selection.has(p.id);
      const isAnswerCard = expected.includes(p.id);
      const cls = ["card", "choice-card"];
      if (!answered && isSelected) cls.push("choice-selected");
      if (answered && isAnswerCard) cls.push("choice-correct");
      if (answered && isSelected && !isAnswerCard) cls.push("choice-picked-wrong");
      if (isDisguisedSlot && disguise.revealed && justRevealed) cls.push("glitch");
      const check = isSelected ? `<span class="check-mark" aria-hidden="true">✓</span>` : "";
      const speed = answered
        ? `<div class="speed-value">すばやさ <strong>${p.speed}</strong></div>${speedBarHtml(p.speed)}`
        : `<div class="speed-value">すばやさ <strong>???</strong></div>`;
      return `
        <button class="${cls.join(" ")}" data-pick="${p.id}" aria-pressed="${isSelected}" ${answered ? "disabled" : ""}>
          ${check}
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

  const resultBanner = answered
    ? `<p class="result-banner ${q.correct ? "result-banner-correct" : "result-banner-wrong"}" role="alert">${q.correct ? "せいかい！" : "ざんねん…"}</p>`
    : "";

  const footer = answered
    ? `<button class="btn btn-primary" id="next-btn">${isLastQuestion(state) ? "けっかを見る" : "つぎの問題へ"}</button>`
    : `<button class="btn btn-primary" id="confirm-btn" ${selection.size === 0 ? "disabled" : ""}>けってい</button>`;

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
      <p class="question-text">${esc(q.target.jaName)}より すばやいのを ぜんぶ えらぼう！<br><span class="question-hint">(こたえは 1〜3匹。えらんだら「けってい」)</span></p>
      ${revealBanner}
      ${resultBanner}
      <div class="choices choices-4">${choicesHtml}</div>
      <footer class="quiz-footer">${footer}</footer>
    </div>
  `;

  hydrateImages(root);
  if (answered) animateSpeedBars(root);

  if (!answered) {
    for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-pick]")) {
      btn.addEventListener("click", () =>
        handlers.onToggle(Number(btn.dataset.pick))
      );
    }
    root
      .querySelector<HTMLButtonElement>("#confirm-btn")
      ?.addEventListener("click", handlers.onConfirm);
  } else {
    root
      .querySelector<HTMLButtonElement>("#next-btn")!
      .addEventListener("click", handlers.onNext);
  }
}
