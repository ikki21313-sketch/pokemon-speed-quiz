import type { GameState, Entry, Question } from "../../game/types";
import { correctAnswerId, SPREAD_LABEL } from "../../game/types";
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
  const ansId = correctAnswerId(q);
  const cls = ["chip"];
  let tag = "";
  if (isTarget) {
    cls.push("chip-target");
    if (ansId === e.poke.id) cls.push("chip-correct"); // お手本最速の問題
    tag = `<span class="chip-tag">お手本</span>`;
  } else if (e.poke.id === ansId) {
    cls.push("chip-correct");
  } else if (picked) {
    cls.push("chip-wrong");
  }
  if (
    q.disguise?.revealed &&
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

/** 正誤・選択の枠付けなしの素のチップ (化けの皮/正体の併記用) */
function plainChipHtml(e: Entry, tag: string): string {
  return `
    <div class="chip chip-plain">
      ${tag ? `<span class="chip-tag chip-tag-trick">${tag}</span>` : ""}
      ${pokeImgHtml(e.poke, "chip-img")}
      <div class="chip-name">${esc(e.poke.jaName)}</div>
      <div class="chip-spread">${SPREAD_LABEL[e.spread]}</div>
      <div class="chip-speed">${e.speed}<span class="chip-base">(種族値 ${e.poke.speed})</span></div>
    </div>
  `;
}

/**
 * 化け問題の併記ブロック: 出現した問題にだけ「ばける まえ」の数値を見せる。
 * 出現せずスキップした問題は仮の問題のまま扱い、種明かしはしない。
 */
function disguiseSubHtml(q: Question): string {
  if (!q.disguise?.revealed) return "";
  const skins = q.disguise.slots.map((s) => s.shown);
  return `
    <div class="disguise-sub">
      <span class="sub-label">ばける まえ（仮の問題）</span>
      <div class="chips">${skins.map((e) => plainChipHtml(e, "仮")).join("")}</div>
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
            ${q.choices
              .map((e, i) => {
                // 未出現のまま確定した問題は化けの皮の姿で表示 (正体は併記ブロックで種明かし)
                const slot = q.disguise?.slots.find((s) => s.pos === i);
                return chipHtml(q, slot && !q.disguise!.revealed ? slot.shown : e);
              })
              .join("")}
          </div>
          ${disguiseSubHtml(q)}
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
