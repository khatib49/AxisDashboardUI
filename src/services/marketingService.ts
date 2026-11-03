import api from "./api";

// ── Segments ─────────────────────────────────────────────────────────────
export type SegmentRules = {
  lastVisitWithinDays?: number | null;
  lastVisitOlderThanDays?: number | null;
  minSpend?: number | null;
  spendPeriodDays?: number | null;
  minVisits?: number | null;
  loyaltyTicketsMin?: number | null;
  hasEmail?: boolean | null;
  hasPhone?: boolean | null;
  branchId?: number | null;
};

export type SegmentDto = {
  id: number;
  name: string;
  rules: SegmentRules;
  isActive: boolean;
  createdOn: string;
  createdBy: string;
};

export type SegmentCreateDto = { name: string; rules: SegmentRules; isActive?: boolean };
export type SegmentUpdateDto = Partial<SegmentCreateDto>;

export type AudienceRowDto = {
  userId: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  lastVisit?: string | null;
  spend: number;
};
export type AudiencePreviewDto = { count: number; rows: AudienceRowDto[] };

// ── Campaigns ────────────────────────────────────────────────────────────
export type CampaignChannel = "Email" | "Sms" | "WhatsApp";
export type CampaignStatus = "Draft" | "Scheduled" | "Sending" | "Sent" | "Cancelled" | "Failed";

export type CampaignDto = {
  id: number;
  name: string;
  channel: CampaignChannel | string;
  segmentId: number;
  segmentName?: string | null;
  subject?: string | null;
  body: string;
  whatsAppTemplate?: string | null;
  promoCode?: string | null;
  status: CampaignStatus | string;
  scheduledFor?: string | null;
  sentOn?: string | null;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  createdOn: string;
  createdBy: string;
  branchId?: number | null;
};

export type CampaignCreateDto = {
  name: string;
  channel: string;
  segmentId: number;
  body: string;
  subject?: string | null;
  whatsAppTemplate?: string | null;
  promoCode?: string | null;
  scheduledFor?: string | null;
  branchId?: number | null;
};
export type CampaignUpdateDto = Partial<CampaignCreateDto>;

export type CampaignSendSummaryDto = {
  campaignId: number;
  status: string;
  audienceCount: number;
  sent: number;
  failed: number;
  skipped: number;
};
export type CampaignTestSendResultDto = { address: string; status: string; error?: string | null };
export type CampaignStatsDto = {
  campaignId: number;
  status: string;
  audienceCount: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  sentOn?: string | null;
};
export type CampaignRecipientDto = {
  id: number;
  campaignId: number;
  userId?: number | null;
  address: string;
  status: string;
  error?: string | null;
  sentOn?: string | null;
  isTest: boolean;
};
export type Paginated<T> = { totalCount: number; data: T[]; pageNumber: number; pageSize: number };

export type UnsubscribeDto = { id: number; address: string; channel: string; on: string; source: string };

// ── API ──────────────────────────────────────────────────────────────────
export async function getSegments(): Promise<SegmentDto[]> {
  const r = await api.get<SegmentDto[]>("/marketing/segments");
  return r.data;
}
export async function createSegment(dto: SegmentCreateDto): Promise<SegmentDto> {
  const r = await api.post<SegmentDto>("/marketing/segments", dto);
  return r.data;
}
export async function updateSegment(id: number, dto: SegmentUpdateDto): Promise<SegmentDto> {
  const r = await api.put<SegmentDto>(`/marketing/segments/${id}`, dto);
  return r.data;
}
export async function deleteSegment(id: number): Promise<void> {
  await api.delete(`/marketing/segments/${id}`);
}
export async function previewSegment(id: number): Promise<AudiencePreviewDto> {
  const r = await api.get<AudiencePreviewDto>(`/marketing/segments/${id}/preview`);
  return r.data;
}
export async function previewRules(rules: SegmentRules): Promise<AudiencePreviewDto> {
  const r = await api.post<AudiencePreviewDto>("/marketing/segments/preview", rules);
  return r.data;
}

export async function getCampaigns(status?: string): Promise<CampaignDto[]> {
  const r = await api.get<CampaignDto[]>("/marketing/campaigns", { params: status ? { status } : undefined });
  return r.data;
}
export async function getCampaign(id: number): Promise<CampaignDto> {
  const r = await api.get<CampaignDto>(`/marketing/campaigns/${id}`);
  return r.data;
}
export async function createCampaign(dto: CampaignCreateDto): Promise<CampaignDto> {
  const r = await api.post<CampaignDto>("/marketing/campaigns", dto);
  return r.data;
}
export async function updateCampaign(id: number, dto: CampaignUpdateDto): Promise<CampaignDto> {
  const r = await api.put<CampaignDto>(`/marketing/campaigns/${id}`, dto);
  return r.data;
}
export async function deleteCampaign(id: number): Promise<void> {
  await api.delete(`/marketing/campaigns/${id}`);
}
export async function scheduleCampaign(id: number, scheduledFor: string): Promise<CampaignDto> {
  const r = await api.post<CampaignDto>(`/marketing/campaigns/${id}/schedule`, { scheduledFor });
  return r.data;
}
export async function cancelCampaign(id: number): Promise<CampaignDto> {
  const r = await api.post<CampaignDto>(`/marketing/campaigns/${id}/cancel`);
  return r.data;
}
export async function sendCampaignNow(id: number): Promise<CampaignSendSummaryDto> {
  const r = await api.post<CampaignSendSummaryDto>(`/marketing/campaigns/${id}/send-now`, undefined, { timeout: 300000 });
  return r.data;
}
export async function testSendCampaign(id: number, address: string): Promise<CampaignTestSendResultDto> {
  const r = await api.post<CampaignTestSendResultDto>(`/marketing/campaigns/${id}/test-send`, { address });
  return r.data;
}
export async function getCampaignStats(id: number): Promise<CampaignStatsDto> {
  const r = await api.get<CampaignStatsDto>(`/marketing/campaigns/${id}/stats`);
  return r.data;
}
export async function getCampaignRecipients(id: number, params: { status?: string; search?: string; page?: number; pageSize?: number }): Promise<Paginated<CampaignRecipientDto>> {
  const r = await api.get<Paginated<CampaignRecipientDto>>(`/marketing/campaigns/${id}/recipients`, { params });
  return r.data;
}

export async function getUnsubscribes(): Promise<UnsubscribeDto[]> {
  const r = await api.get<UnsubscribeDto[]>("/marketing/unsubscribe/list");
  return r.data;
}
export async function addUnsubscribe(address: string): Promise<UnsubscribeDto> {
  const r = await api.post<UnsubscribeDto>("/marketing/unsubscribe/list", { address });
  return r.data;
}
export async function removeUnsubscribe(id: number): Promise<void> {
  await api.delete(`/marketing/unsubscribe/list/${id}`);
}
