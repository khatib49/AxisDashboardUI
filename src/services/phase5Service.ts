import api from "./api";
import { publicApi, publicError } from "./selfOrderService";
import { apiError } from "./phase4Service";
import type { BaseResponse } from "./deliveryService";

async function call<T>(p: Promise<{ data: T }>): Promise<T> { try { return (await p).data; } catch (e) { throw apiError(e); } }
async function base<T>(p: Promise<{ data: BaseResponse<T> }>): Promise<T> {
  try {
    const r = (await p).data;
    if (!r.success || r.data == null) throw new Error(r.message || r.error || "Request failed");
    return r.data;
  } catch (e) {
    const d = (e as { response?: { data?: BaseResponse<T> & { message?: string } } })?.response?.data;
    if (d && typeof d === "object" && "message" in d && d.message) throw new Error(d.message);
    if (e instanceof Error && !(e as { response?: unknown }).response) throw e;
    throw apiError(e);
  }
}
async function pub<T>(p: Promise<{ data: T }>): Promise<T> { try { return (await p).data; } catch (e) { throw publicError(e); } }
async function pubBase<T>(p: Promise<{ data: BaseResponse<T> }>): Promise<{ data: T; message: string }> {
  try { const r = (await p).data; if (!r.success || r.data == null) throw new Error(r.message); return { data: r.data, message: r.message }; } catch (e) { if (e instanceof Error && !(e as { response?: unknown }).response) throw e; throw publicError(e); }
}

// ── Tournaments ──
export type TournamentParticipant = { id: number; displayName: string; phone?: string | null; userId?: number | null; paid: boolean; paidVia?: string | null; seed?: number | null; finalPlace?: number | null; prizeAmount: number };
export type TournamentMatch = { id: number; round: number; slot: number; player1Id?: number | null; player1?: string | null; player2Id?: number | null; player2?: string | null; winnerId?: number | null; score?: string | null; setId?: number | null; station?: string | null; status: "Pending" | "Ready" | "Playing" | "Done" };
export type Tournament = { id: number; name: string; gameTitle: string; rules?: string | null; startsOn: string; maxPlayers: number; entryFee: number; prizePool: number; prizeSplit: string; roomIds?: string | null; status: string; publicToken: string; prizesPaid: boolean; rounds: number; participants: TournamentParticipant[]; matches: TournamentMatch[] };
export type TournamentSummary = { id: number; name: string; gameTitle: string; startsOn: string; status: string; players: number; maxPlayers: number; entryFee: number; prizePool: number; publicToken: string };
export type TournamentUpsert = { name: string; gameTitle: string; startsOn: string; maxPlayers: number; entryFee: number; prizePool: number; prizeSplit: string; rules?: string | null; roomIds?: string | null };
export type AddPlayer = { displayName: string; phone?: string | null; userId?: number | null; paid: boolean; paidVia?: string | null };

export const listTournaments = () => call<TournamentSummary[]>(api.get("/tournaments"));
export const getTournament = (id: number) => call<Tournament>(api.get(`/tournaments/${id}`));
export const createTournament = (d: TournamentUpsert) => base<Tournament>(api.post("/tournaments", d));
export const updateTournament = (id: number, d: TournamentUpsert) => base<Tournament>(api.put(`/tournaments/${id}`, d));
export const setTournamentStatus = (id: number, status: string) => base<Tournament>(api.post(`/tournaments/${id}/status`, null, { params: { status } }));
export const addTournamentPlayer = (id: number, d: AddPlayer) => base<Tournament>(api.post(`/tournaments/${id}/players`, d));
export const updateTournamentPlayer = (id: number, pid: number, d: AddPlayer) => base<Tournament>(api.put(`/tournaments/${id}/players/${pid}`, d));
export const removeTournamentPlayer = (id: number, pid: number) => base<Tournament>(api.delete(`/tournaments/${id}/players/${pid}`));
export const startTournament = (id: number) => base<Tournament>(api.post(`/tournaments/${id}/start`));
export const reportMatch = (id: number, mid: number, winnerId: number, score?: string) => base<Tournament>(api.post(`/tournaments/${id}/matches/${mid}/result`, { winnerId, score: score || null }));
export const payPrizes = (id: number) => base<Tournament>(api.post(`/tournaments/${id}/pay-prizes`));
export const getPublicTournament = (token: string) => pub<Tournament>(publicApi.get(`/tournaments/public/${encodeURIComponent(token)}`));
export const listPublicTournaments = () => pub<TournamentSummary[]>(publicApi.get("/tournaments/public"));
export const registerTournament = (token: string, displayName: string, phone: string) => pubBase<Tournament>(publicApi.post(`/tournaments/public/${encodeURIComponent(token)}/register`, { displayName, phone }));

