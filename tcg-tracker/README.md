# TCG Tracker

Mobile app for Pokémon TCG vendors to log every trade, sale, and buy at a show, with card identification via the [pokemontcg.io](https://docs.pokemontcg.io/) API and image attachments for receipts.

Built with **Expo (React Native) + Supabase**.

---

## What it does (MVP scope)

- **Auth.** Email + password via Supabase, session persisted with AsyncStorage.
- **Events.** Each show is an event with name, location, dates, notes.
- **Interactions.** Inside an event, log a **trade**, **sale**, or **buy**. Each interaction tracks:
  - cards going `in` (you received) and `out` (you gave)
  - cash in / cash out + payment method (cash / Venmo / Zelle / etc.)
  - counterparty, notes, timestamp
  - attached images (Venmo screenshots, photos of cash, etc.)
- **Card scanning.** Camera capture → OCR → query pokemontcg.io → user confirms the match. Falls back gracefully to manual search when OCR isn't wired in.
- **Live P/L.** Event detail screen shows running net value, cash totals, and interaction count, computed from the `interaction_summary` view.

---

## Setup

### 1. Install deps

```bash
cd tcg-tracker
npm install
npx expo install --fix
```

### 2. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the contents of `sql/schema.sql`.
3. Storage → New bucket → name it `transaction-images`, set to **Private**.
4. Re-open `sql/schema.sql` and run the three commented-out `storage.objects` policies at the bottom.
5. Copy your Project URL and `anon` public key into `app.json` → `expo.extra.supabaseUrl` / `supabaseAnonKey`.

### 3. Pokémon TCG API (optional)

Works without a key, but free keys at [dev.pokemontcg.io](https://dev.pokemontcg.io/) get higher rate limits. Drop yours in `app.json` → `expo.extra.pokemonTcgApiKey`.

### 4. Run

```bash
npx expo start
```

Scan the QR with **Expo Go** (iOS / Android). Sign up, create an event, tap "+ New interaction", then "+" inside any card section to launch the scanner.

---

## Architecture

```
app/                       Expo Router screens (file-based routing)
  (auth)/                  Sign-in / sign-up (no session required)
  (app)/events/            Events list, new event
    [eventId]/             Event detail w/ interactions list + totals
      interactions/new     Pick interaction type
      interactions/[id]/   Edit cards, cash, notes, attachments
      scan/                Camera → OCR → API match → confirm
components/                Button, Input, Screen, badges
hooks/                     useAuth
lib/
  supabase.ts              Supabase client
  pokemonTcg.ts            API client + OCR text parser
  ocr.ts                   OCR layer (stubbed; see below)
  theme.ts                 Design tokens
types/database.ts          Row types matching the schema
sql/schema.sql             Postgres schema + RLS + view + policies
```

### Data model

```
auth.users (Supabase)
└── events
    └── interactions  (type: trade | sale | buy, cash_in, cash_out, ...)
        ├── interaction_cards   (direction: in | out, tcg_card_id, value, ...)
        └── interaction_images  (kind: card | cash | screenshot | other)
```

One row per card in `interaction_cards`, with a `direction` column. That single column is what makes the same table handle all three transaction types cleanly: a trade has rows on both `in` and `out`, a sale has only `out` cards (+ `cash_in`), a buy has only `in` cards (+ `cash_out`).

Net P/L is computed in the `interaction_summary` view so the app never has to recompute it.

### Card identification pipeline

1. User taps the shutter in `scan/index.tsx`. We capture and downsize the image with `expo-image-manipulator`.
2. `lib/ocr.ts → recognizeText()` returns the card's text (or `null` when stubbed).
3. `lib/pokemonTcg.ts → parseOcrText()` extracts a candidate **name** and **set number** using two heuristics:
   - The name is the first "namelike" line (mostly letters, not a known blocklisted word, not mostly digits).
   - The set number is the first `NNN/NNN` pattern in the OCR text.
4. `searchCards()` queries `/v2/cards` with whatever we extracted.
5. The UI shows top candidates with thumbnails; the user taps the right one. This **human-in-the-loop confirm step** is what makes OCR's ~70-85% accuracy acceptable in practice — the user catches misses in two seconds.
6. On confirm, we save the canonical card metadata (id, name, set, number, rarity, image, market value) plus the user's own scan image and a quantity + optional value override.

---

## OCR — important

Expo Go (the QR-scanner app you get from the App Store) **does not include native OCR libraries**. The `recognizeText` function currently returns `null`, which means the flow drops you straight into manual search — type the card name, optionally add the set number, get candidates.

To enable real on-device OCR you need a **dev build** (not Expo Go):

```bash
npx expo install @react-native-ml-kit/text-recognition
npx expo prebuild
# then run on a real device via Xcode/Android Studio, or use EAS Build
```

Then update `lib/ocr.ts`:

```ts
import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function recognizeText({ imageUri }: RecognizeOptions) {
  const result = await TextRecognition.recognize(imageUri);
  return result.text;
}
export const OCR_AVAILABLE = true;
```

ML Kit text recognition runs on-device, is free, and is fast enough for show-floor use (~200-400ms on modern phones).

---

## What's intentionally NOT in the MVP

These are good v2 candidates, deferred to keep the MVP shippable:

- **Cash OCR from photos.** Reading a stack of bills is unreliable; manual `cash_in`/`cash_out` is faster anyway. Venmo/Zelle screenshot OCR is more tractable and is a natural v2.
- **Live frame scanning.** Right now you tap a shutter. Continuous frame OCR with `react-native-vision-camera` + `vision-camera-ocr` is a clear upgrade for stack-scanning.
- **Set symbol recognition.** OCR can't read the small set logo at the bottom of the card. A small CNN classifier over the ~150 set symbols would dramatically improve set disambiguation. Out of MVP scope.
- **Variant/condition tracking.** Holo vs reverse holo vs full art vs alt art are different SKUs with very different values. The schema supports it (the `tcg_card_id` references a specific printing) but the UI doesn't expose variant selection beyond what the search returns.
- **Multi-card / bulk scan.** Useful for vendors buying collections. v2.
- **Export / CSV.** For tax season. Easy add later — just a Supabase RPC + share sheet.
- **Offline mode.** Convention wifi is bad. For MVP we assume connectivity; v2 should queue writes locally and reconcile.

---

## Files of note

- `sql/schema.sql` — the whole backend in one file
- `lib/pokemonTcg.ts` — OCR text parser + API client (the brains of card ID)
- `app/(app)/events/[eventId]/scan/index.tsx` — the camera → match → confirm flow
- `app/(app)/events/[eventId]/index.tsx` — event detail w/ live totals
