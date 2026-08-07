// PokeAPI が GitHub で公開している CSV から素早さ種族値と日本語名を取得し、
// src/data/pokedata.json を生成する。
//
// PokeAPI フェアユースポリシー準拠のため:
// - API サーバー (pokeapi.co) には一切アクセスしない (R-2)
// - 実行は開発者の手動実行のみ。CI に組み込まないこと (R-3)
//
// 実行: npm run sync-data

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
const MAX_ID = 1025;
const SPEED_STAT_ID = 6;
const LANG_JA = 11; // 日本語
const LANG_JA_HRKT = 1; // 日本語(かなカナ) フォールバック

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "pokedata.json"
);

/** 引用符・引用符内カンマに対応した最小限の CSV パーサ */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    rows.push(row);
  }
  return rows;
}

async function fetchCsv(name) {
  const url = `${CSV_BASE}/${name}`;
  console.log(`fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch ${name}: HTTP ${res.status}`);
  }
  return parseCsv(await res.text());
}

const [statsRows, nameRows] = await Promise.all([
  fetchCsv("pokemon_stats.csv"),
  fetchCsv("pokemon_species_names.csv"),
]);

// pokemon_stats.csv: pokemon_id,stat_id,base_stat,effort
const speeds = new Map();
for (const [pokemonId, statId, baseStat] of statsRows.slice(1)) {
  const id = Number(pokemonId);
  if (Number(statId) === SPEED_STAT_ID && id >= 1 && id <= MAX_ID) {
    speeds.set(id, Number(baseStat));
  }
}

// pokemon_species_names.csv: pokemon_species_id,local_language_id,name,genus
// 図鑑 No.1〜1025 では pokemon_id と pokemon_species_id は一致する
const names = new Map();
const fallbackNames = new Map();
for (const [speciesId, langId, name] of nameRows.slice(1)) {
  const id = Number(speciesId);
  if (id < 1 || id > MAX_ID) continue;
  const lang = Number(langId);
  if (lang === LANG_JA) names.set(id, name);
  else if (lang === LANG_JA_HRKT) fallbackNames.set(id, name);
}

const data = [];
const missing = [];
for (let id = 1; id <= MAX_ID; id++) {
  const name = names.get(id) ?? fallbackNames.get(id);
  const speed = speeds.get(id);
  if (name === undefined || speed === undefined || !Number.isInteger(speed)) {
    missing.push(id);
    continue;
  }
  data.push([id, name, speed]);
}

if (missing.length > 0) {
  console.error(`ERROR: missing data for ${missing.length} ids: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ", ..." : ""}`);
  process.exit(1);
}

const json = JSON.stringify(data);
await writeFile(outPath, json + "\n", "utf8");
console.log(`wrote ${outPath}`);
console.log(`entries: ${data.length}, size: ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
