# CLAUDE.md

Persistent context for Claude Code. Read this first every session.

---

## What this is

**TCG Tracker** — a mobile app for Pokémon TCG vendors to log every trade, sale, and buy at a show, with card identification via the [pokemontcg.io](https://docs.pokemontcg.io/) API and image attachments for cash/Venmo/Zelle receipts.

**Stack:** Expo (React Native) + Expo Router + Supabase (Postgres + Auth + Storage) + TypeScript.

**Status:** MVP scaffolded, not yet shipped. Auth, events, interactions, card search, and image attachments all work. Real on-device OCR is stubbed pending a dev build.

---

## Repo map

```
app/                       Expo Router screens (file-based routing)
  _layout.tsx              Root layout + auth gate (redirects (auth) <-> (app))
  (auth)/                  Sign-in / sign-up — public
    sign-in.tsx
    sign-up.tsx
  (app)/                   Authenticated screens
    events/
      index.tsx            Events list (home)
      new.tsx              Create event form
      [eventId]/
        index.tsx          Event detail: running P/L + interactions list
        interactions/
          new.tsx          Pick interaction type (trade/sale/buy)
          [interactionId]/
            index.tsx      Edit cards, cash, payment, notes, images
        scan/
          index.tsx        Camera → OCR → API match → confirm flow

components/                Button, Input, Screen, InteractionTypeBadge
hooks/useAuth.ts           Supabase session hook + sign in/up/out
lib/
  supabase.ts              Client + STORAGE_BUCKET constant
  pokemonTcg.ts            API client + OCR text parser (parseOcrText, searchCards, estimateValue)
  ocr.ts                   OCR stub — see "OCR" section below
  theme.ts                 Design tokens (palette, radius, spacing, typography, TAP_TARGET)
types/database.ts          Row types matching sql/schema.sql
sql/schema.sql             Postgres schema + RLS + interaction_summary view + storage policies
README.md                  User-facing setup guide
```

---

## Data model (mental model)

```
auth.users (Supabase)
└── events
    └── interactions  (type: trade | sale | buy, cash_in, cash_out, ...)
        ├── interaction_cards   (direction: in | out, tcg_card_id, value, qty, ...)
        └── interaction_images  (kind: card | cash | screenshot | other)
```

**Key design choice:** one `interaction_cards` row per card with a `direction` column (`in` = vendor received, `out` = vendor gave). This makes a single table handle all three transaction types cleanly. A trade has rows on both sides; a sale has only `out` cards + `cash_in`; a buy is the inverse.

**Net P/L** is computed in the `interaction_summary` Postgres view as
`(cash_in + cards_in_value) - (cash_out + cards_out_value)`.
The app never recomputes it client-side; always select from the view for totals.

---

## Card identification pipeline

This is the core of the product. In `app/(app)/events/[eventId]/scan/index.tsx`:

1. **Capture.** `CameraView` shutter → `expo-image-manipulator` resizes to 1200px wide JPEG.
2. **OCR.** `lib/ocr.ts → recognizeText()` returns the card's text (currently `null` — see OCR section).
3. **Parse.** `lib/pokemonTcg.ts → parseOcrText()` pulls a candidate **name** (first "namelike" line, mostly letters, not blocklisted) and a **set number** (first `NNN/NNN` pattern).
4. **Search.** `searchCards({ name, setNumber })` queries `/v2/cards` on pokemontcg.io.
5. **Confirm.** UI shows top candidates with thumbnails; user taps the right one. This human-in-the-loop step is what makes ~70-85% OCR accuracy production-acceptable.
6. **Save.** On confirm: insert `interaction_cards` row with `tcg_card_id`, canonical metadata, market value (or override), quantity, and a signed URL for the user's own scan image stored in Supabase.

Phases in the scan screen are tracked by a `phase` state: `'capture' | 'match' | 'confirm'`.

---

## OCR — current state

`lib/ocr.ts` currently exports a stub that returns `null` and `OCR_AVAILABLE = false`. **Expo Go cannot run native OCR libraries**, so until we do a dev build, scanning drops the user straight into manual search (which still works fine — typing "Charizard" + "199" gets the right card in ~5 seconds).

**To enable real on-device OCR** (planned next step):

1. Run `eas build --profile development --platform ios` (or android) — produces a custom dev client.
2. `npx expo install @react-native-ml-kit/text-recognition`
3. Replace the body of `recognizeText` with:
   ```ts
   import TextRecognition from '@react-native-ml-kit/text-recognition';
   export async function recognizeText({ imageUri }: RecognizeOptions) {
     const result = await TextRecognition.recognize(imageUri);
     return result.text;
   }
   export const OCR_AVAILABLE = true;
   ```
4. Test against real card photos. Tune `parseOcrText` blocklist + heuristics against actual ML Kit output. The `NAME_BLOCKLIST` in `lib/pokemonTcg.ts` is a starting point — real OCR output will surface words we need to add.

The downstream pipeline (parse → search → confirm) works identically once OCR text is flowing.

---

## Roadmap (in priority order)

1. **EAS dev build + ML Kit OCR** — see above. Biggest unlock.
2. **Venmo/Zelle screenshot OCR** — the cash side. Higher-contrast, more structured input than card OCR. Probably ML Kit again + a regex pass for the `$NN.NN` pattern and platform branding.
3. **Offline write queue.** Convention wifi is bad. Need a local SQLite mirror that queues inserts and reconciles on reconnect. AsyncStorage isn't enough — too much data, too many relations. Look at `expo-sqlite` or `op-sqlite`.
4. **CSV export per event** for tax season. Supabase RPC that returns CSV → `expo-sharing`.
5. **Variant/condition tracking.** Schema already supports it via `tcg_card_id` pointing at specific printings, but the UI doesn't expose variant selection clearly. Need: a variant picker on the confirm screen (holo / reverse holo / full art / alt art) and a condition dropdown (NM / LP / MP / HP / DMG).
6. **Bulk / continuous scan** — `react-native-vision-camera` + `vision-camera-ocr` for live frame OCR, useful for buying collections.
7. **Set symbol classifier.** OCR can't read the set logo. A small CNN over the ~150 set symbols would dramatically improve set disambiguation. Big project; deferred.

---

## Conventions

- **TypeScript strict mode.** Don't disable it. Add explicit types at function boundaries.
- **No state libraries** (Redux/Zustand/etc.) yet. `useState` + `useFocusEffect` for refetching is sufficient at MVP scale. Reconsider if a screen starts juggling >5 pieces of derived state.
- **Server is the source of truth.** Always re-fetch on focus rather than maintaining client-side cache invalidation. Speed isn't the bottleneck; correctness is.
- **Tap targets ≥ 48pt** (`TAP_TARGET` in `lib/theme.ts`). Used one-handed at a show.
- **Dark surface by default.** Convention halls have harsh fluorescent lighting; dark UI cuts glare and battery drain.
- **Semantic colors only.** `palette.trade`, `palette.sale`, `palette.buy` for transaction types; `palette.positive` / `palette.negative` for P/L. No decorative palette additions without a reason.
- **Error handling:** `Alert.alert` for now. Replace with a toast component once we have one (low priority).
- **Money:** stored as Postgres `numeric(10,2)`, parsed in JS with `parseFloat`, formatted with `.toFixed(2)`. No `Intl.NumberFormat` yet — keep it simple until we need currency switching.

---

## Common tasks

**Run the app:**
```bash
npx expo start
```
Scan QR with Expo Go (iOS/Android). On macOS, `i` opens iOS simulator, `a` opens Android emulator.

**Typecheck:**
```bash
npm run typecheck
```

**Reset Metro cache** (when imports get weird):
```bash
npx expo start -c
```

**After schema changes:**
1. Edit `sql/schema.sql`.
2. Run the changed statements in the Supabase SQL editor.
3. Update `types/database.ts` to match.
4. Grep the codebase for any queries that need updating.

**Add a new screen:** drop a file in `app/(app)/...`. Expo Router picks it up automatically. Use `useLocalSearchParams<{...}>()` for typed route params.

---

## Gotchas / things future-me will forget

- **Supabase keys live in `app.json` → `expo.extra`**, not env vars. The `Constants.expoConfig?.extra` read in `lib/supabase.ts` assumes this. If we switch to `.env`, also wire up `expo-constants` extra-via-env.
- **Storage bucket name is hardcoded** as `transaction-images` in `lib/supabase.ts` (`STORAGE_BUCKET`). The three storage RLS policies at the bottom of `sql/schema.sql` are **commented out** — they have to be run *after* the bucket exists in the dashboard, or they'll fail.
- **RLS is on for every table.** If a query returns empty when it shouldn't, first check that `auth.uid()` matches the `user_id` on the row. The `interaction_summary` view inherits RLS from the underlying `interactions` table.
- **Signed URLs in Supabase Storage expire.** The interaction detail screen requests fresh 30-minute signed URLs on every focus. Don't cache them.
- **`expo-router` requires `expo-router/babel` plugin** in `babel.config.js`. If routing breaks after a dep change, check that plugin is still present.
- **The `module-resolver` alias `@` → `./`** is set in `babel.config.js` *and* `tsconfig.json`. Both must agree or imports break at runtime vs typecheck.
- **`newArchEnabled: true`** in app.json — we're on the new React Native architecture. Some older libraries don't support it. If a native lib install errors, check its Fabric/TurboModule status before downgrading.

---

## What I'd ask Claude Code to help with first

In rough order:
1. `npm install && npx expo install --fix` — surface any peer dep warnings.
2. Walk me through Supabase project setup interactively (I'll click in the dashboard, you tell me what to do and what to paste into `app.json`).
3. Boot in Expo Go, smoke-test the auth + event + manual card search flow.
4. EAS dev build + wire up real ML Kit OCR. Iterate on `parseOcrText` against real OCR output from photos of cards I provide.
5. Venmo/Zelle screenshot OCR as v2.
