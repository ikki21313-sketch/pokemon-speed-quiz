import { describe, expect, it } from "vitest";
import { buildQuestions } from "../src/game/question";
import { loadPokeData, loadTricksters } from "../src/data/loader";
import {
  TOTAL_Q,
  CHOICE_COUNT,
  COMPUTED_RANGE,
  TARGET_COMPUTED_MIN,
  TARGET_COMPUTED_MAX,
  ZOROARK_ID,
  computedSpeed,
  correctChoice,
} from "../src/game/types";
import type { Question, Spread } from "../src/game/types";

/** 固定シードの乱数 (mulberry32) */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const data = loadPokeData();

function disguisedSlot(q: Question, i: number) {
  return q.disguise?.slots.find((s) => s.pos === i) ?? null;
}

/** 1問の基本不変条件 (C-1〜C-8) を検証 */
function expectInvariants(q: Question): void {
  // C-1: 5体のポケモン ID が相異なる
  const ids = [q.target.poke.id, ...q.choices.map((c) => c.poke.id)];
  expect(new Set(ids).size).toBe(CHOICE_COUNT + 1);
  // C-2: 5体(+化けの皮)の計算後実数値が相異なる
  const speeds = [q.target.speed, ...q.choices.map((c) => c.speed)];
  expect(new Set(speeds).size).toBe(CHOICE_COUNT + 1);
  for (const s of q.disguise?.slots ?? []) {
    expect(s.shown.speed).not.toBe(q.target.speed);
  }
  // 実数値が計算式どおり
  for (const e of [q.target, ...q.choices]) {
    expect(e.speed).toBe(computedSpeed(e.poke.speed, e.spread));
  }
  // C-5: お手本より速いのは(正体ベースで)ちょうど1体
  expect(q.choices.filter((c) => c.speed > q.target.speed)).toHaveLength(1);
  // C-4: 通常枠は ±COMPUTED_RANGE 以内。化けの皮はあえて範囲外の遅さ
  for (const [i, c] of q.choices.entries()) {
    const slot = disguisedSlot(q, i);
    if (slot) {
      expect(slot.shown.speed).toBeLessThan(q.target.speed - COMPUTED_RANGE);
    } else {
      expect(Math.abs(c.speed - q.target.speed)).toBeLessThanOrEqual(COMPUTED_RANGE);
    }
  }
  // C-6: ゾロアークは通常枠に登場しない
  for (const [i, c] of q.choices.entries()) {
    if (disguisedSlot(q, i)) continue;
    expect(c.poke.id).not.toBe(ZOROARK_ID);
  }
  expect(q.target.poke.id).not.toBe(ZOROARK_ID);
  // C-7: お手本の計算値がレンジ内
  expect(q.target.speed).toBeGreaterThanOrEqual(TARGET_COMPUTED_MIN);
  expect(q.target.speed).toBeLessThanOrEqual(TARGET_COMPUTED_MAX);
  // C-8: 見かけの振り方構成は 最速1・準速2・無振り1 (化けの皮も含めた表示上の構成)
  const visible = q.choices.map((c, i) => disguisedSlot(q, i)?.shown ?? c);
  const count: Record<Spread, number> = { max: 0, semi: 0, none: 0 };
  for (const v of visible) count[v.spread]++;
  expect(count).toEqual({ max: 1, semi: 2, none: 1 });
}

describe("computedSpeed", () => {
  it("F-1: 無振り/準速/最速の計算式 (切り捨て)", () => {
    // ピカチュウ S90: 無振り110, 準速142, 最速 floor(142×1.1)=156
    expect(computedSpeed(90, "none")).toBe(110);
    expect(computedSpeed(90, "semi")).toBe(142);
    expect(computedSpeed(90, "max")).toBe(156);
    // S100: 最速 floor(152×1.1)=167
    expect(computedSpeed(100, "max")).toBe(167);
  });
});

