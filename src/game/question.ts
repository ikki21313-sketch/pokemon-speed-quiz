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
  /** お手本自身が最速(=正解)になる確率 (0〜1)。0 で旧仕様に切り戻し */
  targetWinRate?: number;
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
 * - C-5: お手本より計算値が速い選択肢は、正体出現後の実体でちょうど1体。
 *        ただし targetWinRate の確率で「お手本自身が最速」の問題になり、その場合は0体
 *        (正解はお手本自身を選ぶこと)
 * - C-6: ゾロアーク(ZOROARK_ID)は通常の出題プールに登場しない(化け専用)
 * - C-7: お手本の計算値は TARGET_COMPUTED_MIN〜MAX の範囲内
 * - C-8: 見かけの振り方構成は CHOICE_SPREADS (最速1・準速2・無振り1) で固定
 *
 * 振り方バイアス対策(ラベル先決め・独立割り当て):
 * 4枚の振り方と正解の位置を、ポケモンを探す前に互いに独立なランダムで確定する。
 *
 * 化けギミック(trickRate):
 * - ゾロアークとヒスイゾロアークが必ずセットで、選択肢の2枚に化ける。化けの2枚は
 *   ±COMPUTED_RANGE から外れた「明らかに速い」または「明らかに遅い」ポケモンの
 *   姿をしている(違和感がヒント。速い皮は「これが正解だろう」と選ばせる釣り)
 * - 正解位置は通常問題と同じく4枠から一様に選ぶ。正解がゾロアーク枠ならその正体だけが
 *   速く、正解が通常枠ならゾロアーク2体は両方遅い。ゾロアーク以外も正解になり得るため、
 *   出現しても正解の在り処は分からず、全4枚の再計算が必要になる
 * - 正体の振り方は C-8 に縛られない
 * - 正解位置の一様性を保つため、両フォルムが「速くも遅くもなれる」お手本計算値
 *   (約131〜171)の問題でのみ発生する
 */
export function buildQuestions(
  data: PokeTuple[],
  count: number,
  rng: () => number = Math.random,
  options: BuildOptions = {}
): Question[] {
  const { tricks = [], trickRate = 0, targetWinRate = 0 } = options;
  const pool = data.filter((t) => t[0] !== ZOROARK_ID); // C-6
  if (pool.length <= CHOICE_COUNT) throw new Error("not enough data");
  const used = new Set<number>();
  const questions: Question[] = [];

  for (let qi = 0; qi < count; qi++) {
    const wantTrick = tricks.length >= 2 && rng() < trickRate;
    // お手本自身が最速の問題: 選択肢4枚は(正体含め)全て遅い
    const targetWins = rng() < targetWinRate;

    let target: Entry | null = null;
    let slots: Entry[] | null = null;
    let zoroBySlot: Map<number, Entry> | null = null;
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

      // 化けギミックの前提: 両フォルムが速くも遅くもなれるお手本のみ。
      // これにより正解位置(下記 pos)の一様性がギミックの有無で崩れない
      if (useTrick) {
        const bothSides = tricks.every(
          (f) =>
            SPREADS.some((s) => computedSpeed(f.speed, s) > tc) &&
            SPREADS.some((s) => computedSpeed(f.speed, s) < tc)
        );
        if (!bothSides) continue;
      }

      // ラベル先決め: 固定構成(C-8)をシャッフルして配り、正解位置は独立に確定
      // (お手本最速の問題では pos は使われず、全枠が遅い側になる)
      const spreads: Spread[] = shuffle(CHOICE_SPREADS, rng);
      const pos = Math.floor(rng() * CHOICE_COUNT);
      const dPos = useTrick ? shuffle([...Array(CHOICE_COUNT).keys()], rng).slice(0, 2) : [];
      const isSkin = (i: number) => dPos.includes(i);
      // 正解が通常枠ならその枠だけが速い。正解がゾロアーク枠・お手本なら通常枠は全て遅い
      const wantFaster = (i: number) => !targetWins && i === pos && !isSkin(i);

      // ゾロアーク2体: 正解枠なら速く、それ以外は遅い振り方を取る (C-5)
      let zoros: Map<number, Entry> | null = null;
      if (useTrick) {
        const forms = shuffle(tricks, rng);
        zoros = new Map();
        let ok = true;
        for (let k = 0; k < 2; k++) {
          const slot = dPos[k];
          const wantFast = !targetWins && slot === pos;
          const s = shuffle(SPREADS, rng).find((sp) => {
            const v = computedSpeed(forms[k].speed, sp);
            return (wantFast ? v > tc : v < tc) && !speedsTaken.has(v);
          });
          if (!s) {
            ok = false;
            break;
          }
          const e = makeEntry(forms[k], s);
          zoros.set(slot, e);
          speedsTaken.add(e.speed);
        }
        if (!ok) continue;
      }

      // 化けの皮スロットは ±COMPUTED_RANGE を外れた「明らかに速い」または
      // 「明らかに遅い」ポケモンを表示する (50%ずつ。速い皮が見つからなければ遅い皮)
      const found: Entry[] = [];
      const idsTaken = new Set<number>([t[0]]);
      const pickEntry = (spread: Spread, pred: (cc: number) => boolean): Entry | null => {
        for (const c of shuffle(pool, rng)) {
          if (idsTaken.has(c[0])) continue;
          if (!relaxUsed && used.has(c[0])) continue;
          const cc = computedSpeed(c[2], spread);
          if (speedsTaken.has(cc)) continue; // C-2
          if (!pred(cc)) continue;
          return makeEntry(toPokemon(c), spread);
        }
        return null;
      };
      for (let i = 0; i < CHOICE_COUNT; i++) {
        let entry: Entry | null;
        if (isSkin(i)) {
          const wantFastSkin = rng() < 0.5;
          entry =
            (wantFastSkin
              ? pickEntry(spreads[i], (cc) => cc > tc + COMPUTED_RANGE)
              : null) ?? pickEntry(spreads[i], (cc) => cc < tc - COMPUTED_RANGE);
        } else if (wantFaster(i)) {
          entry = pickEntry(spreads[i], (cc) => cc > tc && cc - tc <= COMPUTED_RANGE); // C-4/C-5
        } else {
          entry = pickEntry(spreads[i], (cc) => cc < tc && tc - cc <= COMPUTED_RANGE); // C-4/C-5
        }
        if (!entry) break;
        found.push(entry);
        idsTaken.add(entry.poke.id);
        speedsTaken.add(entry.speed);
      }
      if (found.length < CHOICE_COUNT) continue;

      target = tEntry;
      slots = found;
      zoroBySlot = zoros;
      disguisePos = dPos;
      break;
    }
    if (!target || !slots) throw new Error("failed to build a question");

    const choices = slots;
    for (const e of [target, ...choices]) used.add(e.poke.id);

    // 化けギミック: 2枠を正体に差し替える
    let disguise: Question["disguise"] = null;
    if (zoroBySlot) {
      disguise = {
        slots: disguisePos.map((p) => ({ pos: p, shown: choices[p] })),
        revealed: false,
      };
      for (const [p, e] of zoroBySlot) choices[p] = e;
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