// ── Booking ──
export type BookableStation = { setId: number; station: string; roomId: number; room: string };
export type BookingSlot = { startsOn: string; endsOn: string; free: boolean };
export type BookingSettings = { openHour: number; closeHour: number; slotMinutes: number; maxDays: number; requireApproval: boolean; timeZone: string };
export type Booking = { id: number; setId: number; station: string; room: string; startsOn: string; endsOn: string; customerName: string; phone: string; players: number; notes?: string | null; status: string; token: string; source: string; createdOn: string; checkedInOn?: string | null };
export type BookingPublic = { station: string; room: string; startsOn: string; endsOn: string; customerName: string; players: number; status: string; token: string; canCheckIn: boolean; canCancel: boolean };
export type BookingCreate = { setId: number; startsOn: string; durationMinutes: number; customerName: string; phone: string; players: number; notes?: string | null };

export const getBookingSettings = () => pub<BookingSettings>(publicApi.get("/bookings/public/settings"));
export const listBookableStations = () => pub<BookableStation[]>(publicApi.get("/bookings/public/stations"));
export const getAvailability = async (setId: number, date: string, duration: number) => (await pubBase<BookingSlot[]>(publicApi.get("/bookings/public/availability", { params: { setId, date, duration } }))).data;
export const bookPublic = (d: BookingCreate) => pubBase<BookingPublic>(publicApi.post("/bookings/public", d));
export const getPublicBooking = (token: string) => pub<BookingPublic>(publicApi.get(`/bookings/public/${encodeURIComponent(token)}`));
export const cancelPublicBooking = (token: string) => pubBase<BookingPublic>(publicApi.post(`/bookings/public/${encodeURIComponent(token)}/cancel`));
export const checkInPublicBooking = (token: string) => pubBase<BookingPublic>(publicApi.post(`/bookings/public/${encodeURIComponent(token)}/check-in`));
export const listBookings = (from: string, to: string) => call<Booking[]>(api.get("/bookings", { params: { from, to } }));
export const createStaffBooking = (d: BookingCreate) => base<Booking>(api.post("/bookings", d));
export const setBookingStatus = (id: number, status: string) => base<Booking>(api.post(`/bookings/${id}/status`, null, { params: { status } }));

// ── Station ordering ──
export type StationCode = { setId: number; station: string; room: string; token: string; isActive: boolean };
export type StationMenuItem = { id: number; name: string; price: number; imagePath?: string | null; category: string };
export type StationInfo = { station: string; room: string; sessionRunning: boolean; game?: string | null; startedOn?: string | null; endsOn?: string | null; openInvoiceId?: number | null; openInvoiceTotal: number; menu: StationMenuItem[] };
export const listStationCodes = () => call<StationCode[]>(api.get("/station/codes"));
export const ensureStationCode = (setId: number, rotate = false) => call<StationCode>(api.post(`/station/codes/${setId}`, null, { params: { rotate } }));
export const getStation = (token: string) => pub<StationInfo>(publicApi.get(`/station/public/${encodeURIComponent(token)}`));
export const orderFromStation = (token: string, items: { itemId: number; quantity: number }[], note?: string) =>
  pubBase<{ invoiceId: number; invoiceTotal: number; message: string }>(publicApi.post(`/station/public/${encodeURIComponent(token)}/order`, { items, note: note || null }));
