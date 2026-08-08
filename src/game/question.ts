import type { PokeTuple, Pokemon, Question } from "./types";

export interface BuildOptions {
  /** 化けギミックの正体候補 (ゾロアーク等)。空なら発生しない */
  tricks?: Pokemon[];
  /** 化けギミックの発生率 (0〜1) */
  trickRate?: number;
}

const MAX_ATTEMPTS = 500;
const RELAX_AFTER = 300; // これを超えたら used(再登場禁止)制約のみ緩和

function toPokemon([id, jaName, speed]: PokeTuple): Pokemon {
  return { id, jaName, speed };
}

function pick3(data: PokeTuple[], rng: () => number): PokeTuple[] {
  const picked: PokeTuple[] = [];
  while (picked.length < 3) {
    const t = data[Math.floor(rng() * data.length)];
    if (!picked.some((p) => p[0] === t[0])) picked.push(t);
  }
  return picked;
}

/**
 * 問題を count 問生成する純粋関数。
 * - C-1: 3匹の ID がすべて異なる
 * - C-2: 3匹の素早さがすべて異なる(同速排除)
 * - C-3: 1ゲーム内で同じポケモンを再登場させない(試行上限到達時のみ緩和)
 */
export function buildQuestions(
  data: PokeTuple[],
  count: number,
  rng: () => number = Math.random,
  options: BuildOptions = {}
): Question[] {
  if (data.length < 3) throw new Error("not enough data");
  const { tricks = [], trickRate = 0 } = options;
  const used = new Set<number>();
  const questions: Question[] = [];

  for (let q = 0; q < count; q++) {
    let trio: PokeTuple[] | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cand = pick3(data, rng);
      const speeds = new Set(cand.map((t) => t[2]));
      if (speeds.size !== 3) continue; // C-2
      const relaxUsed = attempt >= RELAX_AFTER;
      if (!relaxUsed && cand.some((t) => used.has(t[0]))) continue; // C-3
      trio = cand;
      break;
    }
    if (!trio) throw new Error("failed to build a question");

    trio.sort((a, b) => a[2] - b[2]);
    let [slow, target, fast] = trio.map(toPokemon);
    for (const p of [slow, target, fast]) used.add(p.id);

    // 化けギミック: 選択肢の1枚の正体をゾロアーク等に差し替える。
    // 正体の実速度が target より速ければ fast 役、遅ければ slow 役として化けるため、
    // fast.speed > target.speed > slow.speed の不変条件は出現後も保たれる。
    let disguise: Question["disguise"] = null;
    let disguisedActual: Pokemon | null = null;
    if (tricks.length > 0 && rng() < trickRate) {
      const actual = tricks[Math.floor(rng() * tricks.length)];
      const trioIds = [slow.id, target.id, fast.id];
      const trioSpeeds = [slow.speed, target.speed, fast.speed];
      // 同速 (C-2) や同一ポケモンの共存になる場合はこの問では発生させない
      if (!trioIds.includes(actual.id) && !trioSpeeds.includes(actual.speed)) {
        if (actual.speed > target.speed) {
          disguise = { pos: 0, shown: fast, revealed: false };
          fast = actual;
        } else {
          disguise = { pos: 0, shown: slow, revealed: false };
          slow = actual;
        }
        disguisedActual = actual;
      }
    }

    const choices: [Pokemon, Pokemon] =
      rng() < 0.5 ? [fast, slow] : [slow, fast];
    if (disguise && disguisedActual) {
      disguise.pos = choices[0].id === disguisedActual.id ? 0 : 1;
    }

    questions.push({
      target,
      fast,
      slow,
      choices,
      disguise,
      pickedId: null,
      correct: null,
    });
  }
  return questions;
}
