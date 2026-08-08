import { describe, expect, it } from "vitest";
import { buildQuestions } from "../src/game/question";
import { loadPokeData, loadTricksters } from "../src/data/loader";
import { TOTAL_Q } from "../src/game/types";

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

describe("buildQuestions", () => {
  it("T-1: 指定問数を返す", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(1));
    expect(qs).toHaveLength(TOTAL_Q);
  });

  it("T-2: 全問で fast.speed > target.speed > slow.speed", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(2));
    for (const q of qs) {
      expect(q.fast.speed).toBeGreaterThan(q.target.speed);
      expect(q.target.speed).toBeGreaterThan(q.slow.speed);
    }
  });

  it("T-3: 各問の3匹の ID が相異なる", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(3));
    for (const q of qs) {
      const ids = new Set([q.target.id, q.fast.id, q.slow.id]);
      expect(ids.size).toBe(3);
    }
  });

  it("T-4: choices に fast と slow が1匹ずつ含まれる", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(4));
    for (const q of qs) {
      const ids = q.choices.map((p) => p.id).sort();
      const expected = [q.fast.id, q.slow.id].sort();
      expect(ids).toEqual(expected);
    }
  });

  it("T-5: 1ゲーム内でポケモンが重複しない(通常ケース)", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(5));
    const ids = qs.flatMap((q) => [q.target.id, q.fast.id, q.slow.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("T-6: 1000ゲーム生成しても例外・制約違反が発生しない", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed));
      expect(qs).toHaveLength(TOTAL_Q);
      for (const q of qs) {
        expect(q.fast.speed).toBeGreaterThan(q.target.speed);
        expect(q.target.speed).toBeGreaterThan(q.slow.speed);
        expect(new Set([q.target.id, q.fast.id, q.slow.id]).size).toBe(3);
      }
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

  it("Z-4: disguise があっても fast > target > slow と C-1/C-2 が保たれる", () => {
    for (let seed = 0; seed < 300; seed++) {
      const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
      for (const q of qs) {
        expect(q.fast.speed).toBeGreaterThan(q.target.speed);
        expect(q.target.speed).toBeGreaterThan(q.slow.speed);
        expect(new Set([q.target.id, q.fast.id, q.slow.id]).size).toBe(3);
        expect(new Set([q.target.speed, q.fast.speed, q.slow.speed]).size).toBe(3);
      }
    }
  });

  it("Z-5: 化けの皮 (shown) は正体と同じ役回り (速い側/遅い側) の見た目になる", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(13), { tricks, trickRate: 1 });
    for (const q of qs.filter((x) => x.disguise !== null)) {
      const actual = q.choices[q.disguise!.pos];
      const shownFasterThanTarget = q.disguise!.shown.speed > q.target.speed;
      const actualFasterThanTarget = actual.speed > q.target.speed;
      expect(shownFasterThanTarget).toBe(actualFasterThanTarget);
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
