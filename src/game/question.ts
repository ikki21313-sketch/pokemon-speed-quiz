import type { PokeTuple, Pokemon, Question, Entry, Spread } from "./types";
import {
  CHOICE_COUNT,
  CHOICE_SPREADS,
  COMPUTED_RANGE,
  SPREADS,
  TARGET_COMPUTED_MIN,
  TARGET_COMPUTED_MAX,
  ZOROARK_ID,
  computedSpeed,
} from "./types";

export interface BuildOptions {
  /** 化けギミックの正体候補 (ゾロアーク+ヒスイゾロアークの2体)。2体未満なら発生しない */
  tricks?: Pokemon[];
  /** 化けギミックの発生率 (0〜1) */
  trickRate?: number;
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
 *        (化けの皮は例外で、あえて −COMPUTED_RANGE を超えて遅いポケモンを表示する)
 * - C-5: お手本より計算値が速い選択肢(=正解)は、正体出現後の実体でちょうど1体
 * - C-6: ゾロアーク(ZOROARK_ID)は通常の出題プールに登場しない(化け専用)
 * - C-7: お手本の計算値は TARGET_COMPUTED_MIN〜MAX の範囲内
 * - C-8: 見かけの振り方構成は CHOICE_SPREADS (最速1・準速2・無振り1) で固定
 *
 * 振り方バイアス対策(ラベル先決め・独立割り当て):
 * 4枚の振り方と正解の位置を、ポケモンを探す前に互いに独立なランダムで確定する。
 *
 * 化けギミック(trickRate):
 * - ゾロアークとヒスイゾロアークが必ずセットで、選択肢の2枚に化ける
 * - 見かけの4体は全てお手本より遅い(=見かけ上正解がない)。うち化けの2枚は
 *   ±COMPUTED_RANGE から外れた明らかに遅いポケモンの姿をしている(違和感がヒント)
 * - 正体の2体は「片方だけがお手本より速い」振り方を取る。振り方は C-8 に縛られない。
 *   出現後は 105族 vs 110族 × 振り方の計算勝負になる
 * - 両フォルムの計算値の都合上、お手本の計算値が約126〜175の問題でのみ発生する
 */
export function buildQuestions(
  data: PokeTuple[],
  count: number,
  rng: () => number = Math.random,
  options: BuildOptions = {}
): Question[] {
  const { tricks = [], trickRate = 0 } = options;
  const pool = data.filter((t) => t[0] !== ZOROARK_ID); // C-6
  if (pool.length <= CHOICE_COUNT) throw new Error("not enough data");
  const used = new Set<number>();
  const questions: Question[] = [];

  for (let qi = 0; qi < count; qi++) {
    const wantTrick = tricks.length >= 2 && rng() < trickRate;

    let target: Entry | null = null;
    let slots: Entry[] | null = null;
    let zoroPair: { fast: Entry; slow: Entry } | null = null;
    let disguisePos: number[] = [];

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

      // 化けギミック: 2フォルムを「片方が速く・片方が遅い」に割り当てる (C-5)
      let pair: { fast: Entry; slow: Entry } | null = null;
      if (useTrick) {
        const [f1, f2] = shuffle(tricks, rng);
        for (const [fastForm, slowForm] of shuffle([[f1, f2], [f2, f1]], rng)) {
          const fastS = shuffle(SPREADS, rng).find((s) => {
            const v = computedSpeed(fastForm.speed, s);
            return v > tc && !speedsTaken.has(v);
          });
          const slowS = shuffle(SPREADS, rng).find((s) => {
            const v = computedSpeed(slowForm.speed, s);
            return v < tc && !speedsTaken.has(v);
          });
          if (fastS && slowS) {
            const fast = makeEntry(fastForm, fastS);
            const slow = makeEntry(slowForm, slowS);
            if (fast.speed !== slow.speed) {
              pair = { fast, slow };
              break;
            }
          }
        }
        if (!pair) continue; // このお手本では両側に割り当てられない
        speedsTaken.add(pair.fast.speed);
        speedsTaken.add(pair.slow.speed);
      }

      // ラベル先決め: 固定構成(C-8)をシャッフルして配り、正解位置は独立に確定
      const spreads: Spread[] = shuffle(CHOICE_SPREADS, rng);
      const pos = Math.floor(rng() * CHOICE_COUNT);
      const dPos = useTrick ? shuffle([...Array(CHOICE_COUNT).keys()], rng).slice(0, 2) : [];
      // 化け問題では見かけの正解は無し。通常問題は pos だけが速い
      const wantFaster = (i: number) => !useTrick && i === pos;
      // 化けの皮スロットは ±COMPUTED_RANGE を外れた「明らかに遅い」ポケモンを表示する
      const isSkin = (i: number) => dPos.includes(i);

      const found: Entry[] = [];
      const idsTaken = new Set<number>([t[0]]);
      for (let i = 0; i < CHOICE_COUNT; i++) {
        let entry: Entry | null = null;
        for (const c of shuffle(pool, rng)) {
          if (idsTaken.has(c[0])) continue;
          if (!relaxUsed && used.has(c[0])) continue;
          const cc = computedSpeed(c[2], spreads[i]);
          if (speedsTaken.has(cc)) continue; // C-2
          if (isSkin(i)) {
            if (cc >= tc - COMPUTED_RANGE) continue; // 範囲外の遅さ (違和感枠)
          } else {
            if (Math.abs(cc - tc) > COMPUTED_RANGE) continue; // C-4
            if (wantFaster(i) !== cc > tc) continue; // C-5 (側の一致)
          }
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
      zoroPair = pair;
      disguisePos = dPos;
      break;
    }
    if (!target || !slots) throw new Error("failed to build a question");

    const choices = slots;
    for (const e of [target, ...choices]) used.add(e.poke.id);

    // 化けギミック: 2枠を正体に差し替える (どちらの枠がどちらのフォルムかはランダム)
    let disguise: Question["disguise"] = null;
    if (zoroPair) {
      const [pA, pB] = shuffle(disguisePos, rng);
      disguise = {
        slots: disguisePos.map((p) => ({ pos: p, shown: choices[p] })),
        revealed: false,
      };
      choices[pA] = zoroPair.fast;
      choices[pB] = zoroPair.slow;
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
