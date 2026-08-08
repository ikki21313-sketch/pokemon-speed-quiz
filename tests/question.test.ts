import { describe, expect, it } from "vitest";
import { buildQuestions } from "../src/game/question";
import { loadPokeData, loadTricksters } from "../src/data/loader";
import {
  TOTAL_Q,
  CHOICE_COUNT,
  COMPUTED_RANGE,
  ZOROARK_ID,
  computedSpeed,
  correctChoice,
} from "../src/game/types";
import type { Question } from "../src/game/types";

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

/** 1問の基本不変条件 (C-1, C-2, C-5, C-6) を検証 */
function expectInvariants(q: Question): void {
  // C-1: 5体のポケモン ID が相異なる
  const ids = [q.target.poke.id, ...q.choices.map((c) => c.poke.id)];
  expect(new Set(ids).size).toBe(CHOICE_COUNT + 1);
  // C-2: 5体(+化けの皮)の計算後実数値が相異なる
  const speeds = [q.target.speed, ...q.choices.map((c) => c.speed)];
  expect(new Set(speeds).size).toBe(CHOICE_COUNT + 1);
  if (q.disguise) {
    expect(q.disguise.shown.speed).not.toBe(q.target.speed);
  }
  // 実数値が計算式どおり
  for (const e of [q.target, ...q.choices]) {
    expect(e.speed).toBe(computedSpeed(e.poke.speed, e.spread));
  }
  // C-5: お手本より速いのは(正体ベースで)ちょうど1体
  expect(q.choices.filter((c) => c.speed > q.target.speed)).toHaveLength(1);
  // C-4: 範囲制約(化けた正体は対象外)
  for (const [i, c] of q.choices.entries()) {
    if (q.disguise && q.disguise.pos === i) continue;
    expect(Math.abs(c.speed - q.target.speed)).toBeLessThanOrEqual(COMPUTED_RANGE);
  }
  // C-6: ゾロアークは通常枠に登場しない
  for (const [i, c] of q.choices.entries()) {
    if (q.disguise && q.disguise.pos === i) continue;
    expect(c.poke.id).not.toBe(ZOROARK_ID);
  }
  expect(q.target.poke.id).not.toBe(ZOROARK_ID);
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
});

describe("buildQuestions (ゾロアークギミック)", () => {
  const tricks = loadTricksters();

  it("Z-1: trickRate=0 なら disguise は発生しない", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(10), { tricks, trickRate: 0 });
    for (const q of qs) expect(q.disguise).toBeNull();
  });

  it("Z-2: trickRate=1 で disguise が発生し、正体はゾロアーク系", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(12), { tricks, trickRate: 1 });
    const disguised = qs.filter((q) => q.disguise !== null);
    expect(disguised.length).toBeGreaterThan(0);
    const trickIds = new Set(tricks.map((t) => t.id));
    for (const q of disguised) {
      const actual = q.choices[q.disguise!.pos];
      expect(trickIds.has(actual.poke.id)).toBe(true);
      expect(q.disguise!.shown.poke.id).not.toBe(actual.poke.id);
      expect(q.disguise!.revealed).toBe(false);
    }
  });

  it("Z-3: 正解モードでは見かけの正解が0体、正体だけが速い", () => {
    let seenAnswerMode = 0;
    for (let seed = 0; seed < 50; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), {
        tricks,
        trickRate: 1,
        trickAnswerRate: 1,
      });
      for (const q of qs) {
        if (!q.disguise) continue;
        seenAnswerMode++;
        const actual = q.choices[q.disguise.pos];
        // 正体が唯一の正解
        expect(correctChoice(q).poke.id).toBe(actual.poke.id);
        // 見かけ(化けの皮+他3体)は全て遅い
        expect(q.disguise.shown.speed).toBeLessThan(q.target.speed);
        for (const [i, c] of q.choices.entries()) {
          if (i === q.disguise.pos) continue;
          expect(c.speed).toBeLessThan(q.target.speed);
        }
      }
    }
    expect(seenAnswerMode).toBeGreaterThan(0);
  });

  it("Z-4: 非正解モードでは正解は通常枠にあり、正体は遅い", () => {
    let seen = 0;
    for (let seed = 0; seed < 50; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), {
        tricks,
        trickRate: 1,
        trickAnswerRate: 0,
      });
      for (const q of qs) {
        if (!q.disguise) continue;
        seen++;
        const actual = q.choices[q.disguise.pos];
        expect(actual.speed).toBeLessThan(q.target.speed);
        expect(correctChoice(q).poke.id).not.toBe(actual.poke.id);
        // 化けの皮も遅い側 (見かけの正解が2体にならない)
        expect(q.disguise.shown.speed).toBeLessThan(q.target.speed);
      }
    }
    expect(seen).toBeGreaterThan(0);
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
