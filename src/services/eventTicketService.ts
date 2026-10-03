// Event tickets — the public ticket page, "My tickets" on the website
// account, and the cashier's door check-in.
//
// Three callers, three transports:
//   • getTicket        — anonymous (plain axios, no interceptors, 404 → null)
//   • myTickets        — customer session (shopApi, website token)
//   • door / till fns  — staff session (api, dashboard token)

import axios from "axios";
import api from "./api";
import { shopApi } from "./shopService";

// ── Types ─────────────────────────────────────────────────────────────────
export type TicketPaymentStatus = "Pending" | "Paid" | "Rejected" | "Refunded" | string;

export type EventTicket = {
  ticketCode: string;
  registrationId: number;
  eventKey: string;
  eventTitle: string;
  eventSubtitle?: string | null;
  eventDate?: string | null;
  location?: string | null;
  heroImagePath?: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  paymentMethod: string;
  paymentStatus: TicketPaymentStatus;
  amount: number;
  currency: string;
  paidOn?: string | null;
  checkedInOn?: string | null;
  checkedInBy?: string | null;
  createdOn: string;
  /** Open pay link while the ticket is Pending and the card payment is still valid. */
  payUrl?: string | null;
  whatsAppUrl?: string | null;
  /** True when the event hasn't started yet. */
  isUpcoming: boolean;
  /** Ticket type bought (Standard, VIP …); null for single-price events. */
  ticketTypeName?: string | null;
};

export type CheckInOutcome = "ok" | "already" | "unpaid" | "not_found" | "wrong_event" | "rejected" | string;

export type CheckInResult = {
  ok: boolean;
  outcome: CheckInOutcome;
  message: string;
  ticket?: EventTicket | null;
};

export type EventAttendee = {
  id: number;
  ticketCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  paymentMethod: string;
  paymentStatus: TicketPaymentStatus;
  amount: number;
  currency: string;
  checkedInOn?: string | null;
  checkedInBy?: string | null;
  createdOn: string;
  ticketTypeName?: string | null;
};

export type EventAttendeeList = {
  eventKey: string;
  eventTitle: string;
  eventDate?: string | null;
  capacity?: number | null;
  paid: number;
  pending: number;
  checkedIn: number;
  attendees: EventAttendee[];
};

// ── Public (anonymous) ────────────────────────────────────────────────────
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 20000,
  headers: { Accept: "application/json" },
});

/** The ticket behind a code. Anonymous; null when the code is unknown. */
export async function getTicket(code: string): Promise<EventTicket | null> {
  const res = await publicApi.get<EventTicket>(`/events/tickets/${encodeURIComponent(code.trim())}`, {
    validateStatus: () => true,
  });
  return res.status === 200 ? res.data : null;
}

// ── Customer (website account) ────────────────────────────────────────────
export async function myTickets(): Promise<EventTicket[]> {
  const res = await shopApi.get<EventTicket[]>("/shop/tickets");
  return Array.isArray(res.data) ? res.data : [];
}

// ── Till / door (staff session) ───────────────────────────────────────────
export async function getAttendees(eventKey: string, search?: string): Promise<EventAttendeeList> {
  const res = await api.get<EventAttendeeList>(`/events/${encodeURIComponent(eventKey)}/attendees`, {
    params: { search: search?.trim() || undefined },
  });
  return res.data;
}

/** Scan at the door. Always 200 — read `outcome`. Accepts a bare code or a full ticket URL. */
export async function checkInTicket(code: string, eventKey?: string): Promise<CheckInResult> {
  const res = await api.post<CheckInResult>(`/events/checkin`, { code: extractTicketCode(code), eventKey: eventKey ?? null });
  return res.data;
}

export async function undoCheckIn(registrationId: number): Promise<void> {
  await api.post(`/events/registrations/${registrationId}/undo-checkin`);
}

/** Marks a Pending registration as Paid (cash at the door / counter). */
export async function confirmCashTicket(registrationId: number): Promise<void> {
  await api.post(`/events/registrations/${registrationId}/confirm-cash`);
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** "https://axis.../tickets/TK-ABCD?x=1" or "TK-ABCD" → "TK-ABCD". */
export function extractTicketCode(input: string): string {
  const s = (input || "").trim();
  const m = /\/tickets\/([^/?#\s]+)/i.exec(s);
  if (m) return decodeURIComponent(m[1]).toUpperCase();
  return s.toUpperCase();
}

export function ticketUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/tickets/${encodeURIComponent(code)}`;
}

/** Where the event hero image lives — same rule as the public event page ("/" + path). */
export function ticketHeroUrl(path?: string | null): string | null {
  const p = (path || "").trim();
  if (!p) return null;
  if (/^(https?:)?\/\//i.test(p) || p.startsWith("data:") || p.startsWith("blob:")) return p;
  return "/" + p.replace(/^\//, "");
}

const pad = (n: number) => String(n).padStart(2, "0");
const icsStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * A `data:text/calendar` URL with one VEVENT for the ticket (3-hour slot
 * starting at eventDate). Use as the href of an <a download="…ics">.
 */
export function ticketIcs(ticket: EventTicket): string {
  const start = ticket.eventDate ? new Date(ticket.eventDate) : new Date();
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AXIS Game Lounge//Event Ticket//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ticket.ticketCode}@axis`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(ticket.eventTitle)}`,
    ...(ticket.location ? [`LOCATION:${icsEscape(ticket.location)}`] : []),
    `DESCRIPTION:${icsEscape(`Ticket ${ticket.ticketCode} — ${ticket.firstName} ${ticket.lastName}\n${ticketUrl(ticket.ticketCode)}`)}`,
    `URL:${ticketUrl(ticket.ticketCode)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function formatTicketDate(iso?: string | null): string {
  if (!iso) return "Date to be announced";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** WhatsApp-friendly share text with the ticket link. */
export function ticketShareText(ticket: EventTicket): string {
  const parts = [
    `🎟 ${ticket.eventTitle}`,
    ticket.eventDate ? `📅 ${formatTicketDate(ticket.eventDate)}` : null,
    ticket.location ? `📍 ${ticket.location}` : null,
    `Ticket ${ticket.ticketCode} — ${ticket.firstName} ${ticket.lastName}`,
    ticketUrl(ticket.ticketCode),
  ];
  return parts.filter((p): p is string => !!p).join("\n");
}
