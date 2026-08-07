import type { PokeTuple, Pokemon, Question } from "./types";

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
  rng: () => number = Math.random
): Question[] {
  if (data.length < 3) throw new Error("not enough data");
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
    const [slow, target, fast] = trio.map(toPokemon);
    for (const p of [slow, target, fast]) used.add(p.id);

    const choices: [Pokemon, Pokemon] =
      rng() < 0.5 ? [fast, slow] : [slow, fast];

    questions.push({
      target,
      fast,
      slow,
      choices,
      pickedId: null,
      correct: null,
    });
  }
  return questions;
}
