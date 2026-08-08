import type { Question } from "../game/types";

// R-8: 画像はリポジトリに同梱せず、実行時に PokeAPI sprites リポジトリを参照する。
// フォールバック: 公式アートワーク → 通常スプライト → インライン SVG プレースホルダ

const SPRITES_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function officialArtworkUrl(id: number): string {
  return `${SPRITES_BASE}/other/official-artwork/${id}.png`;
}

export function spriteUrl(id: number): string {
  return `${SPRITES_BASE}/${id}.png`;
}

/** 汎用ボール型のプレースホルダ (データURI・外部依存なし) */
export const PLACEHOLDER_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
      `<circle cx="50" cy="50" r="40" fill="#fdf6e3" stroke="#1c2b4a" stroke-width="5"/>` +
      `<path d="M10 50h80" stroke="#1c2b4a" stroke-width="5"/>` +
      `<circle cx="50" cy="50" r="12" fill="#fdf6e3" stroke="#1c2b4a" stroke-width="5"/>` +
      `</svg>`
  );

/** img 要素に3段フォールバックの onerror チェーンを張る */
export function attachFallback(img: HTMLImageElement, id: number): void {
  let stage = 0;
  img.onerror = () => {
    stage++;
    if (stage === 1) {
      img.src = spriteUrl(id);
    } else {
      img.onerror = null;
      img.src = PLACEHOLDER_URI;
    }
  };
  img.src = officialArtworkUrl(id);
}

/** 次問の画像を先読みする(化けギミックがある場合は化けの皮と正体の両方) */
export function preloadQuestionImages(q: Question): void {
  const entries = [q.target, ...q.choices];
  if (q.disguise) entries.push(q.disguise.shown);
  for (const e of entries) {
    const img = new Image();
    img.src = officialArtworkUrl(e.poke.id);
  }
}
