import type { GameState, Pokemon, Question } from "../../game/types";
import { esc, hydrateImages, pokeImgHtml } from "../components";

function comment(score: number, total: number): string {
  const r = score / total;
  if (r === 1) return "パーフェクト！ すばやさ はかせ！";
  if (r >= 0.8) return "すごい！ あと少しで パーフェクト！";
  if (r >= 0.5) return "なかなか いい ちょうし！";
  if (r >= 0.3) return "つぎは もっと いけるはず！";
  return "すばやさは おくが ふかい…！";
}

function chipHtml(q: Question, p: Pokemon): string {
  const cls = ["chip"];
  let tag = "";
  if (p.id === q.target.id) {
    cls.push("chip-target");
    tag = `<span class="chip-tag">お手本</span>`;
  } else if (p.id === q.fast.id) {
    cls.push("chip-correct");
  } else if (p.id === q.pickedId) {
    cls.push("chip-wrong");
  }
  if (p.id === q.pickedId) {
    tag += `<span class="chip-tag chip-tag-picked">選択</span>`;
  }
  return `
    <div class="${cls.join(" ")}">
      ${tag}
      ${pokeImgHtml(p, "chip-img")}
      <div class="chip-name">${esc(p.jaName)}</div>
      <div class="chip-speed">S ${p.speed}</div>
    </div>
  `;
}

export function renderResult(
  root: HTMLElement,
  state: GameState,
  onRetry: () => void
): void {
  const total = state.questions.length;
  const rows = state.questions
    .map((q, i) => {
      const mark = q.correct
        ? `<span class="mark mark-correct">○</span>`
        : `<span class="mark mark-wrong">×</span>`;
      return `
        <li class="history-row">
          <div class="history-head">
            ${mark}
            <span class="history-q">Q${i + 1}. ${esc(q.target.jaName)}より すばやいのは？</span>
          </div>
          <div class="chips">
            ${chipHtml(q, q.target)}
            ${q.choices.map((p) => chipHtml(q, p)).join("")}
          </div>
        </li>
      `;
    })
    .join("");

  root.innerHTML = `
    <div class="screen screen-result">
      <div class="card score-card">
        <div class="score-label">けっか</div>
        <div class="score-value">${state.score}<span class="score-total">/${total}</span></div>
        <p class="score-comment">${comment(state.score, total)}</p>
        <button class="btn btn-primary" id="retry-btn">もういちど あそぶ</button>
      </div>
      <ul class="history">${rows}</ul>
      <footer class="credit">
        データ出典: <a href="https://pokeapi.co/" target="_blank" rel="noopener noreferrer">PokéAPI (pokeapi.co)</a> / 非公式ファンプロジェクト
      </footer>
    </div>
  `;

  hydrateImages(root);
  root
    .querySelector<HTMLButtonElement>("#retry-btn")!
    .addEventListener("click", onRetry);
}
