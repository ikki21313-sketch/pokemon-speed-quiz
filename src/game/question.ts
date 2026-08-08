import type { PokeTuple, Pokemon, Question, Entry, Spread } from "./types";
import {
  CHOICE_COUNT,
  COMPUTED_RANGE,
  SPREADS,
  ZOROARK_ID,
  computedSpeed,
} from "./types";

export interface BuildOptions {
  /** 化けギミックの正体候補 (ゾロアーク等)。空なら発生しない */
  tricks?: Pokemon[];
  /** 化けギミックの発生率 (0〜1) */
  trickRate?: number;
  /** 化け発生時に「ゾロアークが正解」になる割合 (0〜1) */
  trickAnswerRate?: number;
}

const MAX_ATTEMPTS = 500;
const RELAX_AFTER = 300; // これを超えたら used(再登場禁止)制約のみ緩和
const DROP_TRICK_AFTER = 100; // これを超えたらこの問の化けギミックを諦める

function toPokemon([id, jaName, speed]: PokeTuple): Pokemon {
  return { id, jaName, speed };
}

function makeEntry(poke: Pokemon, spread: Spread): Entry {
  return { poke, spread, speed: computedSpeed(poke.speed, spread) };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 問題を count 問生成する純粋関数。
 * - C-1: 5体(お手本+選択肢4)のポケモン ID がすべて異なる
 * - C-2: 5体の計算後実数値がすべて異なる(同速・引き分けを排除。化けの皮の計算値も含む)
 * - C-3: 1ゲーム内で同じポケモンを再登場させない(試行上限到達時のみ緩和可)
 * - C-4: 選択肢の計算後実数値はお手本の計算値との差が ±COMPUTED_RANGE 以内
 * - C-5: お手本より計算値が速い選択肢(=正解)は、正体出現後の実体でちょうど1体
 * - C-6: ゾロアーク(ZOROARK_ID)は通常の出題プールに登場しない(化け専用)
 *
 * 化けギミック(trickRate):
 * - 正解モード(trickAnswerRate): 見かけの4体は全て遅く、正体のゾロアークだけが速い
 * - 非正解モード: 見かけ通り正解が1体おり、ゾロアークは遅い選択肢に化けている
 */
export function buildQuestions(
  data: PokeTuple[],
  count: number,
  rng: () => number = Math.random,
  options: BuildOptions = {}
): Question[] {
  const { tricks = [], trickRate = 0, trickAnswerRate = 0.5 } = options;
  const pool = data.filter((t) => t[0] !== ZOROARK_ID); // C-6
  if (pool.length <= CHOICE_COUNT) throw new Error("not enough data");
  const used = new Set<number>();
  const questions: Question[] = [];

  for (let qi = 0; qi < count; qi++) {
    const wantTrick = tricks.length > 0 && rng() < trickRate;
    const answerMode = wantTrick && rng() < trickAnswerRate;

    let target: Entry | null = null;
    let picked: Entry[] | null = null;
    let zoro: Entry | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const relaxUsed = attempt >= RELAX_AFTER;
      const useTrick = wantTrick && attempt < DROP_TRICK_AFTER;

      const t = pool[Math.floor(rng() * pool.length)];
      if (!relaxUsed && used.has(t[0])) continue;
      const tEntry = makeEntry(toPokemon(t), SPREADS[Math.floor(rng() * SPREADS.length)]);
      const tc = tEntry.speed;
      const speedsTaken = new Set<number>([tc]);

      // 化けギミック: 正体の振り方を先に決める。
      // 正解モードでは正体が速く、非正解モードでは遅くなければならない。
      let zoroEntry: Entry | null = null;
      if (useTrick) {
        const form = tricks[Math.floor(rng() * tricks.length)];
        for (const s of shuffle(SPREADS, rng)) {
          const e = makeEntry(form, s);
          if (speedsTaken.has(e.speed)) continue;
          if (answerMode ? e.speed > tc : e.speed < tc) {
            zoroEntry = e;
            break;
          }
        }
        if (!zoroEntry) continue; // この目標では化けが成立しない
        speedsTaken.add(zoroEntry.speed);
      }

      // 見かけの選択肢: 正解モードなら4体全て遅く、通常は速い1体+遅い3体 (C-5)
      const needFaster = useTrick && answerMode ? 0 : 1;
      let faster: Entry | null = null;
      const slower: Entry[] = [];
      for (const c of shuffle(pool, rng)) {
        if (c[0] === t[0]) continue;
        if (!relaxUsed && used.has(c[0])) continue;
        for (const s of shuffle(SPREADS, rng)) {
          const cc = computedSpeed(c[2], s);
          if (speedsTaken.has(cc)) continue; // C-2
          if (Math.abs(cc - tc) > COMPUTED_RANGE) continue; // C-4
          if (cc > tc && needFaster === 1 && faster === null) {
            faster = makeEntry(toPokemon(c), s);
            speedsTaken.add(cc);
            break;
          }
          if (cc < tc && slower.length < CHOICE_COUNT - needFaster) {
            slower.push(makeEntry(toPokemon(c), s));
            speedsTaken.add(cc);
            break;
          }
        }
        if (slower.length === CHOICE_COUNT - needFaster && (needFaster === 0 || faster !== null)) break;
      }
      if (slower.length < CHOICE_COUNT - needFaster) continue;
      if (needFaster === 1 && faster === null) continue;

      target = tEntry;
      picked = faster ? [faster, ...slower] : [...slower];
      zoro = zoroEntry;
      break;
    }
    if (!target || !picked) throw new Error("failed to build a question");

    const choices = shuffle(picked, rng);
    for (const e of [target, ...choices]) used.add(e.poke.id);

    // 化けギミック: 正解モードは任意の1枚、非正解モードは遅い選択肢の1枚を差し替える。
    // どちらも正体出現後は「お手本より速いのがちょうど1体」になる (C-5)。
    let disguise: Question["disguise"] = null;
    if (zoro) {
      const candidates = choices
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => answerMode || c.speed < target!.speed);
      const { c: shown, i: pos } = candidates[Math.floor(rng() * candidates.length)];
      disguise = { pos, shown, revealed: false };
      choices[pos] = zoro;
    }

    questions.push({
      target,
      choices,
      disguise,
      pickedId: null,
      correct: null,
    });
  }
  return questions;
}
