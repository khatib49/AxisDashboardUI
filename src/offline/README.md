# Offline mode (till resilience)

Everything here is behind **`VITE_ENABLE_OFFLINE_MODE=true`** (build-time env).
With the flag unset the app behaves exactly as before: no service worker, no
queue worker, and the `*OfflineAware` helpers are plain API calls.

## Pieces

| File | Role |
| --- | --- |
| `flags.ts` | `OFFLINE_MODE_ENABLED`, per-browser `clientId` |
| `db.ts` | native IndexedDB wrapper (`axis-offline` db, stores `queue` + `snapshot`) |
| `queue.ts` | `enqueue / list / remove / replay`, background worker (`online` event + every 30 s), exponential backoff |
| `snapshot.ts` | `refreshSnapshot()` / `getSnapshot()` for `GET /api/offline/snapshot` |
| `offlineOrders.ts` | `createOrderOfflineAware`, `addItemsOfflineAware`, `closeInvoiceOfflineAware` |
| `offlineGames.ts` | `createGameSessionOfflineAware`, `closeGameSessionOfflineAware`, `listQueuedGameSessions`, `estimateGameSessionPrice` (game till) |
| `useOffline.ts` | hook `{ enabled, online, queueLength, syncing, lastSync, lastError, replayNow }` |
| `registerSw.ts` | registers `/sw.js` (vite-plugin-pwa, Workbox) and starts the worker; called from `main.tsx` behind the flag |
| `../components/common/OfflineBanner.tsx` | "Offline — N orders queued" / "Syncing…" strip |
| `../pages/Offline/OfflineStatus.tsx` | `/offline` page: queued ops, retry / discard, snapshot age |
| `../services/offlineService.ts` | typed calls to `/offline/sync` and `/offline/snapshot` |

## How a page opts in

1. Replace the direct API call with the offline-aware helper and branch on `queued`:

```ts
import { createOrderOfflineAware } from "../../offline/offlineOrders";

const r = await createOrderOfflineAware({
  userId: null,
  itemsRequest: lines,          // same shape as CreateCoffeeShopOrderRequest
  discountId: discountId ?? 0,
  isOpenInvoice,
  setId,
  comment,
});

if (r.queued) {
  // r.placeholder.id is NEGATIVE; show it as "offline-…" and keep using it
  // for addItemsOfflineAware / closeInvoiceOfflineAware while offline.
  toast.warning(`Order queued (offline). It will sync automatically.`);
  setOrders((o) => [r.placeholder, ...o]);
} else {
  // r.response is exactly what the normal endpoint returned.
}
```

2. Read the menu from the snapshot when the live GET fails (status 0):

```ts
import { getSnapshot } from "../../offline/snapshot";
try {
  items = (await getItems(1, 500, categoryId)).data;
} catch (e) {
  if ((e as { status?: number }).status === 0) {
    const snap = await getSnapshot();
    items = snap?.data.items.filter((i) => i.categoryId === categoryId) ?? [];
  } else throw e;
}
```
   (The service worker also serves the last successful `/api/item`,
   `/api/category`, `/api/menu/*` and `/api/offline/snapshot` responses with
   NetworkFirst, so most existing GETs already work offline without changes.)

3. Optional: call `useOffline()` to disable actions that cannot be queued
   (anything other than the five ops below) while `online === false`.

## Game sessions (phase 3)

The game till (`src/pages/Cashier/GameSession.tsx`) is wired the same way,
behind the flag. With the flag off it calls `services/gameSession.ts` exactly
as before; with it on:

```ts
import { createGameSessionOfflineAware, closeGameSessionOfflineAware } from "../../offline/offlineGames";

const r = await createGameSessionOfflineAware({
  gameId, gameSettingId, hours, status: 1,   // the query of POST /transactions/CreateGameSession
  setId, discountId, userId, numberOfPersons, isDayPass, comment,
});
if (r.queued) {
  // r.placeholder.id is NEGATIVE; r.placeholder.totalPrice is an ESTIMATE from
  // the cached game setting (price × hours × persons, minus discount).
} else {
  // r.response is exactly what POST /transactions/CreateGameSession returned.
}

// later, while still offline: the close op carries the create op's id
await closeGameSessionOfflineAware(r.placeholder.id, { walletAmount: 0 });
```

- Op types: `CreateGameSession` (payload = the query parameters of
  `POST api/transactions/CreateGameSession` as a JSON object) and
  `CloseGameSession` (payload `{ invoiceId, walletAmount?, invoiceOpId? }`,
  mirroring `POST api/transactions/sessions/{invoiceId}/close`). Both follow
  the same idempotency / hash / conflict rules as the F&B ops, and a negative
  `invoiceId` is resolved through `invoiceOpId` exactly like `CloseOpenInvoice`.
- `listQueuedGameSessions()` reads the queue and returns the still-queued
  sessions as placeholders (with `closeQueued` when a close is also queued);
  the page lists them with a "Queued" badge above "My Invoices" and offers
  "Close session" on open ones, which queues a `CloseGameSession`.
- The snapshot (`GET /api/offline/snapshot`) now also carries `games`,
  `rooms` (each with its `sets` and their `statusId` / `status`: 10 occupied,
  9 free), the active `gameSettings` and `passTypes`, so the till can pick a
  station and estimate the price offline. These members are optional in the
  TS type so a snapshot cached by an older build still parses.
- The server prices the session when the queue replays (and on close, from
  the real elapsed time); the placeholder price is only a preview.

## Guarantees and limits

- Each queued op carries a GUID `opId`. The server stores the response of a
  **successful** op under that key; replaying it returns the stored response
  and never re-executes. A failed op (400/500) is not stored, so retrying it
  re-executes. Reusing an `opId` with a different payload is reported as
  `conflict` (409) and left in the queue for the cashier to discard. This
  applies to all five op types (`CreateCoffeeShopOrder`, `AddItemsToOpenInvoice`,
  `CloseOpenInvoice`, `CreateGameSession`, `CloseGameSession`).
- Follow-up ops on an invoice created offline (negative id) carry the
  creating op's `invoiceOpId`; the server resolves the real id, even across
  batches, as long as the create op succeeded first. Once the create op has
  synced, the device remembers `tempId -> real id` (store `snapshot`, key
  `idmap`), so `addItemsOfflineAware(-123, …)` called later goes straight to
  the live endpoint with the real id. Pages can ask for it with
  `resolveTempInvoice(tempId)` from `queue.ts`.
- Ops are sent oldest first in batches of 20. The queue is per browser
  profile (IndexedDB) and survives reloads; it is **not** per user.
- The JWT is still needed to sync. If it expires during the outage the user
  must sign in again; the queue is kept and replays after login (created-by
  becomes the new user).
- The snapshot is refreshed when it is older than 30 min and on every
  `online` event. Images are not cached beyond their path strings.

## Build

`vite.config.ts` only adds `VitePWA` when the flag is on, so a normal build
emits no `sw.js` / manifest. With the flag on, `npm run build` emits
`dist/sw.js`, `dist/manifest.webmanifest` and precaches the app shell.
Workbox runtime rules: NetworkFirst (5 s) for `/api/offline/snapshot` and
`/api/{item,category,menu}` GETs, NetworkOnly for every other `/api` call.
