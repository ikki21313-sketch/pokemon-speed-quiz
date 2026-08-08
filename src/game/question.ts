import type { PokeTuple, Pokemon, Question, Entry, Spread } from "./types";
import {
  CHOICE_COUNT,
  COMPUTED_RANGE,
  SPREADS,
  TARGET_COMPUTED_MIN,
  TARGET_COMPUTED_MAX,
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
 * - C-7: お手本の計算値は TARGET_COMPUTED_MIN〜MAX の範囲内
 *
 * 振り方バイアス対策(ラベル先決め・独立割り当て):
 * 4枚の振り方と正解の位置を、ポケモンを探す前に互いに独立なランダムで確定する。
 * これにより「振り方ラベル」と「正誤」が無相関になり、ラベル読みのメタが成立しない。
 * C-7 の範囲制限は「どの振り方×速い/遅いの窓にも該当ポケモンが存在する」ための条件。
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
    let slots: Entry[] | null = null;
    let zoro: Entry | null = null;
    let correctPos = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const relaxUsed = attempt >= RELAX_AFTER;
      const useTrick = wantTrick && attempt < DROP_TRICK_AFTER;

      // お手本 (C-7: 計算値がレンジ内になるまで引き直し)
      const t = pool[Math.floor(rng() * pool.length)];
      if (!relaxUsed && used.has(t[0])) continue;
      const tEntry = makeEntry(toPokemon(t), SPREADS[Math.floor(rng() * SPREADS.length)]);
      const tc = tEntry.speed;
      if (tc < TARGET_COMPUTED_MIN || tc > TARGET_COMPUTED_MAX) continue;
      const speedsTaken = new Set<number>([tc]);

      // 化けギミック: 正体の振り方を先に決める (正解モードなら速く、非正解モードなら遅く)
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
        if (!zoroEntry) continue;
        speedsTaken.add(zoroEntry.speed);
      }

      // ラベル先決め: 4枚の振り方と正解位置を独立に確定
      const spreads: Spread[] = Array.from(
        { length: CHOICE_COUNT },
        () => SPREADS[Math.floor(rng() * SPREADS.length)]
      );
      const pos = Math.floor(rng() * CHOICE_COUNT);
      // 正解モードでは見かけの4体は全て遅い (正体だけが速い)
      const faster = (i: number) => !(useTrick && answerMode) && i === pos;

      // 各スロットに合うポケモンを探す
      const found: Entry[] = [];
      const idsTaken = new Set<number>([t[0]]);
      for (let i = 0; i < CHOICE_COUNT; i++) {
        let entry: Entry | null = null;
        for (const c of shuffle(pool, rng)) {
          if (idsTaken.has(c[0])) continue;
          if (!relaxUsed && used.has(c[0])) continue;
          const cc = computedSpeed(c[2], spreads[i]);
          if (speedsTaken.has(cc)) continue; // C-2
          if (Math.abs(cc - tc) > COMPUTED_RANGE) continue; // C-4
          if (faster(i) !== cc > tc) continue; // C-5 (側の一致)
          entry = makeEntry(toPokemon(c), spreads[i]);
          break;
        }
        if (!entry) break;
        found.push(entry);
        idsTaken.add(entry.poke.id);
        speedsTaken.add(entry.speed);
      }
      if (found.length < CHOICE_COUNT) continue;

      target = tEntry;
      slots = found;
      zoro = zoroEntry;
      correctPos = pos;
      break;
    }
    if (!target || !slots) throw new Error("failed to build a question");

    const choices = slots;
    for (const e of [target, ...choices]) used.add(e.poke.id);

    // 化けギミック: 正解モードは任意の1枚、非正解モードは正解以外の1枚を差し替える。
    // 振り方ラベルは差し替え前のスロットのものが化けの皮として表示される。
    let disguise: Question["disguise"] = null;
    if (zoro) {
      let pos: number;
      if (answerMode) {
        pos = Math.floor(rng() * CHOICE_COUNT);
      } else {
        const cands = [...Array(CHOICE_COUNT).keys()].filter((i) => i !== correctPos);
        pos = cands[Math.floor(rng() * cands.length)];
      }
      disguise = { pos, shown: choices[pos], revealed: false };
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
