// Pokemon TCG API client (pokemontcg.io).
//
// Strategy for identifying a scanned card:
//   1. OCR the card image and try to extract:
//      - Card name (top of card)
//      - Set number, e.g. "152/198" (bottom-left or bottom-right depending on era)
//   2. Build a query against /v2/cards combining whatever we extracted.
//   3. Return ranked candidates; UI lets the user confirm.
//
// The free tier does not require an API key, but supplying one raises rate limits.

import Constants from 'expo-constants';
import type { PokemonTcgCard } from '@/types/database';

const BASE_URL = 'https://api.pokemontcg.io/v2';
const apiKey = Constants.expoConfig?.extra?.pokemonTcgApiKey as string | undefined;

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey && apiKey !== 'OPTIONAL_POKEMONTCG_IO_KEY') {
    headers['X-Api-Key'] = apiKey;
  }
  return headers;
}

/**
 * Pull a likely card name and set number from OCR'd text.
 *
 * OCR output from a Pokemon card is messy — HP digits, attack text, energy
 * symbols, foil glare etc. We use two heuristics that survive most noise:
 *
 *   - The card NAME is usually one of the first 1-3 non-trivial lines and
 *     consists of letters (sometimes with spaces or a hyphen). We strip
 *     obvious non-name lines (pure numbers, "HP", "Stage", "Basic", etc).
 *
 *   - The set NUMBER follows the pattern "NNN/NNN" somewhere on the card.
 *     Modern cards put it bottom-right; older cards bottom-left. Either way
 *     it's almost always the only "n/n" pattern in the OCR output.
 */
export interface OcrParse {
  candidateName: string | null;
  setNumber: string | null;     // "152"
  setTotal: string | null;      // "198"
  raw: string;
}

const NAME_BLOCKLIST = new Set([
  'hp', 'basic', 'stage', 'stage 1', 'stage 2', 'pokemon', 'pokémon',
  'trainer', 'energy', 'item', 'supporter', 'tool', 'ex', 'gx', 'v', 'vmax',
  'weakness', 'resistance', 'retreat', 'illus', 'illustrator',
]);

export function parseOcrText(rawText: string): OcrParse {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Find set number pattern "NNN/NNN" anywhere.
  let setNumber: string | null = null;
  let setTotal: string | null = null;
  for (const line of lines) {
    const match = line.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
    if (match) {
      setNumber = match[1];
      setTotal = match[2];
      break;
    }
  }

  // Find candidate name from the first few "namelike" lines.
  let candidateName: string | null = null;
  for (const line of lines.slice(0, 6)) {
    const cleaned = line.replace(/[^A-Za-z\s'-]/g, '').trim();
    if (cleaned.length < 3) continue;
    if (NAME_BLOCKLIST.has(cleaned.toLowerCase())) continue;
    if (/^\d+$/.test(line)) continue;
    // Reject lines that are mostly digits (HP rows, attack costs).
    const digitRatio = (line.match(/\d/g)?.length ?? 0) / line.length;
    if (digitRatio > 0.3) continue;
    candidateName = cleaned;
    break;
  }

  return { candidateName, setNumber, setTotal, raw: rawText };
}

/**
 * Search the Pokemon TCG API. Returns ranked candidates.
 *
 * Query language reference: https://docs.pokemontcg.io/api-reference/cards/search-cards
 */
export async function searchCards(opts: {
  name?: string | null;
  setNumber?: string | null;
  setTotal?: string | null;
  pageSize?: number;
}): Promise<PokemonTcgCard[]> {
  const { name, setNumber, setTotal, pageSize = 12 } = opts;
  const terms: string[] = [];

  if (name) {
    // Wildcard match on name. Quote multi-word names.
    const safeName = name.replace(/"/g, '');
    terms.push(`name:"${safeName}*"`);
  }
  if (setNumber) {
    terms.push(`number:${setNumber}`);
  }
  if (setTotal) {
    terms.push(`set.printedTotal:${setTotal}`);
  }

  if (terms.length === 0) return [];

  const q = encodeURIComponent(terms.join(' '));
  const url = `${BASE_URL}/cards?q=${q}&pageSize=${pageSize}&orderBy=-set.releaseDate`;

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`pokemontcg.io: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data: PokemonTcgCard[] };
  return json.data ?? [];
}

/** Pull a market-ish price out of whatever the API returned. */
export function estimateValue(card: PokemonTcgCard): number | null {
  const cmAvg = card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice;
  if (typeof cmAvg === 'number') return cmAvg;
  const tcg = card.tcgplayer?.prices;
  if (tcg) {
    for (const variant of Object.values(tcg)) {
      const v = variant?.market ?? variant?.mid;
      if (typeof v === 'number') return v;
    }
  }
  return null;
}
