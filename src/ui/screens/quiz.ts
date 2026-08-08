import type { GameState } from "../../game/types";
import { correctAnswerId } from "../../game/types";
import { currentQuestion, isLastQuestion } from "../../game/state";
import {
  esc,
  progressDotsHtml,
  spreadBadgeHtml,
  speedDetailHtml,
  animateSpeedBars,
  hydrateImages,
  pokeImgHtml,
} from "../components";

export interface QuizHandlers {
  onAnswer: (id: number) => void;
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
  const answerId = correctAnswerId(q);

  const targetSpeed = answered
    ? speedDetailHtml(q.target)
    : `<div class="speed-value">すばやさ <strong>???</strong></div>`;

  const choicesHtml = q.choices
    .map((e, idx) => {
      // 化けギミック: 正体出現前は「化けの皮」のポケモン+振り方を表示する
      const dSlot = disguise?.slots.find((s) => s.pos === idx) ?? null;
      const display = dSlot && !disguise!.revealed ? dSlot.shown : e;
      const isAnswerCard = e.poke.id === answerId;
      const isPicked = e.poke.id === q.pickedId;
      const cls = ["card", "choice-card"];
      if (answered && isAnswerCard) cls.push("choice-correct");
      if (dSlot && disguise!.revealed && justRevealed) cls.push("glitch");
      const badge = !answered
        ? ""
        : isPicked
          ? `<span class="badge ${q.correct ? "badge-correct" : "badge-wrong"}">${q.correct ? "せいかい！" : "ざんねん…"}</span>`
          : "";
      // 未出現のまま確定した場合は化けの皮の数値を表示する (仮の問題として完結)
      const speed = answered
        ? speedDetailHtml(display)
        : `<div class="speed-value">すばやさ <strong>???</strong></div>`;
      return `
        <button class="${cls.join(" ")}" data-pick="${e.poke.id}" ${answered ? "disabled" : ""}>
          ${badge}
          ${spreadBadgeHtml(display.spread)}
          ${pokeImgHtml(display.poke, "poke-img")}
          <div class="poke-name">${esc(display.poke.jaName)}</div>
          ${speed}
        </button>
      `;
    })
    .join("");

  const revealBanner =
    disguise?.revealed && !answered
      ? `<p class="reveal-banner" role="alert">！？ ${disguise.slots
          .map((s) => esc(s.shown.poke.jaName))
          .join("と ")}は ${disguise.slots
          .map((s) => esc(q.choices[s.pos].poke.jaName))
          .join("と ")}が ばけたすがた だった！<br>ここからが ほんとうの しょうぶ！</p>`
      : "";

  root.innerHTML = `
    <div class="screen screen-quiz">
      <header class="quiz-header">
        <div class="q-number">もんだい ${state.index + 1}<span class="q-total">/${state.questions.length}</span></div>
        <div class="dots">${progressDotsHtml(state)}</div>
      </header>
      <button class="card target-card ${answered && answerId === q.target.poke.id ? "choice-correct" : ""}" data-pick="${q.target.poke.id}" ${answered ? "disabled" : ""}>
        ${answered && q.pickedId === q.target.poke.id ? `<span class="badge ${q.correct ? "badge-correct" : "badge-wrong"}">${q.correct ? "せいかい！" : "ざんねん…"}</span>` : ""}
        <div class="target-label">お手本</div>
        ${spreadBadgeHtml(q.target.spread)}
        ${pokeImgHtml(q.target.poke, "poke-img")}
        <div class="poke-name">${esc(q.target.poke.jaName)} <span class="poke-no">No.${q.target.poke.id}</span></div>
        ${targetSpeed}
      </button>
      <p class="question-text">${esc(q.target.poke.jaName)}より すばやいのは どれ？<br><span class="question-hint">(いなければ お手本を タップ！ 振り方も 計算に いれよう)</span></p>
      ${revealBanner}
      <div class="choices choices-4">${choicesHtml}</div>
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
