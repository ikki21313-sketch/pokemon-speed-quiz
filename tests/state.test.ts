import { describe, expect, it } from "vitest";
import { buildQuestions } from "../src/game/question";
import { answer, isAnswerHidden } from "../src/game/state";
import { loadPokeData, loadTricksters } from "../src/data/loader";
import { TOTAL_Q, correctChoice } from "../src/game/types";
import type { GameState, Question } from "../src/game/types";

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
const tricks = loadTricksters();

function stateWith(q: Question): GameState {
  return { questions: [q], index: 0, score: 0, phase: "quiz" };
}

/** 条件に合う化け問題を seed を変えながら探す */
function findDisguised(pred: (q: Question) => boolean): Question {
  for (let seed = 0; seed < 200; seed++) {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(seed), { tricks, trickRate: 1 });
    const q = qs.find((x) => x.disguise !== null && pred(x));
    if (q) return q;
  }
  throw new Error("suitable disguised question not found");
}

describe("answer (化けギミックのフロー)", () => {
  it("S-1: 見た目に正解がある化け問題で1発正解 → 出現スキップで正解確定", () => {
    const q = findDisguised((x) => !isAnswerHidden(x));
    const st = stateWith(q);
    const result = answer(st, correctChoice(q).poke.id);
    expect(result).toBe(true);
    expect(q.correct).toBe(true);
    expect(q.disguise!.revealed).toBe(false); // 最後まで化けたまま
    expect(st.score).toBe(1);
  });

  it("S-2: 化け問題で不正解を選ぶ → 確定せず正体が出現し、再回答できる", () => {
    const q = findDisguised((x) => !isAnswerHidden(x));
    const st = stateWith(q);
    const ansId = correctChoice(q).poke.id;
    const wrong = q.choices.find((c) => c.poke.id !== ansId)!;
    expect(answer(st, wrong.poke.id)).toBe("revealed");
    expect(q.pickedId).toBeNull();
    expect(q.disguise!.revealed).toBe(true);
    expect(st.score).toBe(0);
    // 再回答 (2回目は正誤が確定する)
    expect(answer(st, ansId)).toBe(true);
    expect(st.score).toBe(1);
  });

  it("S-3: 正解がゾロアーク側の問題では、出現後の正解ピックのみ正解になる", () => {
    const q = findDisguised((x) => isAnswerHidden(x));
    const st = stateWith(q);
    const ansId = correctChoice(q).poke.id;
    const wrong = q.choices.find((c) => c.poke.id !== ansId)!;
    expect(answer(st, wrong.poke.id)).toBe("revealed");
    expect(answer(st, ansId)).toBe(true);
    expect(st.score).toBe(1);
  });

  it("S-4: 出現後に不正解を選ぶと不正解で確定する", () => {
    const q = findDisguised((x) => isAnswerHidden(x));
    const st = stateWith(q);
    const ansId = correctChoice(q).poke.id;
    const wrong = q.choices.find((c) => c.poke.id !== ansId)!;
    expect(answer(st, wrong.poke.id)).toBe("revealed");
    expect(answer(st, wrong.poke.id)).toBe(false);
    expect(q.correct).toBe(false);
    expect(st.score).toBe(0);
    // 確定後は何もしない
    expect(answer(st, ansId)).toBeNull();
  });

  it("S-6: 化けているカードを選ぶと、それが隠れた正解でもスキップせず出現する", () => {
    const q = findDisguised((x) => isAnswerHidden(x));
    const st = stateWith(q);
    const ansId = correctChoice(q).poke.id; // 正解は化けたゾロアーク
    expect(answer(st, ansId)).toBe("revealed"); // 正解ピックでもスキップしない
    expect(q.pickedId).toBeNull();
    // 出現後に同じカードを選べば正解確定
    expect(answer(st, ansId)).toBe(true);
    expect(st.score).toBe(1);
  });

  it("S-5: 通常問題は1回で確定する", () => {
    const qs = buildQuestions(data, TOTAL_Q, seededRng(1)); // trickなし
    const q = qs[0];
    const st = stateWith(q);
    expect(answer(st, correctChoice(q).poke.id)).toBe(true);
    expect(st.score).toBe(1);
  });
});
