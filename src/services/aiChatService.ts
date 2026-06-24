import api from './api';

// AI chat turns are inherently slow — they include 1 to N Claude API
// roundtrips plus tool execution between each. The global axios timeout
// (20s) is way too short, so we override per-call here. 3 minutes covers
// even a heavy multi-tool turn comfortably; the backend's own Anthropic
// HttpClient is capped at 120s per single call.
const AI_TIMEOUT_MS = 180_000;

export interface AiConversationSummary {
  id: number;
  title: string;
  createdOn: string;
  lastMessageOn: string;
  createdBy: string | null;
}

export interface AiMessage {
  id: number;
  role: 'user' | 'assistant' | 'tool' | string;
  content: string | null;
  toolCalls: string | null;     // JSON string
  toolCallId: string | null;
  toolName: string | null;
  createdOn: string;
}

export interface SendMessageResponse {
  conversationId: number;
  newMessages: AiMessage[];
  proposedActionIds: number[];
}

export interface PendingAction {
  id: number;
  type: string;                  // 'FlashTournament' | 'CustomerPing' | ...
  title: string;
  summary: string | null;
  payload: string;               // JSON
  status: 'Pending' | 'Approved' | 'Rejected' | 'Executed' | 'Failed' | string;
  proposedBy: string | null;
  proposedOn: string;
  conversationId: number | null;
  decidedBy: string | null;
  decidedOn: string | null;
  executionLog: string | null;
  executedOn: string | null;
}

export interface PaginatedActions {
  totalCount: number;
  data: PendingAction[];
  pageNumber: number;
  pageSize: number;
}

export const aiChatService = {
  listConversations: async (take = 50): Promise<AiConversationSummary[]> => {
    const { data } = await api.get('/ai/chat/conversations', { params: { take } });
    return data;
  },
  getMessages: async (conversationId: number): Promise<AiMessage[]> => {
    const { data } = await api.get(`/ai/chat/conversations/${conversationId}/messages`);
    return data;
  },
  send: async (message: string, conversationId?: number): Promise<SendMessageResponse> => {
    // Long timeout: heavy multi-tool turns (5+ tools) can take 30-60s.
    const { data } = await api.post(
      '/ai/chat/send',
      { conversationId: conversationId ?? null, message },
      { timeout: AI_TIMEOUT_MS },
    );
    return data;
  },
  deleteConversation: async (id: number): Promise<void> => {
    await api.delete(`/ai/chat/conversations/${id}`);
  },
};

export const pendingActionService = {
  list: async (status: string | null = 'Pending', page = 1, pageSize = 50): Promise<PaginatedActions> => {
    const { data } = await api.get('/ai/actions', { params: { status, page, pageSize } });
    return data;
  },
  approve: async (id: number) => {
    const { data } = await api.post(`/ai/actions/${id}/approve`);
    return data;
  },
  reject: async (id: number, note?: string) => {
    const { data } = await api.post(`/ai/actions/${id}/reject`, { note: note ?? null });
    return data;
  },
};
