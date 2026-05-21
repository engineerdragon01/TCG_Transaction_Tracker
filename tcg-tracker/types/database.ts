// Database types mirroring the Supabase schema in sql/schema.sql.

export type InteractionType = 'trade' | 'sale' | 'buy';
export type CardDirection = 'in' | 'out';
export type ImageKind = 'card' | 'cash' | 'screenshot' | 'other';

export interface Event {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  event_id: string;
  user_id: string;
  type: InteractionType;
  occurred_at: string;
  cash_in: number;
  cash_out: number;
  payment_method: string | null;
  counterparty: string | null;
  notes: string | null;
  created_at: string;
}

export interface InteractionCard {
  id: string;
  interaction_id: string;
  direction: CardDirection;
  tcg_card_id: string | null;
  card_name: string;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  image_url: string | null;
  scan_image_url: string | null;
  estimated_value: number | null;
  quantity: number;
  created_at: string;
}

export interface InteractionImage {
  id: string;
  interaction_id: string;
  storage_path: string;
  kind: ImageKind;
  created_at: string;
}

export interface InteractionSummary {
  id: string;
  event_id: string;
  user_id: string;
  type: InteractionType;
  occurred_at: string;
  cash_in: number;
  cash_out: number;
  cards_in_value: number;
  cards_out_value: number;
  net_value: number;
}

// pokemontcg.io API shape (trimmed to what we use)
export interface PokemonTcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    images: { symbol: string; logo: string };
  };
  images: { small: string; large: string };
  cardmarket?: {
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      avg30?: number;
    };
  };
  tcgplayer?: {
    prices?: Record<string, { market?: number; mid?: number }>;
  };
}
