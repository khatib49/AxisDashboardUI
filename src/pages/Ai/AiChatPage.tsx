// AI Chat Page
// ============
// Full-screen chat with the AI assistant. Sidebar lists previous
// conversations. Right pane shows the active thread. Special inline
// "Pending action" cards appear after the AI proposes something — admin
// approves or rejects right there in the chat flow.
//
// Visual notes:
//   - Assistant replies are rendered through MarkdownRenderer so tables,
//     bold, lists, and code blocks look like a real report instead of
//     raw asterisks-and-pipes.
//   - Tool calls are collapsed into a quiet "Used 2 tools ▾" disclosure
//     under the assistant message — clicking it reveals the chips and the
//     raw result rows. The chat reads cleaner this way.
//   - Avatar circle + name on assistant messages; user bubble stays right-
//     aligned and chip-shaped.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AiConversationSummary, AiMessage, PendingAction,
  aiChatService, pendingActionService,
} from "../../services/aiChatService";
import MarkdownRenderer from "./MarkdownRenderer";

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

const tryParse = (s: string | null): any => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};

// ── Pending action card (inline + actionable) ───────────────────────────
function ActionCard({
  action, onDecide,
}: { action: PendingAction; onDecide: (a: PendingAction) => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const payload = useMemo(() => tryParse(action.payload), [action.payload]);

  const isPending = action.status === "Pending";

  const statusColor =
    action.status === "Executed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    action.status === "Approved" ? "bg-blue-100 text-blue-700 border-blue-200" :
    action.status === "Rejected" ? "bg-gray-100 text-gray-600 border-gray-200" :
    action.status === "Failed"   ? "bg-rose-100 text-rose-700 border-rose-200" :
                                    "bg-amber-100 text-amber-800 border-amber-200";

  const typeIcon = action.type === "FlashTournament" ? "🏆" : action.type === "CustomerPing" ? "📣" : "🤖";

  const handle = async (decision: "approve" | "reject") => {
    setBusy(decision);
    try {
      const res = decision === "approve"
        ? await pendingActionService.approve(action.id)
        : await pendingActionService.reject(action.id, note);
      onDecide({
        ...action,
        status: res.status,
        executionLog: res.message ?? action.executionLog,
        decidedOn: new Date().toISOString(),
      });
    } finally { setBusy(null); }
  };

  return (
    <div className="my-3 ml-12 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/40 border border-indigo-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex items-start gap-2">
          <div className="text-2xl">{typeIcon}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200">
                {action.type === "FlashTournament" ? "Flash Tournament" : action.type === "CustomerPing" ? "Customer Ping" : action.type}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusColor}`}>
                {action.status}
              </span>
            </div>
            <div className="font-semibold text-gray-800 mt-1">{action.title}</div>
            {action.summary && <div className="text-xs text-gray-600 mt-0.5">{action.summary}</div>}
          </div>
        </div>
      </div>

      {/* Type-specific preview */}
      {payload && action.type === "FlashTournament" && (
        <div className="text-sm text-gray-700 mt-3 bg-white rounded-lg p-3 border border-indigo-100 grid grid-cols-2 gap-2">
          <Field label="Game" value={payload.game} />
          <Field label="Starts" value={payload.start_at_iso} />
          <Field label="Entry / Prize" value={`$${payload.entry_fee ?? 0} → $${payload.prize_pool ?? 0}`} />
          <Field
            label="Recipients"
            value={`${Array.isArray(payload.recipient_phones) ? payload.recipient_phones.length : 0} player(s)`}
          />
          {payload.hype_message && (
            <div className="col-span-2 mt-2 text-xs text-gray-700 italic border-l-2 border-indigo-300 pl-2 py-1 bg-indigo-50/40 rounded-r">
              "{payload.hype_message}"
            </div>
          )}
        </div>
      )}

      {payload && action.type === "CustomerPing" && (
        <div className="text-sm text-gray-700 mt-3 bg-white rounded-lg p-3 border border-indigo-100 max-h-48 overflow-auto space-y-1">
          {(payload.recipients ?? []).slice(0, 10).map((r: any, i: number) => (
            <div key={i} className="text-xs flex gap-2">
              <span className="font-semibold text-gray-800 min-w-[80px]">{r.name ?? r.phone}</span>
              <span className="italic text-gray-600">"{r.message}"</span>
            </div>
          ))}
          {(payload.recipients ?? []).length > 10 && (
            <div className="text-xs text-gray-500">… and {payload.recipients.length - 10} more</div>
          )}
        </div>
      )}

      {/* Decision buttons */}
      {isPending && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            disabled={busy !== null}
            onClick={() => handle("approve")}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm flex items-center gap-1"
          >
            {busy === "approve" ? "Sending…" : <>✓ Approve &amp; send</>}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => handle("reject")}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "reject" ? "…" : "Reject"}
          </button>
          <input
            type="text"
            placeholder="Reason (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      )}

      {!isPending && action.executionLog && (
        <div className="mt-2 text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 rounded p-2 border border-gray-100">
          {action.executionLog}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}

// ── Tool-use disclosure (collapsed by default) ──────────────────────────
function ToolDisclosure({ assistantMsg, toolMessages }: {
  assistantMsg: AiMessage;
  toolMessages: AiMessage[];
}) {
  const [open, setOpen] = useState(false);
  const calls = tryParse(assistantMsg.toolCalls);
  if (!Array.isArray(calls) || calls.length === 0) return null;

  return (
    <div className="mt-2 ml-12">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[11px] text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
             className={"transition-transform " + (open ? "rotate-90" : "")}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-mono">⚙ Used {calls.length} tool{calls.length > 1 ? "s" : ""}</span>
        <span className="text-gray-400">·</span>
        <span>{calls.map((c: any) => c.name).join(", ")}</span>
      </button>

      {open && (
        <div className="mt-2 text-[11px] space-y-1 border-l-2 border-gray-200 pl-3">
          {calls.map((c: any, i: number) => {
            const result = toolMessages.find(t => t.toolCallId === c.id);
            const parsed = tryParse(result?.content ?? null);
            const summary = parsed?.error
              ? `❌ ${parsed.error}`
              : parsed?.row_count != null
                ? `${parsed.row_count} rows`
                : parsed?.proposal_id != null
                  ? `proposal #${parsed.proposal_id} created`
                  : parsed?.count != null
                    ? `${parsed.count} items`
                    : "ok";
            return (
              <div key={i} className="flex items-baseline gap-2 text-gray-600">
                <span className="font-mono text-purple-600">{c.name}</span>
                <span className="text-gray-400">→</span>
                <span className="text-gray-600">{summary}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────
function UserBubble({ m }: { m: AiMessage }) {
  return (
    <div className="flex justify-end my-3">
      <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
        <div className="whitespace-pre-wrap text-sm">{m.content}</div>
        <div className="text-[10px] mt-1 text-blue-200 text-right">{fmtTime(m.createdOn)}</div>
      </div>
    </div>
  );
}

function AssistantBubble({ m }: { m: AiMessage }) {
  const hasContent = !!m.content && m.content.trim().length > 0;
  return (
    <div className="flex justify-start my-3 gap-2">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0">
        AX
      </div>
      <div className="max-w-[80%]">
        <div className="text-[10px] text-gray-500 mb-1 font-medium">Axis AI</div>
        {hasContent ? (
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <MarkdownRenderer source={m.content!} />
            <div className="text-[10px] mt-2 text-gray-400">{fmtTime(m.createdOn)}</div>
          </div>
        ) : (
          // Tool-only assistant turn — render a slim "thinking" pill instead of empty bubble
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-[11px] text-gray-500">
            <span className="animate-pulse">●</span> processing tools
          </div>
        )}
      </div>
    </div>
  );
}

// "Typing…" indicator while waiting for the API
function TypingIndicator() {
  return (
    <div className="flex justify-start my-3 gap-2">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0">
        AX
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────
export default function AiChatPage() {
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [activeId, setActiveId]           = useState<number | null>(null);
  const [messages, setMessages]           = useState<AiMessage[]>([]);
  const [actions, setActions]             = useState<PendingAction[]>([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [loadingConv, setLoadingConv]     = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const convs = await aiChatService.listConversations();
        setConversations(convs);
        if (convs.length > 0) selectConversation(convs[0].id);
        const acts = await pendingActionService.list("Pending");
        setActions(acts.data);
      } catch (e: any) {
        setError(e?.response?.data?.error ?? e?.message ?? "Failed to load");
      }
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, actions, sending]);

  const selectConversation = async (id: number) => {
    setActiveId(id);
    setLoadingConv(true);
    setMessages([]);
    try {
      const msgs = await aiChatService.getMessages(id);
      setMessages(msgs);
    } finally { setLoadingConv(false); }
  };

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
  };

  const refreshActions = async () => {
    const [pending, all] = await Promise.all([
      pendingActionService.list("Pending"),
      activeId ? pendingActionService.list(null) : Promise.resolve({ data: [] as PendingAction[] } as any),
    ]);
    const map = new Map<number, PendingAction>();
    for (const a of all.data ?? []) map.set(a.id, a);
    for (const a of pending.data ?? []) map.set(a.id, a);
    setActions(Array.from(map.values()));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setError(null);

    const optimistic: AiMessage = {
      id: -Date.now(),
      role: "user",
      content: text,
      toolCalls: null, toolCallId: null, toolName: null,
      createdOn: new Date().toISOString(),
    };
    setMessages(m => [...m, optimistic]);

    try {
      const res = await aiChatService.send(text, activeId ?? undefined);
      const msgs = await aiChatService.getMessages(res.conversationId);
      setMessages(msgs);
      setActiveId(res.conversationId);
      if (!activeId) {
        const convs = await aiChatService.listConversations();
        setConversations(convs);
      }
      await refreshActions();
    } catch (e: any) {
      setMessages(m => m.filter(x => x.id !== optimistic.id));
      // Friendlier copy than raw axios errors. Timeout in particular looks
      // identical to the eye to "the AI hung forever" — surface why.
      let msg: string;
      if (e?.code === "TIMEOUT") {
        msg = "The AI took longer than 3 minutes to respond. Try a more specific question, or break it into smaller asks.";
      } else if (e?.response?.data?.error) {
        msg = e.response.data.error;
      } else if (typeof e?.response?.data === "string") {
        msg = e.response.data;
      } else {
        msg = e?.message ?? "Send failed";
      }
      setError(msg);
    } finally { setSending(false); }
  };

  // Build a structured "rendered list" — group tool messages under their
  // preceding assistant message so we can show one disclosure per turn.
  type Item =
    | { kind: "user"; m: AiMessage }
    | { kind: "assistant"; m: AiMessage; toolMessages: AiMessage[]; proposalIds: number[] };
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "user") {
        out.push({ kind: "user", m });
      } else if (m.role === "assistant") {
        const toolBucket: AiMessage[] = [];
        let j = i + 1;
        while (j < messages.length && messages[j].role === "tool") {
          toolBucket.push(messages[j]); j++;
        }
        i = j - 1;
        // Find proposal IDs from tool results
        const proposalIds: number[] = [];
        for (const t of toolBucket) {
          const p = tryParse(t.content);
          if (p?.proposal_id) proposalIds.push(p.proposal_id);
        }
        out.push({ kind: "assistant", m, toolMessages: toolBucket, proposalIds });
      }
    }
    return out;
  }, [messages]);

  const actionsById = useMemo(() => {
    const map = new Map<number, PendingAction>();
    for (const a of actions) map.set(a.id, a);
    return map;
  }, [actions]);

  const pendingCount = actions.filter(a => a.status === "Pending").length;

  const onDecide = (updated: PendingAction) => {
    setActions(arr => arr.map(a => (a.id === updated.id ? updated : a)));
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Sidebar */}
      <aside className="w-72 bg-white/80 backdrop-blur border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={newChat}
            className="w-full px-3 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-blue-700 shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-xs text-gray-400">No conversations yet.</div>
          ) : (
            conversations.map(c => (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={
                  "w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-indigo-50/50 transition " +
                  (activeId === c.id ? "bg-indigo-50 border-l-4 border-l-indigo-500 font-medium" : "")
                }
              >
                <div className="truncate text-gray-800">{c.title}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{fmtTime(c.lastMessageOn)}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Conversation pane */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur border-b border-gray-200 px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">AX</div>
              <div>
                <h1 className="font-semibold text-gray-800">Axis AI Assistant</h1>
                <p className="text-xs text-gray-500">Ask anything. Approve any action card before it runs.</p>
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200 flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                {pendingCount} pending
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingConv ? (
            <div className="text-center text-gray-400 mt-10">Loading…</div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            items.map((it, idx) => {
              if (it.kind === "user") return <UserBubble key={`u-${it.m.id}`} m={it.m} />;
              return (
                <div key={`a-${it.m.id}`}>
                  <AssistantBubble m={it.m} />
                  {/* Cards for any proposals this assistant turn created */}
                  {it.proposalIds.map(pid => {
                    const a = actionsById.get(pid);
                    return a ? <ActionCard key={pid} action={a} onDecide={onDecide} /> : null;
                  })}
                  {/* Tool disclosure */}
                  <ToolDisclosure assistantMsg={it.m} toolMessages={it.toolMessages} />
                </div>
              );
            })
          )}
          {sending && <TypingIndicator />}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="px-5 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <span>{typeof error === "string" ? error : JSON.stringify(error)}</span>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 text-xs ml-2">dismiss</button>
          </div>
        )}

        <footer className="bg-white border-t border-gray-200 p-3">
          <div className="flex gap-2 items-end max-w-4xl mx-auto">
            <textarea
              rows={1}
              placeholder="Ask anything about the lounge…"
              className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm max-h-32"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // auto-grow
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-1"
            >
              {sending ? "…" : (
                <>
                  Send
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </>
              )}
            </button>
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 text-center">Shift+Enter for newline · Actions always require your approval</div>
        </footer>
      </main>
    </div>
  );
}

