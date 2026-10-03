import api from "./api";
import { shopApi } from "./shopService";

// ── Admin CMS types ───────────────────────────────────────────────────
export type EventFeature = { icon: string; title: string; desc: string };

/** A ticket type as edited in Admin → Events. `key` is issued by the server on first save. */
export type EventTicketType = {
  key?: string | null;
  name: string;
  price: number;
  description?: string | null;
  /** Seats for this type; null = unlimited (the event capacity still applies). */
  capacity?: number | null;
  isActive: boolean;
};

/** Admin view of a ticket type with live counts. */
export type EventTicketTypeStats = EventTicketType & { key: string; paidCount: number; pendingCount: number };

/** What a visitor can choose on the public page. */
export type EventPublicTicketType = {
  key: string;
  name: string;
  price: number;
  description: string | null;
  isSoldOut: boolean;
  /** Seats left when a cap applies; null = plenty. */
  remaining: number | null;
};

export type EventDto = {
  id: number;
  key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  eventDate: string | null;
  location: string | null;
  features: EventFeature[];
  videoPath: string | null;
  videoYoutubeId: string | null;
  heroImagePath: string | null;
  price: number;
  currency: string;
  enableVisa: boolean;
  enableWhish: boolean;
  enableCash: boolean;
  whishPaymentLink: string | null;
  whatsAppNumber: string | null;
  whatsAppTemplate: string | null;
  isPublished: boolean;
  isActive: boolean;
  capacity: number | null;
  createdOn: string;
  registrationCount: number;
  paidCount: number;
  /** Calendar chip category: PS5 Session, Board Games, Billiards, TCG Event, Social, Tournament, Other. */
  type?: string;
  ticketTypes?: EventTicketTypeStats[] | null;
};

export type EventUpsert = {
  key: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  eventDate?: string | null;
  location?: string | null;
  features?: EventFeature[] | null;
  videoYoutubeId?: string | null;
  price: number;
  currency: string;
  enableVisa: boolean;
  enableWhish: boolean;
  enableCash: boolean;
  whishPaymentLink?: string | null;
  whatsAppNumber?: string | null;
  whatsAppTemplate?: string | null;
  isPublished: boolean;
  isActive: boolean;
  capacity?: number | null;
  type?: string | null;
  /** Omit to leave the event's types untouched; [] = single price. */
  ticketTypes?: EventTicketType[] | null;
};

// What the public page renders — fully data-driven.
export type EventPublic = {
  key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  eventDate: string | null;
  location: string | null;
  features: EventFeature[];
  videoUrl: string | null;
  videoYoutubeId: string | null;
  heroImageUrl: string | null;
  price: number;
  currency: string;
  visaAvailable: boolean;
  whishAvailable: boolean;
  cashAvailable: boolean;
  isSoldOut: boolean;
  /** Empty = one ticket at `price`. */
  ticketTypes?: EventPublicTicketType[] | null;
};

export type EventPublicConfig = {
  eventKey: string;
  price: number;
  currency: string;
  whatsAppNumber: string | null;
  stripeEnabled: boolean;
  whishEnabled: boolean;
};

export type EventRegisterRequest = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  paymentMethod: "Visa" | "Whish" | "Cash";
  eventKey?: string;
  /** Required when the event has ticket types. The server sets the price. */
  ticketTypeKey?: string | null;
};

export type EventRegisterResult = {
  registrationId: number;
  paymentMethod: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  // Non-null for Visa (Stripe Checkout) and Whish (Collect) — browser goes here.
  redirectUrl: string | null;
  whatsAppUrl: string | null;
  message: string;
  /** Manual Whish link — shown as a button; payment is confirmed by an admin. */
  payLinkUrl?: string | null;
  /** The ticket — /tickets/{ticketCode}. Pending until the payment is confirmed. */
  ticketCode?: string | null;
  ticketUrl?: string | null;
  ticketTypeName?: string | null;
};

export type EventRegistration = {
  id: number;
  eventKey: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  paymentMethod: string;
  paymentStatus: "Pending" | "Paid" | "Rejected" | "Refunded" | string;
  amount: number;
  currency: string;
  providerRef: string | null;
  confirmedBy: string | null;
  confirmedOn: string | null;
  adminNotes: string | null;
  createdOn: string;
  ticketCode?: string | null;
  checkedInOn?: string | null;
  ticketTypeName?: string | null;
};