describe("buildQuestions", () => {
  it("T-1: 指定問数を返す", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(1));
    expect(qs).toHaveLength(TOTAL_Q);
  });

  it("T-2: 全問で不変条件 (正解1体・±20・同計算値なし・ゾロアーク除外) を満たす", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(2));
    for (const q of qs) {
      expect(q.choices).toHaveLength(CHOICE_COUNT);
      expectInvariants(q);
    }
  });

  it("T-5: 1ゲーム内でポケモンが重複しない(通常ケース)", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(5));
    const ids = qs.flatMap((q) => [q.target.poke.id, ...q.choices.map((c) => c.poke.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("T-6: 1000ゲーム生成しても例外・制約違反が発生しない", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed));
      expect(qs).toHaveLength(TOTAL_Q);
      for (const q of qs) expectInvariants(q);
    }
  });

  it("T-8: 振り方ラベルと正誤が無相関 (P(正解|ラベル) ≒ 25%)", () => {
    const correctBy: Record<Spread, number> = { max: 0, semi: 0, none: 0 };
    const cardBy: Record<Spread, number> = { max: 0, semi: 0, none: 0 };
    for (let seed = 0; seed < 500; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed));
      for (const q of qs) {
        correctBy[correctChoice(q).spread]++;
        for (const c of q.choices) cardBy[c.spread]++;
      }
    }
    for (const s of ["max", "semi", "none"] as Spread[]) {
      const p = correctBy[s] / cardBy[s];
      // 理論値 25%。固定シードなので決定的だが、余裕を見て ±3pt で検証
      expect(p).toBeGreaterThan(0.22);
      expect(p).toBeLessThan(0.28);
    }
    // ラベルの出現率は固定構成どおり 最速25% / 準速50% / 無振り25%
    const totalCards = cardBy.max + cardBy.semi + cardBy.none;
    expect(cardBy.max / totalCards).toBeCloseTo(0.25, 1);
    expect(cardBy.semi / totalCards).toBeCloseTo(0.5, 1);
    expect(cardBy.none / totalCards).toBeCloseTo(0.25, 1);
  });
});

describe("buildQuestions (ゾロアークギミック)", () => {
  const tricks = loadTricksters();

  it("Z-1: trickRate=0 なら disguise は発生しない", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(10), { tricks, trickRate: 0 });
    for (const q of qs) expect(q.disguise).toBeNull();
  });

  it("Z-2: trickRate=1 で2枠の disguise が発生し、正体は両フォルムのセット", () => {
    let seen = 0;
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
      const trickIds = new Set(tricks.map((t) => t.id));
      for (const q of qs) {
        if (!q.disguise) continue;
        seen++;
        expect(q.disguise.slots).toHaveLength(2);
        expect(q.disguise.revealed).toBe(false);
        const actualIds = q.disguise.slots.map((s) => q.choices[s.pos].poke.id);
        // ゾロアークとヒスイゾロアークが必ずセット
        expect(new Set(actualIds)).toEqual(trickIds);
        for (const s of q.disguise.slots) {
          expect(trickIds.has(s.shown.poke.id)).toBe(false);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("Z-3: 見かけの正解は0体、正体は片方だけが速く正解になる", () => {
    let seen = 0;
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
      for (const q of qs) {
        if (!q.disguise) continue;
        seen++;
        // 見かけ(化けの皮+通常枠)は全て遅い
        for (const [i, c] of q.choices.entries()) {
          const slot = q.disguise.slots.find((s) => s.pos === i);
          const visible = slot ? slot.shown : c;
          expect(visible.speed).toBeLessThan(q.target.speed);
        }
        // 正解は2体の正体のうちの片方
        const actuals = q.disguise.slots.map((s) => q.choices[s.pos]);
        const fasters = actuals.filter((a) => a.speed > q.target.speed);
        expect(fasters).toHaveLength(1);
        expect(correctChoice(q).poke.id).toBe(fasters[0].poke.id);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("Z-4: 両フォルムとも正解になり得る (どちらかに固定されない)", () => {
    const winners = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
      for (const q of qs) {
        if (q.disguise) winners.add(correctChoice(q).poke.id);
      }
    }
    expect(winners.size).toBe(2);
  });

  it("Z-5: ギミックありでも全ての不変条件を満たす (300ゲーム)", () => {
    for (let seed = 0; seed < 300; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
      for (const q of qs) expectInvariants(q);
    }
  });
});

describe("pokedata", () => {
  it("T-7: 1025件で素早さが 1〜300 の整数", () => {
    expect(data).toHaveLength(1025);
    for (const [id, name, speed] of data) {
      expect(Number.isInteger(id)).toBe(true);
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
      expect(Number.isInteger(speed)).toBe(true);
      expect(speed).toBeGreaterThanOrEqual(1);
      expect(speed).toBeLessThanOrEqual(300);
    }
  });
});
