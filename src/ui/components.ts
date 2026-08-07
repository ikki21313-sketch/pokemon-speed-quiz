import type { GameState, Pokemon } from "../game/types";
import { attachFallback } from "./images";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** ヘッダーの進捗ドット10個 (正解=緑, 不正解=赤, 現在=強調) */
export function progressDotsHtml(state: GameState): string {
  return state.questions
    .map((q, i) => {
      const cls = ["dot"];
      if (q.correct === true) cls.push("dot-correct");
      if (q.correct === false) cls.push("dot-wrong");
      if (i === state.index && state.phase === "quiz") cls.push("dot-current");
      return `<span class="${cls.join(" ")}"></span>`;
    })
    .join("");
}

const SPEED_MAX = 200;

/** 素早さバー。回答時に 0% → 実値へアニメーションさせる */
export function speedBarHtml(speed: number): string {
  const pct = Math.min(100, (speed / SPEED_MAX) * 100);
  return (
    `<div class="speed-bar" role="img" aria-label="すばやさ ${speed}">` +
    `<div class="speed-bar-fill" data-pct="${pct.toFixed(1)}" style="width:0%"></div>` +
    `</div>`
  );
}

/** data-pct を持つバーを実値までアニメーションで伸ばす */
export function animateSpeedBars(root: HTMLElement): void {
  const fills = root.querySelectorAll<HTMLElement>(".speed-bar-fill[data-pct]");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const el of fills) el.style.width = `${el.dataset.pct}%`;
    });
  });
}

/** data-poke-img 属性の img にフォールバック付きで画像を読み込む */
export function hydrateImages(root: HTMLElement): void {
  const imgs = root.querySelectorAll<HTMLImageElement>("img[data-poke-img]");
  for (const img of imgs) {
    attachFallback(img, Number(img.dataset.pokeImg));
  }
}

export function pokeImgHtml(p: Pokemon, cls = ""): string {
  return `<img class="${cls}" data-poke-img="${p.id}" alt="${esc(p.jaName)}" width="120" height="120" loading="lazy">`;
}