export type EventRegistrationStats = {
  total: number;
  paid: number;
  pending: number;
  rejected: number;
  collectedAmount: number;
  pendingAmount: number;
};

export type PaginatedRegistrations = {
  totalCount: number;
  data: EventRegistration[];
  pageNumber: number;
  pageSize: number;
};

/** Card-sized view of a published event for the website's /events listing. */
export type EventPublicSummary = {
  key: string;
  title: string;
  subtitle: string | null;
  eventDate: string | null;
  location: string | null;
  type: string;
  price: number;
  currency: string;
  heroImageUrl: string | null;
  capacity: number | null;
  isSoldOut: boolean;
  /** Highest ticket-type price; when above `price` the card reads "From $price". */
  priceMax?: number | null;
};

// ── Public (anonymous) ────────────────────────────────────────────────
/** Published + active events, soonest first. Anonymous. */
export async function getPublishedEvents(): Promise<EventPublicSummary[]> {
  const { data } = await api.get<EventPublicSummary[]>(`/events`);
  return Array.isArray(data) ? data : [];
}

export async function getEventConfig(eventKey: string): Promise<EventPublicConfig> {
  const { data } = await api.get(`/events/${eventKey}/config`);
  return data;
}

/** Full published event for the landing page. 404s when unpublished. */
export async function getPublicEvent(eventKey: string): Promise<EventPublic> {
  const { data } = await api.get(`/events/${eventKey}`);
  return data;
}

// ── Till (cashier) ────────────────────────────────────────────────────
/** Active dated events for the cashier boards — drafts included. */
export async function getUpcomingEvents(days = 21): Promise<EventDto[]> {
  const { data } = await api.get(`/events/upcoming`, { params: { days } });
  return data;
}

/** Cashier quick-create. Lands unpublished; admin publishes to the website. */
export async function quickCreateEvent(body: {
  title: string;
  type?: string;
  eventDate?: string | null;
  location?: string | null;
  price?: number;
  capacity?: number | null;
}): Promise<EventDto> {
  const { data } = await api.post(`/events/quick`, body);
  return data;
}

// ── Admin CMS ─────────────────────────────────────────────────────────
export async function listEvents(): Promise<EventDto[]> {
  const { data } = await api.get(`/admin/events`);
  return data;
}

export async function createEvent(body: EventUpsert): Promise<EventDto> {
  const { data } = await api.post(`/admin/events`, body);
  return data;
}

export async function updateEvent(id: number, body: EventUpsert): Promise<EventDto> {
  const { data } = await api.put(`/admin/events/${id}`, body);
  return data;
}

export async function deleteEvent(id: number): Promise<void> {
  await api.delete(`/admin/events/${id}`);
}

/** Multipart upload. Progress callback drives the UI bar. */
export async function uploadEventVideo(
  id: number, file: File, onProgress?: (pct: number) => void,
): Promise<{ path: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/admin/events/${id}/video`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 10 * 60 * 1000, // big files need a generous window
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

export async function uploadEventHero(id: number, file: File): Promise<{ path: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/admin/events/${id}/hero`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function removeEventVideo(id: number): Promise<void> {
  await api.delete(`/admin/events/${id}/video`);
}

/**
 * Public registration. Goes through the website's `shopApi` so a signed-in
 * customer's bearer token rides along and the ticket lands on their account;
 * anonymous visitors simply send no token.
 */
export async function registerForEvent(body: EventRegisterRequest): Promise<EventRegisterResult> {
  const { data } = await shopApi.post<EventRegisterResult>(`/events/register`, body);
  return data;
}

// ── Admin ─────────────────────────────────────────────────────────────
export async function listRegistrations(params: {
  eventKey?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  ticketType?: string;
}): Promise<PaginatedRegistrations> {
  const { data } = await api.get(`/admin/event-registrations`, { params });
  return data;
}

export async function getRegistrationStats(eventKey?: string): Promise<EventRegistrationStats> {
  const { data } = await api.get(`/admin/event-registrations/stats`, { params: { eventKey } });
  return data;
}

export async function confirmRegistrationPayment(id: number, notes?: string): Promise<void> {
  await api.post(`/admin/event-registrations/${id}/confirm`, { notes: notes ?? null });
}

export async function rejectRegistrationPayment(id: number, notes?: string): Promise<void> {
  await api.post(`/admin/event-registrations/${id}/reject`, { notes: notes ?? null });
}