export const requestExtension = (token: string, minutes: number) => pubBase<boolean>(publicApi.post(`/station/public/${encodeURIComponent(token)}/extend`, null, { params: { minutes } }));

// ── Owner bot ──
export type OwnerBotChat = { id: number; channel: string; chatId: string; displayName?: string | null; isAllowed: boolean; firstSeenOn: string; lastMessageOn?: string | null };
export type OwnerBotStatus = { telegramConfigured: boolean; whatsAppConfigured: boolean; aiConfigured: boolean; telegramWebhookPath: string; whatsAppWebhookPath: string; dailySummaryHour: number; chats: OwnerBotChat[] };
export const getOwnerBotStatus = () => call<OwnerBotStatus>(api.get("/owner-bot/status"));
export const allowOwnerChat = (id: number, value: boolean) => base<OwnerBotChat>(api.post(`/owner-bot/chats/${id}/allow`, null, { params: { value } }));
export const ownerBotSummary = () => call<{ text: string }>(api.get("/owner-bot/summary"));
export const ownerBotSendSummary = () => call<{ sent: number; failed: number; notes: string[] }>(api.post("/owner-bot/summary/send"));
export const ownerBotAsk = (text: string) => call<{ text: string }>(api.post("/owner-bot/ask", { text }, { timeout: 120000 }));
export const setTelegramWebhook = (publicBaseUrl?: string) => base<string>(api.post("/owner-bot/telegram/set-webhook", null, { params: { publicBaseUrl } }));

// ── Integration settings (existing admin API) ──
export type IntegrationSetting = { id: number; key: string; value?: string | null; isSecret: boolean; hasValue: boolean; description?: string | null; updatedBy?: string | null; updatedOn?: string | null };
export const listIntegrationSettings = () => call<IntegrationSetting[]>(api.get("/integration-settings"));
export const saveIntegrationSetting = (key: string, value: string) => call(api.put("/integration-settings", { key, value }));

// ── Parent wallet ──
export type ParentLink = { id: number; childUserId: number; childName: string; parentName: string; parentPhone?: string | null; parentTelegramChatId?: string | null; parentEmail?: string | null; dailyLimit?: number | null; lowBalanceThreshold?: number | null; notifyOnSpend: boolean; notifyOnSessionEnd: boolean; isActive: boolean; token: string; balance: number; spentToday: number };
export type ParentLinkUpsert = { childUserId: number; parentName: string; parentPhone?: string | null; parentTelegramChatId?: string | null; parentEmail?: string | null; dailyLimit?: number | null; lowBalanceThreshold?: number | null; notifyOnSpend: boolean; notifyOnSessionEnd: boolean; isActive: boolean };
export type ParentView = { childName: string; balance: number; spentToday: number; dailyLimit?: number | null; remainingToday?: number | null; recent: { on: string; type: string; amount: number; balanceAfter: number; notes?: string | null }[] };
export const listParentLinks = () => call<ParentLink[]>(api.get("/parent-wallet"));
export const saveParentLink = (d: ParentLinkUpsert) => base<ParentLink>(api.post("/parent-wallet", d));
export const deleteParentLink = (id: number) => call(api.delete(`/parent-wallet/${id}`));
export const getParentView = (token: string) => pub<ParentView>(publicApi.get(`/parent-wallet/public/${encodeURIComponent(token)}`));

