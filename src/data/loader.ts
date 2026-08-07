import type { PokeTuple } from "../game/types";
import raw from "./pokedata.json";

export function loadPokeData(): PokeTuple[] {
  return raw as PokeTuple[];
}
