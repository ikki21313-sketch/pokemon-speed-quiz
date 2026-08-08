import type { PokeTuple } from "../game/types";
import type { Pokemon } from "../game/types";
import raw from "./pokedata.json";
import zoroRaw from "./zoroark.json";

export function loadPokeData(): PokeTuple[] {
  return raw as PokeTuple[];
}

/** 化けギミックの正体候補 (ゾロアーク・ヒスイゾロアーク) */
export function loadTricksters(): Pokemon[] {
  return (zoroRaw as PokeTuple[]).map(([id, jaName, speed]) => ({
    id,
    jaName,
    speed,
  }));
}
