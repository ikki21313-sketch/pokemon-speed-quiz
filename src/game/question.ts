import type { PokeTuple, Pokemon, Question } from "./types";
import { CHOICE_COUNT, SPEED_RANGE } from "./types";

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

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 問題を count 問生成する純粋関数。
 * - C-1: 5匹(お手本+選択肢4)の ID がすべて異なる
 * - C-2: 5匹の素早さがすべて異なる(同速排除)
 * - C-3: 1ゲーム内で同じポケモンを再登場させない(試行上限到達時のみ緩和可)
 * - C-4: 選択肢の素早さはお手本との差が ±SPEED_RANGE 以内
 * - C-5: お手本より速い選択肢(=正解)は 1〜3 匹
 */
export function buildQuestions(
  data: PokeTuple[],
  count: number,
  rng: () => number = Math.random,
  options: BuildOptions = {}
): Question[] {
  if (data.length <= CHOICE_COUNT) throw new Error("not enough data");
  const { tricks = [], trickRate = 0 } = options;
  const used = new Set<number>();
  const questions: Question[] = [];

  for (let q = 0; q < count; q++) {
    let target: Pokemon | null = null;
    let picked: Pokemon[] | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const relaxUsed = attempt >= RELAX_AFTER;
      const t = data[Math.floor(rng() * data.length)];
      if (!relaxUsed && used.has(t[0])) continue;

      // お手本と同速を除き、±SPEED_RANGE 以内の候補を集める (C-2, C-4)
      const pool = data.filter(
        (c) =>
          c[0] !== t[0] &&
          c[2] !== t[2] &&
          Math.abs(c[2] - t[2]) <= SPEED_RANGE &&
          (relaxUsed || !used.has(c[0]))
      );
      if (pool.length < CHOICE_COUNT) continue;

      // 同速の選択肢が出ないよう、速度の重複を避けながら4匹選ぶ (C-2)
      const cand: PokeTuple[] = [];
      const speedsTaken = new Set<number>([t[2]]);
      for (const c of shuffle(pool, rng)) {
        if (speedsTaken.has(c[2])) continue;
        cand.push(c);
        speedsTaken.add(c[2]);
        if (cand.length === CHOICE_COUNT) break;
      }
      if (cand.length < CHOICE_COUNT) continue;

      const fasterCount = cand.filter((c) => c[2] > t[2]).length;
      if (fasterCount < 1 || fasterCount > CHOICE_COUNT - 1) continue; // C-5

      target = toPokemon(t);
      picked = cand.map(toPokemon);
      break;
    }
    if (!target || !picked) throw new Error("failed to build a question");

    const choices = picked;
    for (const p of [target, ...choices]) used.add(p.id);

    // 化けギミック: 選択肢の1枚の正体をゾロアーク等に差し替える。
    // 正体は化けの皮と同じ側(お手本より速い/遅い)の選択肢にのみ化けるため、
    // 正解数(1〜3)は出現後も変わらない。正体の素早さは ±SPEED_RANGE の範囲外でもよい。
    let disguise: Question["disguise"] = null;
    if (tricks.length > 0 && rng() < trickRate) {
      const actual = tricks[Math.floor(rng() * tricks.length)];
      const allIds = [target.id, ...choices.map((c) => c.id)];
      const allSpeeds = [target.speed, ...choices.map((c) => c.speed)];
      if (!allIds.includes(actual.id) && !allSpeeds.includes(actual.speed)) {
        const sameSide = choices
          .map((c, i) => ({ c, i }))
          .filter(
            ({ c }) => (c.speed > target!.speed) === (actual.speed > target!.speed)
          );
        if (sameSide.length > 0) {
          const { c: shown, i: pos } =
            sameSide[Math.floor(rng() * sameSide.length)];
          disguise = { pos, shown, revealed: false };
          choices[pos] = actual;
          used.add(actual.id);
        }
      }
    }

    questions.push({
      target,
      choices,
      disguise,
      pickedIds: null,
      correct: null,
    });
  }
  return questions;
}
