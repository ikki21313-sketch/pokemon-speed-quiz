import type { GameState, Entry, Question } from "../../game/types";
import { correctChoice, SPREAD_LABEL } from "../../game/types";
import { esc, hydrateImages, pokeImgHtml } from "../components";

function comment(score: number, total: number): string {
  const r = score / total;
  if (r === 1) return "パーフェクト！ すばやさ はかせ！";
  if (r >= 0.8) return "すごい！ あと少しで パーフェクト！";
  if (r >= 0.5) return "なかなか いい ちょうし！";
  if (r >= 0.3) return "つぎは もっと いけるはず！";
  return "すばやさは おくが ふかい…！";
}

function chipHtml(q: Question, e: Entry): string {
  const isTarget = e.poke.id === q.target.poke.id;
  const picked = q.pickedId === e.poke.id;
  const cls = ["chip"];
  let tag = "";
  if (isTarget) {
    cls.push("chip-target");
    tag = `<span class="chip-tag">お手本</span>`;
  } else if (e.poke.id === correctChoice(q).poke.id) {
    cls.push("chip-correct");
  } else if (picked) {
    cls.push("chip-wrong");
  }
  if (
    q.disguise &&
    !isTarget &&
    q.disguise.slots.some((s) => q.choices[s.pos].poke.id === e.poke.id)
  ) {
    tag += `<span class="chip-tag chip-tag-trick">ばけていた！</span>`;
  }
  if (picked) {
    tag += `<span class="chip-tag chip-tag-picked">選択</span>`;
  }
  return `
    <div class="${cls.join(" ")}">
      ${tag}
      ${pokeImgHtml(e.poke, "chip-img")}
      <div class="chip-name">${esc(e.poke.jaName)}</div>
      <div class="chip-spread">${SPREAD_LABEL[e.spread]}</div>
      <div class="chip-speed">${e.speed}<span class="chip-base">(種族値 ${e.poke.speed})</span></div>
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
            <span class="history-q">Q${i + 1}. ${esc(q.target.poke.jaName)}(${SPREAD_LABEL[q.target.spread]})より すばやいのは？</span>
          </div>
          <div class="chips">
            ${chipHtml(q, q.target)}
            ${q.choices.map((e) => chipHtml(q, e)).join("")}
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
