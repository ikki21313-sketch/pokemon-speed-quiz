import { describe, expect, it } from "vitest";
import { buildQuestions } from "../src/game/question";
import { loadPokeData, loadTricksters } from "../src/data/loader";
import { TOTAL_Q, CHOICE_COUNT, SPEED_RANGE, correctIds } from "../src/game/types";
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

/** 1問の基本不変条件 (C-1, C-2, C-5) を検証 */
function expectInvariants(q: Question, checkRange = true): void {
  // C-1: 5匹の ID が相異なる
  const ids = [q.target.id, ...q.choices.map((c) => c.id)];
  expect(new Set(ids).size).toBe(CHOICE_COUNT + 1);
  // C-2: 5匹の素早さが相異なる
  const speeds = [q.target.speed, ...q.choices.map((c) => c.speed)];
  expect(new Set(speeds).size).toBe(CHOICE_COUNT + 1);
  // C-4: 素早さがお手本 ±SPEED_RANGE 以内 (化けた正体は対象外)
  if (checkRange) {
    for (const c of q.choices) {
      expect(Math.abs(c.speed - q.target.speed)).toBeLessThanOrEqual(SPEED_RANGE);
    }
  }
  // C-5: 正解 (お手本より速い) は 1〜3匹
  const n = correctIds(q).length;
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThanOrEqual(CHOICE_COUNT - 1);
}

describe("buildQuestions", () => {
  it("T-1: 指定問数を返す", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(1));
    expect(qs).toHaveLength(TOTAL_Q);
  });

  it("T-2: 選択肢は4匹で、素早さはお手本 ±10 以内", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(2));
    for (const q of qs) {
      expect(q.choices).toHaveLength(CHOICE_COUNT);
      for (const c of q.choices) {
        expect(Math.abs(c.speed - q.target.speed)).toBeLessThanOrEqual(SPEED_RANGE);
        expect(c.speed).not.toBe(q.target.speed);
      }
    }
  });

  it("T-3: 各問で ID・素早さが相異なり、正解数は 1〜3", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(3));
    for (const q of qs) expectInvariants(q);
  });

  it("T-5: 1ゲーム内でポケモンが重複しない(通常ケース)", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(5));
    const ids = qs.flatMap((q) => [q.target.id, ...q.choices.map((c) => c.id)]);
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

  it("Z-2: tricks 未指定でも disguise は発生しない", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(11));
    for (const q of qs) expect(q.disguise).toBeNull();
  });

  it("Z-3: trickRate=1 で disguise が発生し、正体はゾロアーク系", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(12), { tricks, trickRate: 1 });
    const disguised = qs.filter((q) => q.disguise !== null);
    expect(disguised.length).toBeGreaterThan(0);
    const trickIds = new Set(tricks.map((t) => t.id));
    for (const q of disguised) {
      const actual = q.choices[q.disguise!.pos];
      expect(trickIds.has(actual.id)).toBe(true);
      expect(q.disguise!.shown.id).not.toBe(actual.id);
      expect(q.disguise!.revealed).toBe(false);
    }
  });

  it("Z-4: disguise があっても ID/同速/正解数の不変条件が保たれる", () => {
    for (let seed = 0; seed < 300; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
      for (const q of qs) {
        // 化けた正体の素早さは ±10 の範囲外でもよいため range は正体以外で検証
        const ids = [q.target.id, ...q.choices.map((c) => c.id)];
        expect(new Set(ids).size).toBe(CHOICE_COUNT + 1);
        const speeds = [q.target.speed, ...q.choices.map((c) => c.speed)];
        expect(new Set(speeds).size).toBe(CHOICE_COUNT + 1);
        const n = correctIds(q).length;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(CHOICE_COUNT - 1);
        for (const [i, c] of q.choices.entries()) {
          if (q.disguise && q.disguise.pos === i) continue;
          expect(Math.abs(c.speed - q.target.speed)).toBeLessThanOrEqual(SPEED_RANGE);
        }
      }
    }
  });

  it("Z-5: 化けの皮 (shown) は正体と同じ側 (速い/遅い) の見た目になる", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(13), { tricks, trickRate: 1 });
    for (const q of qs.filter((x) => x.disguise !== null)) {
      const actual = q.choices[q.disguise!.pos];
      const shownFaster = q.disguise!.shown.speed > q.target.speed;
      const actualFaster = actual.speed > q.target.speed;
      expect(shownFaster).toBe(actualFaster);
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