function EmptyState() {
  const suggestions = [
    { emoji: "📊", title: "How did we do this week?",       prompt: "Give me a quick rundown of this week's revenue, top items, and anything unusual." },
    { emoji: "🍔", title: "What's running low in the kitchen?", prompt: "Show ingredients at or below reorder level." },
    { emoji: "🎮", title: "It's slow — fill the seats",      prompt: "Occupancy is low. Propose a flash tournament for the most-played game with personalised invites." },
    { emoji: "📣", title: "Bring regulars back",             prompt: "Find regulars who are due for a visit and propose personalised pings." },
  ];

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg mb-3">
          AX
        </div>
        <h2 className="text-xl font-semibold text-gray-800">How can I help?</h2>
        <p className="text-sm text-gray-500 mt-1">Ask about revenue, stock, customers — or tell me to fill empty hours.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {suggestions.map(s => (
          <button
            key={s.title}
            onClick={() => {
              const ta = document.querySelector<HTMLTextAreaElement>("textarea");
              if (ta) {
                ta.value = s.prompt;
                ta.focus();
                // trigger React onChange
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                setter?.call(ta, s.prompt);
                ta.dispatchEvent(new Event("input", { bubbles: true }));
              }
            }}
            className="text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition group"
          >
            <div className="flex items-start gap-2">
              <span className="text-xl">{s.emoji}</span>
              <div>
                <div className="font-medium text-sm text-gray-800 group-hover:text-indigo-700">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.prompt}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