// ── Alerts ──
export type AlertMetric = { metric: string; label: string };
export type AlertRule = { id: number; name: string; metric: string; comparator: "Above" | "Below"; threshold: number; windowMinutes: number; fromHour: number; toHour: number; channels: string; recipients?: string | null; cooldownMinutes: number; isActive: boolean; lastFiredOn?: string | null };
export type AlertRuleUpsert = Omit<AlertRule, "id" | "lastFiredOn">;
export type AlertEvent = { id: number; ruleId: number; ruleName: string; value: number; message: string; delivery?: string | null; firedOn: string };
export const listAlertMetrics = () => call<AlertMetric[]>(api.get("/alerts/metrics"));
export const listAlerts = () => call<AlertRule[]>(api.get("/alerts"));
export const createAlert = (d: AlertRuleUpsert) => base<AlertRule>(api.post("/alerts", d));
export const updateAlert = (id: number, d: AlertRuleUpsert) => base<AlertRule>(api.put(`/alerts/${id}`, d));
export const deleteAlert = (id: number) => call(api.delete(`/alerts/${id}`));
export const testAlert = (id: number, send: boolean) => base<{ ruleId: number; value: number; triggered: boolean; message: string }>(api.post(`/alerts/${id}/test`, null, { params: { send } }));
export const listAlertEvents = () => call<AlertEvent[]>(api.get("/alerts/events", { params: { take: 50 } }));

// ── AI tools ──
export type Forecast = { days: number; weeksOfHistory: number; items: { itemId: number; name: string; total: number; days: { date: string; quantity: number }[] }[]; ingredients: { ingredientId: number; name: string; unit: string; needed: number; onHand: number; reorderLevel?: number | null; suggestedPurchase: number }[] };
export type AiDraft = { id: number; kind: "Menu" | "Invoice"; fileName: string; json: string; status: string; result?: string | null; createdOn: string; createdBy: string };
export const getForecast = (days = 7) => call<Forecast>(api.get("/ai-tools/forecast", { params: { days } }));
export function extractWithAi(kind: "menu" | "invoice", file: File) {
  const fd = new FormData(); fd.append("file", file);
  return base<AiDraft>(api.post(`/ai-tools/extract/${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 180000 }));
}
export const updateDraft = (id: number, json: string) => base<AiDraft>(api.put(`/ai-tools/drafts/${id}`, { json }));
export const discardDraft = (id: number) => call(api.delete(`/ai-tools/drafts/${id}`));
export const applyMenuDraft = (id: number, defaultQuantity: number) => base<{ draftId: number; message: string; created: number; skipped: number }>(api.post(`/ai-tools/drafts/${id}/apply-menu`, { defaultQuantity }));
export const applyInvoiceDraft = (id: number, d: { supplierId?: number | null; newSupplierName?: string | null; purchaseDate?: string | null; invoiceNumber?: string | null; lines: { ingredientId: number; quantity: number; unitCost: number; notes?: string | null }[] }) =>
  base<{ draftId: number; message: string; created: number; purchaseId?: number | null }>(api.post(`/ai-tools/drafts/${id}/apply-invoice`, d));

// ── Setup ──
export type SetupStep = { key: string; title: string; done: boolean; detail: string; link: string };
export type SetupStatus = { done: number; total: number; steps: SetupStep[]; businessName?: string | null; language: string };
export const getSetupStatus = () => call<SetupStatus>(api.get("/setup"));
export const saveBusiness = (d: { name: string; phone?: string; address?: string; language?: string; timeZone?: string }) => call<SetupStatus>(api.post("/setup/business", d));

// ── Accounting exports ──
export async function downloadExport(path: string, params: Record<string, string>) {
  try {
    const r = await api.get(path, { params, responseType: "blob" });
    const cd = String(r.headers["content-disposition"] || "");
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(cd)?.[1] ?? "axis-export.csv";
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement("a"); a.href = url; a.download = decodeURIComponent(name); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return name;
  } catch (e) {
    const blob = (e as { response?: { data?: Blob } })?.response?.data;
    if (blob instanceof Blob) { try { const j = JSON.parse(await blob.text()); throw new Error(j.message || "Export failed"); } catch (x) { if (x instanceof Error && x.message !== "Unexpected end of JSON input") throw x; } }
    throw apiError(e);
  }
}
